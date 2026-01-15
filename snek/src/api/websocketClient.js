// WebSocket client for real-time multiplayer
class WebSocketGameClient {
  constructor() {
    this.ws = null;
    this.playerId = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.messageQueue = [];
    this.listeners = new Map();
    this.connected = false;
  }

  connect() {
    // Auto-detect WebSocket URL based on environment
    let wsUrl = import.meta.env.VITE_WS_URL;
    
    if (!wsUrl) {
      // In production, use the same host with wss:// for secure WebSocket
      if (import.meta.env.PROD) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        wsUrl = `${protocol}//${host}`;
      } else {
        // Development: use localhost
        wsUrl = `ws://localhost:3001`;
      }
    }
    
    try {
      this.ws = new WebSocket(wsUrl);
      this.playerId = `player_${Math.random().toString(36).substr(2, 9)}`;
      
      this.ws.onopen = () => {
        // WebSocket connected
        this.connected = true;
        this.reconnectAttempts = 0;
        this.flushMessageQueue();
        this.emit('connected');
      };
      
      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('[WebSocket] Error parsing message:', error);
        }
      };
      
      this.ws.onclose = () => {
        console.log('[WebSocket] Disconnected');
        this.connected = false;
        this.emit('disconnected');
        this.attemptReconnect();
      };
      
      this.ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
        this.emit('error', error);
      };
    } catch (error) {
      console.error('[WebSocket] Connection error:', error);
      this.emit('error', error);
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`[WebSocket] Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      setTimeout(() => {
        this.connect();
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('[WebSocket] Max reconnection attempts reached');
      this.emit('reconnectFailed');
    }
  }

  send(action, params, responseId = null) {
    const message = {
      action,
      playerId: this.playerId,
      responseId: responseId || `${action}_${Date.now()}_${Math.random()}`,
      ...params
    };
    
    if (this.connected && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return message.responseId;
    } else {
      this.messageQueue.push(message);
      if (!this.connected) {
        this.connect();
      }
      return message.responseId;
    }
  }

  flushMessageQueue() {
    while (this.messageQueue.length > 0 && this.connected) {
      const message = this.messageQueue.shift();
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(message));
      }
    }
  }

  handleMessage(message) {
    // Message received (debug logging removed for cleaner console)
    
    if (message.type === 'roomUpdate') {
      this.emit('roomUpdate', message.room);
    } else if (message.type === 'gameStart') {
      this.emit('gameStart', message.room);
    } else if (message.type === 'gameUpdate') {
      this.emit('gameUpdate', message);
    } else if (message.type === 'chatMessage') {
      // Chat message broadcast - update room with new chat
      if (message.room) {
        this.emit('chatMessage', message.room);
      }
    } else if (message.type === 'typingUpdate') {
      // Typing status update
      if (message.room) {
        this.emit('typingUpdate', message.room);
      }
    } else {
      // Regular response - emit with responseId if present
      if (message.responseId) {
        this.emit(`response:${message.responseId}`, message);
      }
      this.emit('response', message);
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[WebSocket] Error in ${event} listener:`, error);
        }
      });
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.listeners.clear();
  }
}

// Create singleton instance
export const wsClient = new WebSocketGameClient();

// Auto-connect on import
if (typeof window !== 'undefined') {
  wsClient.connect();
}

