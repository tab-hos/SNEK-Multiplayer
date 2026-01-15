// WebSocket client for real-time multiplayer
class WebSocketGameClient {
  constructor() {
    this.ws = null;
    this.playerId = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10; // More attempts for Render.com
    this.reconnectDelay = 1000;
    this.messageQueue = [];
    this.listeners = new Map();
    this.connected = false;
    this.pingInterval = null;
    this.pongTimeout = null;
    this.isProduction = import.meta.env.PROD;
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
        
        // Start ping/pong keepalive for Render.com (prevents connection timeout)
        this.startKeepAlive();
      };
      
      this.ws.onmessage = (event) => {
        try {
          // Handle pong response for keepalive
          if (event.data === 'pong') {
            if (this.pongTimeout) {
              clearTimeout(this.pongTimeout);
              this.pongTimeout = null;
            }
            return;
          }
          
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('[WebSocket] Error parsing message:', error);
        }
      };
      
      this.ws.onclose = () => {
        console.log('[WebSocket] Disconnected');
        this.connected = false;
        this.stopKeepAlive();
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
      // Exponential backoff with jitter for Render.com
      const baseDelay = this.isProduction ? 2000 : 1000; // Longer delay for production
      const delay = Math.min(baseDelay * Math.pow(1.5, this.reconnectAttempts - 1) + Math.random() * 1000, 10000);
      setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      console.error('[WebSocket] Max reconnection attempts reached');
      this.emit('reconnectFailed');
    }
  }
  
  startKeepAlive() {
    // Ping/pong keepalive for Render.com (prevents connection timeout)
    if (this.isProduction) {
      this.stopKeepAlive(); // Clear any existing interval
      this.pingInterval = setInterval(() => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          try {
            this.ws.send('ping');
            // Set timeout to detect if pong doesn't come back
            this.pongTimeout = setTimeout(() => {
              console.warn('[WebSocket] Pong timeout, reconnecting...');
              this.ws.close();
            }, 5000);
          } catch (error) {
            console.error('[WebSocket] Error sending ping:', error);
          }
        }
      }, 30000); // Ping every 30 seconds (Render.com timeout is usually 60s)
    }
  }
  
  stopKeepAlive() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
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
    this.stopKeepAlive();
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

