import React, { useState, useEffect, useCallback, useRef } from 'react';
import { gameClient } from '../api/gameClient.js';
import { wsClient } from '../api/websocketClient.js';
import { Volume2, VolumeX, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '../components/ui/button.jsx';
import GameBoard from '../components/game/GameBoard.jsx';
import Scoreboard from '../components/game/ScoreBoard.jsx';
import GameMenu from '../components/game/GameMenu.jsx';
import Lobby from '../components/game/Lobby.jsx';
import JoinForm from '../components/game/JoinForm.jsx';
import Chat from '../components/game/Chat.jsx';
import { soundManager } from '../components/game/SoundManager.js';

// Adaptive tick rate based on environment
// Render.com has higher latency, so we use a slightly slower tick rate for stability
// This ensures smooth gameplay even with 100-200ms latency
const isProduction = import.meta.env.PROD;
const TICK_RATE = isProduction ? 200 : 150; // Slower for Render.com to handle latency better

export default function Game() {
  const [room, setRoom] = useState(null);
  // `displayRoom` is used only for rendering the board smoothly (can be interpolated).
  // `room` remains the authoritative server state for UI/logic.
  const [displayRoom, setDisplayRoom] = useState(null);
  const [playerId] = useState(() => `player_${Math.random().toString(36).substr(2, 9)}`);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(20); // Percentage (15-25%)
  const [fps, setFps] = useState(0);
  const [countdown, setCountdown] = useState(null);
  const sidebarResizeRef = useRef(false);
  const lastTickRef = useRef(0);
  const gameLoopRef = useRef(null);
  const pollingRef = useRef(null);
  const directionQueueRef = useRef(null);
  const fpsRef = useRef({ frames: 0, lastTime: Date.now() });
  const renderLoopRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const isStartingGameRef = useRef(false);
  const isInWaitingLobbyRef = useRef(false);
  const displayRoomRef = useRef(null);
  const pendingRoomUpdateRef = useRef(null);
  const lastUpdateTimeRef = useRef(0);

  useEffect(() => {
    displayRoomRef.current = displayRoom;
  }, [displayRoom]);

  // Ensure displayRoom is synced with room when room changes (fallback)
  useEffect(() => {
    if (room && !displayRoom) {
      setDisplayRoom(room);
    }
  }, [room, displayRoom]);

  // API calls
  const callServer = useCallback(async (action, params = {}) => {
    const response = await gameClient.functions.invoke('gameServer', {
      action,
      playerId,
      ...params
    });
    return response.data;
  }, [playerId]);

  // Create room
  const handleCreateRoom = useCallback(async (playerName) => {
    setLoading(true);
    setError('');
    try {
      soundManager.init();
      const result = await callServer('createRoom', { playerName });
      if (result.success) {
        setRoom(result.room);
        setDisplayRoom(result.room);
      } else {
        setError(result.error || 'Failed to create room');
      }
    } catch (err) {
      setError('Failed to create room');
    }
    setLoading(false);
  }, [callServer]);

  // Join room
  const handleJoinRoom = useCallback(async (playerName, roomCode) => {
    setLoading(true);
    setError('');
    try {
      soundManager.init();
      const result = await callServer('joinRoom', { playerName, roomCode });
      if (result.success) {
        setRoom(result.room);
        setDisplayRoom(result.room);
      } else {
        setError(result.error || 'Failed to join room');
      }
    } catch (err) {
      setError('Failed to join room');
    }
    setLoading(false);
  }, [callServer]);

  // Start game
  const handleStartGame = useCallback(async () => {
    if (!room || isStartingGameRef.current) return; // Prevent multiple clicks
    
    // Clear waiting lobby flag since we're starting a new game
    // This allows WebSocket updates to work normally again
    isInWaitingLobbyRef.current = false;
    
    // Clear any existing countdown
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    
    isStartingGameRef.current = true;
    
    try {
      // Start the game immediately on server (sets status to 'playing')
      const result = await callServer('startGame', { roomCode: room.room_code });
      
      if (result.success && result.room) {
        // Set room to playing status immediately so game board shows
        const updatedRoom = { ...result.room, status: 'playing' };
        setRoom(updatedRoom);
        setDisplayRoom(updatedRoom);
        
        // Start countdown on game board
        setCountdown(5);
        let count = 5;
        
        countdownIntervalRef.current = setInterval(() => {
          count--;
          setCountdown(count);
          
          if (count <= 0) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
            setCountdown(null);
            isStartingGameRef.current = false;
            soundManager.playStart();
            // Force a re-render to trigger game loop useEffect
            // The useEffect will detect countdown === null and start the loop
          }
        }, 1000);
      } else {
        console.error('Failed to start game:', result.error);
        isStartingGameRef.current = false;
      }
    } catch (err) {
      console.error('Failed to start game:', err);
      isStartingGameRef.current = false;
      setCountdown(null);
    }
  }, [room, callServer]);

  // Get effective tick rate - no longer affected by speed powerups (they're handled server-side per player)
  const getEffectiveTickRate = useCallback(() => {
    return TICK_RATE;
  }, []);

  // Game tick
  const gameTick = useCallback(async () => {
    if (!room || room.status !== 'playing') return;
    // Don't start game ticks while countdown is active
    if (countdown !== null && countdown > 0) return;

    // Only the host should drive the tick loop to avoid multiple clients speeding/jittering the game.
    if (room.host_id && room.host_id !== playerId) return;
    
    const now = Date.now();
    const effectiveTickRate = getEffectiveTickRate();
    if (now - lastTickRef.current < effectiveTickRate) return;
    lastTickRef.current = now;

    // Send queued direction first (non-blocking)
    if (directionQueueRef.current) {
      // Use WebSocket directly for direction updates to avoid HTTP overhead
      try {
        wsClient.send('updateDirection', {
          roomCode: room.room_code,
          direction: directionQueueRef.current
        });
      } catch (e) {
        // Fallback to callServer if WebSocket fails
        callServer('updateDirection', {
          roomCode: room.room_code,
          direction: directionQueueRef.current
        }).catch(() => {
          // Ignore errors - direction will be sent in next tick
        });
      }
      directionQueueRef.current = null;
    }

    // Send tick request (non-blocking - WebSocket broadcasts are primary update mechanism)
    // This ensures server processes the game state, but we don't update state from tick responses
    // WebSocket broadcasts handle all state updates to avoid race conditions
    // Use WebSocket directly to avoid HTTP overhead
    try {
      wsClient.send('tick', { roomCode: room.room_code });
    } catch (e) {
      // Fallback to callServer if WebSocket fails
      callServer('tick', { roomCode: room.room_code }).catch(() => {
        // Silently handle tick failures - game updates come via WebSocket broadcasts anyway
        // This is expected behavior, especially on slower networks like Render
      });
    }
  }, [room, callServer, countdown, playerId, getEffectiveTickRate]);

  // Poll for updates (lobby & paused) - also listen to WebSocket updates
  const pollRoom = useCallback(async () => {
    if (!room) return;
    try {
      const result = await callServer('getRoom', { roomCode: room.room_code });
      if (result.success) {
        setRoom(result.room);
        if (result.room.status === 'playing' && room.status !== 'playing') {
          soundManager.playStart();
        }
      }
    } catch (err) {
      console.error('Poll failed');
    }
  }, [room, callServer]);

  // Cleanup countdown interval on unmount or room change
  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      isStartingGameRef.current = false;
    };
  }, [room?.room_code]);

  // Listen to WebSocket updates
  useEffect(() => {
    if (!room) return;

    const setRoomWithInterpolation = (nextRoom) => {
      // Always update authoritative room immediately
      setRoom(nextRoom);
      
      // Throttle displayRoom updates to maintain 60 FPS for smooth rendering
      // For Render.com, we ensure updates are applied smoothly even with network latency
      const now = performance.now();
      if (now - lastUpdateTimeRef.current >= 16) { // ~60 FPS for smooth gameplay
        setDisplayRoom(nextRoom);
        lastUpdateTimeRef.current = now;
        pendingRoomUpdateRef.current = null;
      } else {
        // Queue the update for next frame - ensures smooth rendering on Render.com
        pendingRoomUpdateRef.current = nextRoom;
      }
    };
    
    const handleRoomUpdate = (updatedRoom) => {
      if (updatedRoom) {
        // If we're intentionally in waiting state (after Back to Lobby), block all status changes
        if (isInWaitingLobbyRef.current) {
          // Only allow updates that keep us in waiting state
          // This prevents redirect back to gameboard
          if (updatedRoom.status === 'waiting') {
            setRoom(updatedRoom);
          }
          // Completely ignore any updates that would change status away from 'waiting'
          return;
        }
        
        // Normal update - not in intentional waiting state
        // Allow updates even during countdown - they're needed for smooth rendering
        setRoomWithInterpolation(updatedRoom);
        if (updatedRoom.status === 'playing' && room?.status !== 'playing') {
          // Game just started - sound will play when countdown ends
        }
      }
    };
    
    const handleGameUpdate = (update) => {
      if (update.room) {
        // Don't update if we're intentionally in waiting state (after Play Again)
        if (isInWaitingLobbyRef.current) {
          // Ignore all game updates when we're waiting in lobby
          return;
        }
        
        // Always update room state from server (server is source of truth)
        setRoomWithInterpolation(update.room);
        if (update.foodEaten) soundManager.playEat();
        if (update.powerUpCollected) soundManager.playPowerUp();
        if (update.eliminated?.length > 0) soundManager.playDeath();
        if (update.room.status === 'ended') {
          soundManager.playWin();
        }
      }
    };
    
    const handleGameStart = (updatedRoom) => {
      if (updatedRoom) {
        // Clear waiting lobby flag if game is starting
        isInWaitingLobbyRef.current = false;
        
        // Set room to playing immediately so gameboard shows
        setRoomWithInterpolation({ ...updatedRoom, status: 'playing' });
        
        // Start countdown for all players (including host if they don't have it yet)
        // This ensures both host and guests see the countdown
        if (countdown === null || countdown <= 0) {
          setCountdown(5);
          let count = 5;
          
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
          }
          
          countdownIntervalRef.current = setInterval(() => {
            count--;
            setCountdown(count);
            
            if (count <= 0) {
              clearInterval(countdownIntervalRef.current);
              countdownIntervalRef.current = null;
              setCountdown(null);
              soundManager.playStart();
              // Force a re-render to trigger game loop useEffect
            }
          }, 1000);
        }
      }
    };
    
    const handleChatMessage = (updatedRoom) => {
      // Update room state with latest chat messages
      // IMPORTANT: Only update chat, don't change room status or other state
      // This prevents redirects when chatting in lobby
      if (updatedRoom && room) {
        // Preserve current status and only update chat-related fields
        const updatedRoomWithPreservedStatus = {
          ...room, // Keep current room state
          chat: updatedRoom.chat || room.chat, // Update chat
          gameChat: updatedRoom.gameChat || room.gameChat, // Update gameChat
          typing: updatedRoom.typing || room.typing // Update typing status
        };
        // Only update if we're in the same status, prevent status changes from chat
        if (updatedRoomWithPreservedStatus.status === room.status) {
          setRoom(updatedRoomWithPreservedStatus);
          // Also update displayRoom for chat rendering
          if (displayRoom) {
            setDisplayRoom({
              ...displayRoom,
              chat: updatedRoomWithPreservedStatus.chat,
              gameChat: updatedRoomWithPreservedStatus.gameChat,
              typing: updatedRoomWithPreservedStatus.typing
            });
          }
        }
      }
    };
    
    const handleTypingUpdate = (updatedRoom) => {
      // Update room state with typing status only
      // Don't change room status or other state to prevent redirects
      if (updatedRoom && room) {
        const updatedRoomWithPreservedStatus = {
          ...room,
          typing: updatedRoom.typing || room.typing
        };
        if (updatedRoomWithPreservedStatus.status === room.status) {
          setRoom(updatedRoomWithPreservedStatus);
          if (displayRoom) {
            setDisplayRoom({
              ...displayRoom,
              typing: updatedRoomWithPreservedStatus.typing
            });
          }
        }
      }
    };
    
    gameClient.on('roomUpdate', handleRoomUpdate);
    gameClient.on('gameUpdate', handleGameUpdate);
    gameClient.on('gameStart', handleGameStart);
    gameClient.on('chatMessage', handleChatMessage);
    gameClient.on('typingUpdate', handleTypingUpdate);
    
    return () => {
      // Cleaning up WebSocket listeners
      gameClient.off('roomUpdate', handleRoomUpdate);
      gameClient.off('gameUpdate', handleGameUpdate);
      gameClient.off('gameStart', handleGameStart);
      gameClient.off('chatMessage', handleChatMessage);
      gameClient.off('typingUpdate', handleTypingUpdate);
    };
  }, [room?.room_code, getEffectiveTickRate, countdown]); // Re-run when room, tick rate, or countdown changes

  // Listen for fullscreen changes and sync state
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.msFullscreenElement ||
        document.mozFullScreenElement
      );
      setIsFullscreen(isCurrentlyFullscreen);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = async (e) => {
      if (!room || room.status !== 'playing') return;
      
      // Check if user is typing in chat input - don't handle movement keys
      const activeElement = document.activeElement;
      const isTyping = activeElement && (
        activeElement.tagName === 'INPUT' || 
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.isContentEditable
      );
      
      if (isTyping) {
        // Allow typing in chat, but prevent default for movement keys to avoid confusion
        // Only prevent default for movement keys when typing
        const movementKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'W', 's', 'S', 'a', 'A', 'd', 'D'];
        if (movementKeys.includes(e.key)) {
          // Don't prevent default - let the user type these keys in chat
          return;
        }
      }
      
      const keyMap = {
        ArrowUp: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 },
        w: { x: 0, y: -1 },
        s: { x: 0, y: 1 },
        a: { x: -1, y: 0 },
        d: { x: 1, y: 0 },
        W: { x: 0, y: -1 },
        S: { x: 0, y: 1 },
        A: { x: -1, y: 0 },
        D: { x: 1, y: 0 },
      };

      const direction = keyMap[e.key];
      if (direction) {
        e.preventDefault();
        // Queue direction immediately (will be sent in next tick)
        directionQueueRef.current = direction;
        // Also send immediately in background (non-blocking)
        callServer('updateDirection', {
          roomCode: room.room_code,
          direction: direction
        }).catch(() => {
          // Ignore errors - will be sent in next tick anyway
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [room, callServer]);

  // FPS counter - separate render loop for smooth 60 FPS
  // Also handles pending room updates for smooth rendering
  useEffect(() => {
    if (room?.status === 'playing') {
      let frameCount = 0;
      let lastFpsUpdate = performance.now();
      
      let lastPendingUpdateCheck = 0;
      
      const renderLoop = (currentTime) => {
        frameCount++;
        
        // Apply pending room updates during render loop (throttled to 60 FPS)
        // Check every frame but only apply if enough time has passed
        if (pendingRoomUpdateRef.current && (currentTime - lastPendingUpdateCheck >= 16)) {
          setDisplayRoom(pendingRoomUpdateRef.current);
          lastUpdateTimeRef.current = currentTime;
          lastPendingUpdateCheck = currentTime;
          pendingRoomUpdateRef.current = null;
        }
        
        // Update FPS every second
        if (currentTime - lastFpsUpdate >= 1000) {
          setFps(frameCount);
          frameCount = 0;
          lastFpsUpdate = currentTime;
        }
        
        renderLoopRef.current = requestAnimationFrame(renderLoop);
      };
      
      renderLoopRef.current = requestAnimationFrame(renderLoop);
      
      return () => {
        if (renderLoopRef.current) {
          cancelAnimationFrame(renderLoopRef.current);
          renderLoopRef.current = null;
        }
      };
    } else {
      setFps(0);
      if (renderLoopRef.current) {
        cancelAnimationFrame(renderLoopRef.current);
        renderLoopRef.current = null;
      }
    }
  }, [room?.status]);

  // Game loop - separate from rendering for better performance
  useEffect(() => {
    // Only start loop if game is playing AND countdown has finished
    if (room?.status !== 'playing') {
      // Stop the loop if game is not playing
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
        gameLoopRef.current = null;
      }
      return;
    }
    
    // Wait for countdown to finish (must be null, not 0)
    if (countdown !== null && countdown > 0) {
      // Countdown still active, don't start loop yet
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
        gameLoopRef.current = null;
      }
      return;
    }
    
    // Countdown finished, start the game loop
    let lastTickTime = 0;
    let isRunning = true;
    
    const loop = (timestamp) => {
      // Check if we should continue
      if (!isRunning) return;
      
      // Throttle ticks to prevent overwhelming the server
      // Use performance.now() for more accurate timing
      const now = performance.now();
      const effectiveTickRate = getEffectiveTickRate();
      if (now - lastTickTime >= effectiveTickRate) {
        // Don't await - let it run in background
        // WebSocket broadcasts are the primary update mechanism
        // Use setTimeout(0) to ensure tick doesn't block rendering
        setTimeout(() => gameTick(), 0);
        lastTickTime = now;
      }
      
      // Continue the loop - always use requestAnimationFrame for smooth 60 FPS
      if (isRunning) {
        gameLoopRef.current = requestAnimationFrame(loop);
      }
    };
    
    // Start the loop immediately
    gameLoopRef.current = requestAnimationFrame(loop);
    
    return () => {
      isRunning = false;
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
        gameLoopRef.current = null;
      }
    };
  }, [room?.status, gameTick, countdown, getEffectiveTickRate]);

  // Polling for lobby/paused (fallback if WebSocket fails)
  useEffect(() => {
    if (room && room.status !== 'playing') {
      // Poll every 2 seconds as fallback (WebSocket should handle real-time updates)
      pollingRef.current = setInterval(pollRoom, 2000);
    }
    
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [room?.status, pollRoom]);

  // Menu actions
  const handlePause = async () => {
    if (!room) return;
    soundManager.playPause();
    await callServer('pauseGame', { roomCode: room.room_code });
    const result = await callServer('getRoom', { roomCode: room.room_code });
    if (result.success) setRoom(result.room);
  };

  const handleResume = async () => {
    if (!room) return;
    soundManager.playResume();
    await callServer('resumeGame', { roomCode: room.room_code });
    const result = await callServer('getRoom', { roomCode: room.room_code });
    if (result.success) setRoom(result.room);
  };

  const handleQuit = async () => {
    if (room) {
      try {
        await callServer('leaveRoom', { roomCode: room.room_code });
      } catch (err) {
        console.error('Leave room failed:', err);
      }
    }
    setRoom(null);
    setDisplayRoom(null);
  };

  const handlePlayAgain = useCallback(async () => {
    if (!room) return;
    
    // Clear countdown and any intervals
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setCountdown(null);
    isStartingGameRef.current = false;
    
    // Set flag to indicate we're intentionally in waiting lobby
    // This will prevent WebSocket updates from changing status
    isInWaitingLobbyRef.current = true;
    
    // Call server to reset room to lobby state
    try {
      const result = await callServer('resetToLobby', { roomCode: room.room_code });
      if (result.success && result.room) {
        // Server has reset the room, update local state
        setRoom(result.room);
        setDisplayRoom(result.room);
      } else {
        // If reset fails, try to get room
        const getRoomResult = await callServer('getRoom', { roomCode: room.room_code });
        if (getRoomResult.success && getRoomResult.room) {
          const updatedRoom = { ...getRoomResult.room, status: 'waiting' };
          setRoom(updatedRoom);
          setDisplayRoom(updatedRoom);
        } else {
          setRoom(null);
          setDisplayRoom(null);
          isInWaitingLobbyRef.current = false;
        }
      }
    } catch (err) {
      console.error('Failed to reset to lobby:', err);
      // Fallback: try to get room and force waiting status
      try {
        const result = await callServer('getRoom', { roomCode: room.room_code });
        if (result.success && result.room) {
          const updatedRoom = { ...result.room, status: 'waiting' };
          setRoom(updatedRoom);
          setDisplayRoom(updatedRoom);
        } else {
          setRoom(null);
          setDisplayRoom(null);
          isInWaitingLobbyRef.current = false;
        }
      } catch {
        setRoom(null);
        setDisplayRoom(null);
        isInWaitingLobbyRef.current = false;
      }
    }
  }, [room, callServer]);

  const handleCopyCode = () => {
    if (room?.room_code) {
      navigator.clipboard.writeText(room.room_code);
    }
  };

  // Send chat message
  const handleSendMessage = useCallback(async (message) => {
    if (!room) return;
    try {
      const result = await callServer('sendMessage', { 
        roomCode: room.room_code,
        message 
      });
      if (result.success && result.room) {
        // Update room state immediately to show own message
        setRoom(result.room);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  }, [room, callServer]);

  // Add bot
  const handleAddBot = useCallback(async () => {
    if (!room) return;
    try {
      const result = await callServer('addBot', { roomCode: room.room_code });
      if (result.success) {
        setRoom(result.room);
      } else {
        setError(result.error || 'Failed to add bot');
      }
    } catch (err) {
      setError('Failed to add bot');
    }
  }, [room, callServer]);

  // Remove bot
  const handleRemoveBot = useCallback(async () => {
    if (!room) return;
    try {
      const result = await callServer('removeBot', { roomCode: room.room_code });
      if (result.success) {
        setRoom(result.room);
      } else {
        setError(result.error || 'Failed to remove bot');
      }
    } catch (err) {
      setError('Failed to remove bot');
    }
  }, [room, callServer]);

  // Toggle ready status
  const handleToggleReady = useCallback(async () => {
    if (!room) return;
    try {
      const result = await callServer('toggleReady', { roomCode: room.room_code });
      if (result.success) {
        setRoom(result.room);
      } else {
        setError(result.error || result.error || 'Failed to toggle ready');
      }
    } catch (err) {
      setError('Failed to toggle ready');
    }
  }, [room, callServer]);

  const toggleSound = () => {
    const enabled = soundManager.toggle();
    setSoundEnabled(enabled);
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        // Enter fullscreen
        const element = document.documentElement;
        if (element.requestFullscreen) {
          await element.requestFullscreen();
        } else if (element.webkitRequestFullscreen) {
          // Safari
          await element.webkitRequestFullscreen();
        } else if (element.msRequestFullscreen) {
          // IE/Edge
          await element.msRequestFullscreen();
        } else if (element.mozRequestFullScreen) {
          // Firefox
          await element.mozRequestFullScreen();
        }
        setIsFullscreen(true);
      } else {
        // Exit fullscreen
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          // Safari
          await document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
          // IE/Edge
          await document.msExitFullscreen();
        } else if (document.mozCancelFullScreen) {
          // Firefox
          await document.mozCancelFullScreen();
        }
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error('Error toggling fullscreen:', err);
      // Fallback to state-based fullscreen if browser API fails
      setIsFullscreen(prev => !prev);
    }
  };

  // Handle sidebar resize
  const handleSidebarResizeStart = (e) => {
    e.preventDefault();
    sidebarResizeRef.current = true;
    document.addEventListener('mousemove', handleSidebarResize);
    document.addEventListener('mouseup', handleSidebarResizeEnd);
  };

  const handleSidebarResize = (e) => {
    if (!sidebarResizeRef.current) return;
    const windowWidth = window.innerWidth;
    // For right sidebar, calculate from right edge
    const newWidth = ((windowWidth - e.clientX) / windowWidth) * 100;
    // Clamp between 15% and 25%
    const clampedWidth = Math.max(15, Math.min(25, newWidth));
    setSidebarWidth(clampedWidth);
  };

  const handleSidebarResizeEnd = () => {
    sidebarResizeRef.current = false;
    document.removeEventListener('mousemove', handleSidebarResize);
    document.removeEventListener('mouseup', handleSidebarResizeEnd);
  };

  // Prevent scrolling when in fullscreen game mode
  useEffect(() => {
    if (isFullscreen && room?.status === 'playing') {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isFullscreen, room?.status]);

  // Render
  return (
    <div className="min-h-dvh w-full bg-[#222531] overflow-hidden">
      {/* Sound toggle and Fullscreen toggle */}
      <div className="fixed top-4 right-4 z-50 flex gap-2">
        {room?.status === 'playing' && (
          <Button
            size="icon"
            variant="ghost"
            onClick={toggleFullscreen}
            className="text-gray-400 hover:text-white"
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </Button>
        )}
        <Button
          size="icon"
          variant="ghost"
          onClick={toggleSound}
          className="text-gray-400 hover:text-white"
        >
          {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </Button>
      </div>

      {error && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-red-500/90 text-white px-4 py-2 rounded-lg">
            {error}
          </div>
        </div>
      )}

      {/* FPS Counter */}
      {room?.status === 'playing' && (
        <div className="fixed top-4 left-4 z-50 bg-black/70 text-white px-3 py-1 rounded text-sm font-mono">
          FPS: {fps}
        </div>
      )}


      {!room ? (
        <div className="flex items-center justify-center" style={{ height: '100vh' }}>
          <JoinForm
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
            loading={loading}
          />
        </div>
      ) : room.status === 'waiting' ? (
        <div className="flex items-center justify-center" style={{ height: '100vh', overflow: 'auto' }}>
          <div className="max-w-6xl mx-auto w-full px-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <Lobby
                  room={room}
                  playerId={playerId}
                  onStart={handleStartGame}
                  onCopyCode={handleCopyCode}
                  onLeave={handleQuit}
                  onAddBot={handleAddBot}
                  onRemoveBot={handleRemoveBot}
                  onToggleReady={handleToggleReady}
                />
              </div>
              <div className="lg:col-span-1">
                <Chat
                  room={room}
                  playerId={playerId}
                  onSendMessage={handleSendMessage}
                  disabled={false}
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        isFullscreen && room?.status === 'playing' ? (
          // Fullscreen game mode - scales proportionally, fits viewport
          <div 
            className="fixed inset-0 bg-[#222531] flex overflow-hidden z-40" 
            style={{ 
              padding: '2vh 1.5%',
              boxSizing: 'border-box',
              height: '100vh',
              maxHeight: '100vh'
            }}
          >
            {/* Game Board - centered, scales proportionally, always square, fits viewport */}
            <div 
              className="flex items-center justify-center overflow-hidden bg-[#222531] flex-shrink-0 min-w-0 min-h-0"
              style={{ 
                width: `${100 - sidebarWidth}%`,
                maxWidth: `${100 - sidebarWidth}%`,
                minWidth: 0,
                height: '96vh',
                maxHeight: '96vh',
                boxSizing: 'border-box',
                paddingRight: '1.5%'
              }}
            >
              <div 
                className="w-full h-full flex items-center justify-center" 
                style={{ 
                  maxWidth: '100%', 
                  maxHeight: '100%', 
                  width: '100%',
                  height: '100%',
                  overflow: 'hidden',
                  aspectRatio: '1 / 1'
                }}
              >
                <GameBoard
                  players={(displayRoom || room).players}
                  food={(displayRoom || room).food}
                  powerups={(displayRoom || room).powerups}
                  gridSize={(displayRoom || room).grid_size}
                  playerId={playerId}
                  viewportSize={null}
                  showStartPositions={countdown !== null && countdown > 0}
                  countdown={countdown}
                  tickRateMs={getEffectiveTickRate()}
                />
              </div>
            </div>
            
            {/* Resize handle */}
            <div
              className="w-1 bg-gray-700 hover:bg-cyan-500 cursor-col-resize transition-colors z-10 flex-shrink-0"
              onMouseDown={handleSidebarResizeStart}
            />
            
            {/* Sidebar - adjustable width, on the right, fits viewport */}
            <div 
              className="bg-gray-900/95 border-l border-gray-700 flex flex-col overflow-hidden flex-shrink-0"
              style={{ 
                width: `${sidebarWidth}%`, 
                maxWidth: `${sidebarWidth}%`,
                minWidth: '200px',
                height: '94vh',
                maxHeight: '94vh'
              }}
            >
              <div className="flex-1 min-h-0 p-4 overflow-hidden">
                <div
                  className="h-full min-h-0 grid overflow-hidden"
                  style={{ gridTemplateRows: 'minmax(0, 1fr) clamp(160px, 26vh, 240px)' }}
                >
                  <div className="min-h-0 overflow-hidden space-y-2 pb-2">
                    <Scoreboard players={room.players} timer={room.timer} />
                    <GameMenu
                      status={room.status}
                      onPause={handlePause}
                      onResume={handleResume}
                      onQuit={handleQuit}
                      onPlayAgain={handlePlayAgain}
                      winner={room.winner}
                      message={room.message}
                      room={room}
                      playerId={playerId}
                    />
                  </div>
                  <div className="min-h-0 border-t border-gray-700 pt-4 overflow-hidden">
                    <Chat
                      room={room}
                      playerId={playerId}
                      onSendMessage={handleSendMessage}
                      disabled={room.status === 'paused' || room.status === 'ended'}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Normal mode - responsive layout that fits viewport without scrolling
          <div className="h-dvh w-full overflow-hidden p-3 lg:p-4">
  <div className="h-full w-full flex flex-col lg:flex-row gap-4">
    
    {/* BOARD AREA */}
    <div className="flex-1 min-w-0 min-h-0 flex items-center justify-center">
      <div className="aspect-square h-full max-h-full w-auto max-w-full flex items-center justify-center">
        <GameBoard
          players={(displayRoom || room).players}
          food={(displayRoom || room).food}
          powerups={(displayRoom || room).powerups}
          gridSize={(displayRoom || room).grid_size}
          playerId={playerId}
          viewportSize={null}
          showStartPositions={countdown !== null && countdown > 0}
          countdown={countdown}
          tickRateMs={getEffectiveTickRate()}
        />
      </div>
    </div>

    {/* SIDEBAR */}
    <div className="lg:w-[clamp(280px,20vw,360px)] w-full lg:h-full h-[40dvh] flex flex-col overflow-hidden p-4 box-border">
      <div
        className="flex-1 min-h-0 grid overflow-hidden"
        style={{ gridTemplateRows: 'minmax(0, 1fr) clamp(160px, 26vh, 240px)' }}
      >
        <div className="min-h-0 overflow-hidden space-y-2 pb-2">
          <Scoreboard players={room.players} timer={room.timer} />
          <GameMenu
            status={room.status}
            onPause={handlePause}
            onResume={handleResume}
            onQuit={handleQuit}
            onPlayAgain={handlePlayAgain}
            winner={room.winner}
            message={room.message}
            room={room}
            playerId={playerId}
          />
        </div>
        <div className="min-h-0 overflow-hidden border-t border-gray-700 pt-4">
          <Chat
            room={room}
            playerId={playerId}
            onSendMessage={handleSendMessage}
            disabled={room.status === 'paused' || room.status === 'ended'}
          />
        </div>
      </div>
    </div>

  </div>
</div>
        )
      )}
    </div>
  );
}