import React, { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';
import { Button } from '../ui/button.jsx';
import { Input } from '../ui/input.jsx';
import { gameClient } from '../../api/gameClient.js';

export default function Chat({ room, playerId, onSendMessage, disabled = false }) {
  const [message, setMessage] = useState('');
  const chatEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const messages = room?.chat || [];
  const typing = room?.typing || {};

  // Auto-scroll to bottom when new messages arrive (only if user is at bottom)
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const messagesContainerRef = useRef(null);
  
  useEffect(() => {
    if (!isUserScrolling && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, isUserScrolling]);

  // Detect if user is manually scrolling
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50; // 50px threshold
      setIsUserScrolling(!isAtBottom);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Get list of players currently typing (excluding self)
  const getTypingPlayers = () => {
    if (!room || !room.players) return [];
    const now = Date.now();
    const typingPlayers = [];
    
    Object.keys(typing).forEach(pid => {
      if (pid !== playerId && typing[pid]) {
        // Typing status expires after 3 seconds
        if (now - typing[pid] < 3000) {
          const player = room.players.find(p => p.id === pid);
          if (player) {
            typingPlayers.push(player);
          }
        }
      }
    });
    
    return typingPlayers;
  };

  // Send typing status to server
  const sendTypingStatus = (isTyping) => {
    if (!room?.room_code || disabled) return;
    
    try {
      gameClient.functions.invoke('gameServer', {
        action: 'typing',
        roomCode: room.room_code,
        isTyping
      });
    } catch (err) {
      // Silently fail - typing indicator is not critical
    }
  };

  // Handle input change with typing indicator
  const handleInputChange = (e) => {
    const value = e.target.value;
    setMessage(value);
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    if (value.trim()) {
      // Send typing status
      sendTypingStatus(true);
      
      // Clear typing status after 2 seconds of no typing
      typingTimeoutRef.current = setTimeout(() => {
        sendTypingStatus(false);
      }, 2000);
    } else {
      // Clear typing status immediately if input is empty
      sendTypingStatus(false);
    }
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      // Clear typing status
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      sendTypingStatus(false);
      
      onSendMessage(message.trim());
      setMessage('');
    }
  };

  // Cleanup typing status on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      sendTypingStatus(false);
    };
  }, []);

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="bg-[#323645] rounded-xl p-4 flex flex-col" style={{ height: '100%', minHeight: '400px' }}>
      {/* Chat Header */}
      <div className="p-3 flex-shrink-0">
        <h3 className="text-sm font-semibold text-white">Chat</h3>
      </div>
      
      {/* Messages - fixed height with scroll */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0"
        style={{ maxHeight: '300px', minHeight: '200px' }}
      >
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 text-sm py-4">
            No messages yet. Start chatting!
          </div>
        ) : (
          messages.map((msg) => {
            const isOwnMessage = msg.playerId === playerId;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`w-[80%] max-w-[80%] rounded-lg px-3 py-2 ${
                    isOwnMessage ? 'bg-[#CF5A16]' : 'bg-gray-800/50'
                  }`}
                >
                  {!isOwnMessage && (
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: msg.playerColor }}
                      />
                      <span className="text-xs font-medium" style={{ color: msg.playerColor }}>
                        {msg.playerName}
                      </span>
                    </div>
                  )}
                  <p className="text-sm text-white break-words">{msg.message}</p>
                  <span className="text-xs text-gray-400 mt-1 block">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
              </div>
            );
          })
        )}
        
        {/* Typing indicators */}
        {getTypingPlayers().length > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400">
            <div className="flex items-center gap-1">
              {getTypingPlayers().map((player, idx) => (
                <span key={player.id} style={{ color: player.color }}>
                  {player.name}
                  {idx < getTypingPlayers().length - 1 && ','}
                </span>
              ))}
            </div>
            <span className="flex items-center gap-1">
              <span className="animate-pulse">is typing</span>
              <span className="flex gap-1">
                <span className="animate-bounce" style={{ animationDelay: '0ms' }}>.</span>
                <span className="animate-bounce" style={{ animationDelay: '150ms' }}>.</span>
                <span className="animate-bounce" style={{ animationDelay: '300ms' }}>.</span>
              </span>
            </span>
          </div>
        )}
        
        <div ref={chatEndRef} />
      </div>
      
      {/* Input */}
      <form onSubmit={handleSend} className="p-3 flex-shrink-0">
        <div className="flex gap-2">
          <Input
            value={message}
            onChange={handleInputChange}
            placeholder={disabled ? "Chat disabled" : "Type a message..."}
            disabled={disabled}
            maxLength={200}
            className="
             flex-1 
             bg-[#222531] 
             text-white text-sm
              border border-gray-700/40
              focus:border-gray-500/40
              focus:ring-1 focus:ring-gray-500/30
            "
          />
          <Button
            type="submit"
            size="icon"
            disabled={!message.trim() || disabled}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}

