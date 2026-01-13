// Game server client - uses WebSocket for real-time multiplayer
import { wsClient } from './websocketClient.js';
import { mockGameServer } from './mockGameServer.js';

const USE_WEBSOCKET = true; // Set to false to use localStorage mock

export const gameClient = {
  functions: {
    invoke: async (functionName, params) => {
      if (functionName === 'gameServer') {
        const { action, playerId, ...restParams } = params;
        
        if (USE_WEBSOCKET) {
          // Use WebSocket for real-time multiplayer
          // Override WebSocket client's playerId with the one from params
          if (playerId && wsClient.playerId !== playerId) {
            // Update WebSocket playerId silently
            wsClient.playerId = playerId;
          }
          
          return new Promise((resolve, reject) => {
            const responseId = wsClient.send(action, restParams);
            // Longer timeout for tick actions (they can take longer)
            const timeoutDuration = action === 'tick' ? 2000 : 10000;
            const timeout = setTimeout(() => {
              wsClient.off(`response:${responseId}`, handler);
              wsClient.off('response', fallbackHandler);
              reject(new Error('Request timeout'));
            }, timeoutDuration);
            
            const handler = (response) => {
              clearTimeout(timeout);
              wsClient.off(`response:${responseId}`, handler);
              wsClient.off('response', fallbackHandler);
              resolve({ data: response });
            };
            
            const fallbackHandler = (response) => {
              // Fallback for responses without responseId
              // For tick actions, also accept gameUpdate messages
              if (action === 'tick' && response.type === 'gameUpdate') {
                clearTimeout(timeout);
                wsClient.off(`response:${responseId}`, handler);
                wsClient.off('response', fallbackHandler);
                resolve({ data: { success: true, room: response.room, ...response } });
              } else if (response.success !== undefined && !response.type) {
                clearTimeout(timeout);
                wsClient.off(`response:${responseId}`, handler);
                wsClient.off('response', fallbackHandler);
                resolve({ data: response });
              }
            };
            
            wsClient.on(`response:${responseId}`, handler);
            wsClient.on('response', fallbackHandler);
          });
        } else {
          // Fallback to localStorage mock
          console.log(`[Mock] Calling ${action} with:`, restParams);
          try {
            const result = await mockGameServer(action, restParams);
            return { data: result };
          } catch (error) {
            console.error(`[Mock] Error:`, error);
            throw error;
          }
        }
      } else {
        throw new Error(`Unknown function: ${functionName}`);
      }
    },
  },
  
  // WebSocket event listeners
  on: (event, callback) => wsClient.on(event, callback),
  off: (event, callback) => wsClient.off(event, callback),
};

