import React, { memo, useMemo, useState, useEffect } from 'react';
import eggImg from '../../assets/egg.png';

const Cell = memo(({ color, isHead, isTail }) => {
  let scale = 1;
  if (isHead) scale = 1.3;
  if (isTail) scale = 0.82;

  return (
    <div
      className={`absolute w-full h-full ${isHead ? 'z-10' : ''}`}
      style={{ transform: `scale(${scale})` }}
    >
      {/* Main blob */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          backgroundColor: color,
          boxShadow: '0 1px 2px rgba(0,0,0,0.35)',
        }}
      />

      {/* Face (only on head) */}
      {isHead && (
        <div className="absolute inset-0 pointer-events-none">
          {/* Eyes */}
          <div
            className="absolute rounded-full"
            style={{
              width: '14%',
              height: '14%',
              left: '32%',
              top: '32%',
              backgroundColor: 'rgba(0,0,0,0.75)',
            }}
          />
          <div
            className="absolute rounded-full"
            style={{
              width: '14%',
              height: '14%',
              left: '54%',
              top: '32%',
              backgroundColor: 'rgba(0,0,0,0.75)',
            }}
          />

          {/* Smile */}
          <div
            className="absolute"
            style={{
              width: '34%',
              height: '20%',
              left: '33%',
              top: '52%',
              borderBottom: '3px solid rgba(0,0,0,0.65)',
              borderRadius: '0 0 999px 999px',
            }}
          />
        </div>
      )}
    </div>
  );
});
const Food = memo(() => (
  <img
    src={eggImg}
    alt="Food"
    className="absolute"
    style={{
      width: '100%',
      height: '100%',
      top: '0%',
      left: '0%',
      transform: 'scale(1.4)',
      transformOrigin: 'center',
      pointerEvents: 'none',
      zIndex: 5,
    }}
  />
));

const Powerup = memo(({ type }) => {
  const colors = {
    armor: '#FFD700',
    speed: '#00FF00',
    magnet: '#FF00FF'
  };
  const icons = {
    armor: '🛡️',
    speed: '⚡',
    magnet: '🧲'
  };
  return (
    <div
      className="absolute animate-bounce flex items-center justify-center text-xl"
      style={{
        width: '90%',
        height: '90%',
        top: '5%',
        left: '5%',
        borderRadius: '8px',
      }}
    >
      {icons[type] || '?'}
    </div>
  );
});

// Helper function to get start positions (matches server logic)
function getStartPosition(playerIndex) {
  const GRID_SIZE = 40;
  const positions = [
    { x: 5, y: 5 },
    { x: GRID_SIZE - 6, y: GRID_SIZE - 6 },
    { x: GRID_SIZE - 6, y: 5 },
    { x: 5, y: GRID_SIZE - 6 }
  ];
  return positions[playerIndex % 4];
}

