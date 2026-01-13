import React, { useState, useEffect, useCallback, useRef } from 'react';
import { gameClient } from '../api/gameClient.js';
import { Volume2, VolumeX, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '../components/ui/button.jsx';
import GameBoard from '../components/game/GameBoard.jsx';
import Scoreboard from '../components/game/ScoreBoard.jsx';
import GameMenu from '../components/game/GameMenu.jsx';
import Lobby from '../components/game/Lobby.jsx';
import JoinForm from '../components/game/JoinForm.jsx';
import Chat from '../components/game/Chat.jsx';
import { soundManager } from '../components/game/SoundManager.js';

const TICK_RATE = 200; // ms between game updates (slower initial speed)

export default function Game() {
  const [room, setRoom] = useState(null);
  const [playerId] = useState(() => `player_${Math.random().toString(36).substr(2, 9)}`);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [rematchTimer, setRematchTimer] = useState(null);
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

  // Game tick
  const gameTick = useCallback(async () => {
    if (!room || room.status !== 'playing') return;
    // Don't start game ticks while countdown is active
    if (countdown !== null && countdown > 0) return;
    
    const now = Date.now();
    if (now - lastTickRef.current < TICK_RATE) return;
    lastTickRef.current = now;

    // Send queued direction first
    if (directionQueueRef.current) {
      await callServer('updateDirection', {
        roomCode: room.room_code,
        direction: directionQueueRef.current
      });
      directionQueueRef.current = null;
    }

    try {
      const result = await callServer('tick', { roomCode: room.room_code });
      if (result.success && result.room) {
        setRoom(result.room);
        
        // Sound effects
        if (result.foodEaten) soundManager.playEat();
        if (result.eliminated?.length > 0) soundManager.playDeath();
        if (result.room.status === 'ended') soundManager.playWin();
      }
    } catch (err) {
      // Silently handle tick failures - game updates come via WebSocket broadcasts anyway
      // Only log if it's not a timeout (timeouts are expected if server is slow)
      if (!err.message?.includes('timeout')) {
        console.error('Tick failed:', err);
      }
    }
  }, [room, callServer]);

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
    
    const handleRoomUpdate = (updatedRoom) => {
      if (updatedRoom) {
        // If we're intentionally in waiting state (after Play Again), block all status changes
        if (isInWaitingLobbyRef.current) {
          // Only allow updates that keep us in waiting state
          if (updatedRoom.status === 'waiting') {
            setRoom(updatedRoom);
          }
          // Completely ignore any updates that would change status away from 'waiting'
          return;
        }
        
        // Normal update - not in intentional waiting state
        // Don't update room if countdown is active (to preserve countdown state)
        if (countdown !== null && countdown > 0) {
          // Countdown is active, don't update room state yet
          return;
        }
        
        setRoom(updatedRoom);
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
        setRoom(update.room);
        if (update.foodEaten) soundManager.playEat();
        if (update.powerUpCollected) soundManager.playPowerUp();
        if (update.eliminated?.length > 0) soundManager.playDeath();
        if (update.room.status === 'ended') {
          soundManager.playWin();
          // Start rematch timer (15 seconds)
          setRematchTimer(15);
        }
      }
    };
    
    const handleGameStart = (updatedRoom) => {
      if (updatedRoom) {
        // Clear waiting lobby flag if game is starting
        isInWaitingLobbyRef.current = false;
        
        // Set room to playing immediately so gameboard shows
        setRoom({ ...updatedRoom, status: 'playing' });
        
        // If we're not already showing countdown, start it
        if (countdown === null && !isStartingGameRef.current) {
          // Another player started the game, show countdown on gameboard
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
            }
          }, 1000);
        }
      }
    };
    
    const handleChatMessage = (updatedRoom) => {
      // Update room state with latest chat messages
      if (updatedRoom) {
        setRoom(updatedRoom);
      }
    };
    
    const handleTypingUpdate = (updatedRoom) => {
      // Update room state with typing status
      if (updatedRoom) {
        setRoom(updatedRoom);
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
  }, [room?.room_code]); // Only re-run when room code changes

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

  // Rematch timer countdown
  const roomCodeRef = useRef(room?.room_code);
  useEffect(() => {
    roomCodeRef.current = room?.room_code;
  }, [room?.room_code]);

  useEffect(() => {
    if (rematchTimer === null || rematchTimer <= 0) return;
    
    const interval = setInterval(() => {
      setRematchTimer(prev => {
        if (prev === null || prev <= 1) {
          // Timer reached 0, trigger rematch
          const currentRoomCode = roomCodeRef.current;
          if (currentRoomCode) {
            callServer('getRoom', { roomCode: currentRoomCode })
              .then(result => {
                if (result.success && result.room) {
                  setRoom({ ...result.room, status: 'waiting' });
                } else {
                  setRoom(null);
                }
              })
              .catch(err => {
                console.error('Failed to get room for rematch:', err);
                setRoom(null);
              });
          }
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [rematchTimer, callServer]);

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
  useEffect(() => {
    if (room?.status === 'playing') {
      let frameCount = 0;
      let lastFpsUpdate = performance.now();
      
      const renderLoop = (currentTime) => {
        frameCount++;
        
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
    if (room?.status === 'playing' && (countdown === null || countdown <= 0)) {
      let lastTickTime = 0;
      let isRunning = true;
      
      const loop = (timestamp) => {
        // Check if we should continue
        if (!isRunning) return;
        
        // Don't start game if countdown is still active
        if (countdown !== null && countdown > 0) {
          isRunning = false;
          return;
        }
        
        // Throttle ticks to prevent overwhelming the server
        // Use performance.now() for more accurate timing
        const now = performance.now();
        if (now - lastTickTime >= TICK_RATE) {
          gameTick().catch((err) => {
            // Silently handle tick errors - game updates come via WebSocket broadcasts
            // Don't stop the loop on errors
          });
          lastTickTime = now;
        }
        
        // Continue the loop
        if (isRunning) {
          gameLoopRef.current = requestAnimationFrame(loop);
        }
      };
      
      gameLoopRef.current = requestAnimationFrame(loop);
      
      return () => {
        isRunning = false;
        if (gameLoopRef.current) {
          cancelAnimationFrame(gameLoopRef.current);
          gameLoopRef.current = null;
        }
      };
    } else {
      // Stop the loop if game is not playing or countdown is active
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
        gameLoopRef.current = null;
      }
    }
    
    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
        gameLoopRef.current = null;
      }
    };
  }, [room?.status, gameTick, countdown]);

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
    // Clear rematch timer
    setRematchTimer(null);
    if (room) {
      try {
        await callServer('leaveRoom', { roomCode: room.room_code });
      } catch (err) {
        console.error('Leave room failed:', err);
      }
    }
    setRoom(null);
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
    
    // Reset rematch timer
    setRematchTimer(null);
    
    // Set flag to indicate we're intentionally in waiting lobby
    // This will prevent WebSocket updates from changing status
    isInWaitingLobbyRef.current = true;
    
    // Get the current room to go back to lobby for rematch
    try {
      const result = await callServer('getRoom', { roomCode: room.room_code });
      if (result.success && result.room) {
        // Force status to 'waiting' to ensure we stay in lobby
        // This prevents the room from re-rendering back to gameboard
        const updatedRoom = { ...result.room, status: 'waiting' };
        setRoom(updatedRoom);
        
        // The room should now stay in 'waiting' state until game is started again
        // WebSocket updates will be ignored if they try to change status away from 'waiting'
      } else {
        // If room doesn't exist, go back to join form
        setRoom(null);
        isInWaitingLobbyRef.current = false;
      }
    } catch (err) {
      console.error('Failed to get room for rematch:', err);
      setRoom(null);
      isInWaitingLobbyRef.current = false;
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
    <div className="min-h-screen bg-[#222531] p-4 md:p-8">
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
        <div className="flex items-center justify-center min-h-[80vh]">
          <JoinForm
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
            loading={loading}
          />
        </div>
      ) : room.status === 'waiting' ? (
        <div className="flex items-center justify-center min-h-[80vh]">
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
          // Fullscreen game mode
          <div className="fixed inset-0 bg-[#222531] flex overflow-hidden z-40">
            {/* Game Board - centered, takes remaining space, 94% height with 3% gaps */}
            <div 
              className="flex items-center justify-center overflow-hidden bg-[#222531] flex-shrink-0"
              style={{ 
                width: `${100 - sidebarWidth}%`,
                maxWidth: `${100 - sidebarWidth}%`,
                minWidth: 0,
                height: '94vh',
                marginTop: '3vh',
                marginBottom: '3vh',
                boxSizing: 'border-box'
              }}
            >
              <div className="w-full h-full flex items-center justify-center" style={{ maxWidth: '100%', maxHeight: '100%', overflow: 'hidden' }}>
                <GameBoard
                  players={room.players}
                  food={room.food}
                  powerups={room.powerups}
                  gridSize={room.grid_size}
                  playerId={playerId}
                  viewportSize={null}
                  showStartPositions={countdown !== null && countdown > 0}
                  countdown={countdown}
                />
              </div>
            </div>
            
            {/* Resize handle */}
            <div
              className="w-1 bg-gray-700 hover:bg-cyan-500 cursor-col-resize transition-colors z-10 flex-shrink-0"
              onMouseDown={handleSidebarResizeStart}
            />
            
            {/* Sidebar - adjustable width, on the right */}
            <div 
              className="bg-gray-900/95 border-l border-gray-700 flex flex-col overflow-hidden flex-shrink-0"
              style={{ 
                width: `${sidebarWidth}%`, 
                maxWidth: `${sidebarWidth}%`,
                minWidth: '200px' 
              }}
            >
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <Scoreboard players={room.players} timer={room.timer} />
                <GameMenu
                  status={room.status}
                  onPause={handlePause}
                  onResume={handleResume}
                  onQuit={handleQuit}
                  onPlayAgain={handlePlayAgain}
                  winner={room.winner}
                  message={room.message}
                  rematchTimer={rematchTimer}
                />
              </div>
              <div className="border-t border-gray-700 p-4" style={{ height: '40%', minHeight: '300px' }}>
                <Chat
                  room={room}
                  playerId={playerId}
                  onSendMessage={handleSendMessage}
                  disabled={room.status === 'paused' || room.status === 'ended'}
                />
              </div>
            </div>
          </div>
        ) : (
          // Normal mode - responsive layout that fits screen
          <div className="w-full h-screen flex flex-col lg:flex-row overflow-hidden">
            
            {/* Board - auto-scales to fit available space, always square, maintains gap */}
            <div className="flex-1 flex items-center justify-center p-4" style={{ minWidth: 0, minHeight: 0, paddingRight: '24px' }}>
              <GameBoard
                players={room.players}
                food={room.food}
                powerups={room.powerups}
                gridSize={room.grid_size}
                playerId={playerId}
                viewportSize={null}
                showStartPositions={countdown !== null && countdown > 0}
                countdown={countdown}
              />
            </div>

            {/* Sidebar - right side, fixed width, maintains gap */}
            <div className="w-full lg:w-[360px] lg:flex-shrink-0 flex flex-col gap-4 p-4 overflow-y-auto" style={{ maxHeight: '100vh' }}>
              <Scoreboard players={room.players} timer={room.timer} />
              <GameMenu
                status={room.status}
                onPause={handlePause}
                onResume={handleResume}
                onQuit={handleQuit}
                onPlayAgain={handlePlayAgain}
                winner={room.winner}
                message={room.message}
                rematchTimer={rematchTimer}
              />
              <div style={{ height: '400px', minHeight: '400px', maxHeight: '400px', flexShrink: 0 }}>
                <Chat
                  room={room}
                  playerId={playerId}
                  onSendMessage={handleSendMessage}
                  disabled={room.status === 'paused' || room.status === 'ended'}
                />
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}