const GameBoard = memo(function GameBoard({ players, food, powerups, gridSize = 40, playerId, viewportSize = null, showStartPositions = false, countdown = null }) {
  const cellSize = 100 / gridSize;
  
  // Memoize food and powerups arrays to prevent unnecessary re-renders
  const foodArray = useMemo(() => {
    return Array.isArray(food) ? food : (food ? [food] : []);
  }, [food]);
  
  const powerupsArray = useMemo(() => {
    return Array.isArray(powerups) ? powerups : [];
  }, [powerups]);

  // State to track window size for responsive scaling
  const [windowSize, setWindowSize] = useState(() => {
    if (typeof window !== 'undefined') {
      return { width: window.innerWidth, height: window.innerHeight };
    }
    return { width: 0, height: 0 };
  });

  // Listen to window resize to recalculate size
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Calculate container size - auto-scale based on available space (like zoom in/out)
  const containerSize = useMemo(() => {
    if (typeof window === 'undefined' || windowSize.width === 0) return undefined;
    
    // For fullscreen mode
    const isFullscreen = windowSize.height > 800;
    if (isFullscreen) {
      const availableHeight = windowSize.height * 0.94;
      const availableWidth = windowSize.width * 0.75;
      return Math.min(availableHeight, availableWidth);
    }
    
    // For normal mode - calculate based on viewport minus sidebar and gap
    // Sidebar is 360px + 24px gap + padding
    const sidebarWidth = 360;
    const gap = 24;
    const padding = 32; // 16px on each side
    const availableWidth = windowSize.width - sidebarWidth - gap - padding;
    const availableHeight = windowSize.height - 32; // Account for padding
    
    // Use the smaller dimension to ensure it fits and stays square
    // This creates a zoom-like effect - smaller on small screens, bigger on large screens
    return Math.min(availableWidth, availableHeight, 900); // Max 900px
  }, [windowSize]);

  // Memoize start positions
  const startPositions = useMemo(() => {
    if (!showStartPositions || !players) return [];
    return players.map((player, pIdx) => ({
      player,
      pIdx,
      startPos: getStartPosition(pIdx)
    }));
  }, [showStartPositions, players]);
  
  return (
    <div 
      className="relative bg-gray-900 rounded-lg overflow-hidden"
      style={{
        width: containerSize ? `${containerSize}px` : 'min(90vw, 90vh, 900px)',
        height: containerSize ? `${containerSize}px` : undefined,
        maxWidth: containerSize ? `${containerSize}px` : 'min(90vw, 90vh, 900px)',
        maxHeight: containerSize ? `${containerSize}px` : undefined,
        aspectRatio: '1 / 1',
        flexShrink: 0
      }}
    >
      {/* Grid lines - full grid covering entire map */}
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `
            linear-gradient(to right, #444 1px, transparent 1px),
            linear-gradient(to bottom, #444 1px, transparent 1px)
          `,
          backgroundSize: `${cellSize}% ${cellSize}%`
        }}
      />
      
      {/* Countdown overlay on game board */}
      {countdown !== null && countdown > 0 && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="text-center">
            <div className="text-8xl font-bold text-white mb-4 animate-pulse" style={{ textShadow: '0 0 20px rgba(255,255,255,0.5)' }}>
              {countdown}
            </div>
            <div className="text-xl text-gray-300">Game starting...</div>
          </div>
        </div>
      )}
      
      {/* Starting position indicators - show before game starts */}
      {startPositions.map(({ player, pIdx, startPos }) => (
        <div
          key={`start-${pIdx}`}
          className="absolute border-4 rounded-full animate-pulse"
          style={{
            left: `${startPos.x * cellSize}%`,
            top: `${startPos.y * cellSize}%`,
            width: `${cellSize * 3}%`,
            height: `${cellSize * 3}%`,
            borderColor: player.color,
            boxShadow: `0 0 20px ${player.color}40`,
            pointerEvents: 'none',
            zIndex: countdown !== null && countdown > 0 ? 40 : 1
          }}
        >
          <div
            className="absolute inset-0 flex items-center justify-center text-xs font-bold"
            style={{ color: player.color }}
          >
            {player.name}
          </div>
        </div>
      ))}
      
      {/* Food - render all food items */}
      {foodArray.map((foodItem, idx) => (
        <div
          key={`food-${idx}`}
          className="absolute overflow-visible"
          style={{
            left: `${foodItem.x * cellSize}%`,
            top: `${foodItem.y * cellSize}%`,
            width: `${cellSize}%`,
            height: `${cellSize}%`,
          }}
        >
          <Food />
        </div>
      ))}
      
      {/* Powerups */}
      {powerupsArray.map((powerup, idx) => (
        <div
          key={`powerup-${idx}`}
          className="absolute"
          style={{
            left: `${powerup.x * cellSize}%`,
            top: `${powerup.y * cellSize}%`,
            width: `${cellSize}%`,
            height: `${cellSize}%`,
          }}
        >
          <Powerup type={powerup.type} />
        </div>
      ))}
      
      {/* Snakes */}
      {players?.map((player, pIdx) => 
        player.alive && player.snake?.map((segment, sIdx) => (
<div
  key={`${pIdx}-${sIdx}`}
  className="absolute"
  style={{
    left: `${segment.x * cellSize}%`,
    top: `${segment.y * cellSize}%`,
    width: `${cellSize}%`,
    height: `${cellSize}%`,
    padding: '2px' // was 1px
  }}
>
            <Cell
  color={player.color}
  isHead={sIdx === 0}
  isTail={sIdx === player.snake.length - 1}
/>
          </div>
        ))
      )}
    </div>
  );
});

export default GameBoard;
