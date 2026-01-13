# Latest Changes

## Bug Fixes & Performance Improvements

### Gameplay Fixes
- **Fixed gameplay smoothness**: Separated rendering loop from game logic loop using `requestAnimationFrame` for smooth 60 FPS rendering
- **Fixed speed powerup bug**: Snake no longer goes through snacks - now checks food collision after each movement step (not just at the end)
- **Fixed snake going backwards**: Improved direction validation to prevent 180-degree turns that caused instant death
- **Fixed player leaving**: Players are now properly removed from the players array and their snake/leaderboard data is cleaned up when they leave or disconnect
- **Fixed chat WASD keys**: Movement keys are now disabled when chat input is focused, allowing full typing in chat including WASD letters
- **Fixed Play Again button**: Fixed race condition that caused re-rendering back to gameboard; now properly maintains 'waiting' status in lobby
- **Fixed FPS performance**: Optimized rendering with separate render loop, memoized GameBoard components, and reduced unnecessary re-renders

### UI/UX Improvements
- **Fixed sidebar overlap**: Sidebar and gameboard no longer overlap - proper flex layout with fixed gap between them
- **Fixed chat box sizing**: Chat box now has fixed size with scrolling in both fullscreen and normal modes
- **Responsive gameboard**: Gameboard now auto-scales based on screen size while maintaining square aspect ratio (zoom-like effect)
- **Window resize support**: Gameboard recalculates size when window is resized, always staying square and maintaining gap from sidebar
- **Fixed countdown display**: Countdown now appears on game board (not in lobby) with starting positions visible during countdown
- **FPS counter**: Added real-time FPS display in top-left corner during gameplay

### Bot AI Improvements
- **Improved bot targeting**: Bots now prioritize closest target (snack or powerup) based on distance, not always just powerups
- Bots will collect snacks when they're closer than powerups, making gameplay more balanced

### Game Balance
- **Reduced food count**: Maximum snacks on field reduced to 3 (was 2-5 based on player count)

### New Features
- **5-second countdown**: Added countdown timer before game starts with visual overlay on gameboard
- **Starting position indicators**: Shows player starting positions on the map during countdown with colored indicators and player names
- **FPS counter**: Displays real-time FPS in corner during gameplay

# 1/13/26 Changes

## Gameplay view 
- Made grid smaller to enhance vicual design
- Added faces and tails to snakes
- Added egg images as a food

## Other
- Added sound effect on powerups
- deleted extra server file
- color matching on all pages



# SNEK Game - Change Log

## Latest Updates (Today's Session)

### Gameplay Improvements
- **Removed Point Redistribution**: Players now lose all accumulated points on death, but other players do not receive those points. Points are simply lost.
- **Reduced Initial Game Speed**: Increased tick rate from 150ms to 200ms for slower, more strategic gameplay.
- **Increased Grid Size**: Changed from 80x80 to 100x100 grid (10,000 cells) for more play area and better movement space.
- **Fixed Score Reset**: Players now properly lose all points (score and foodEaten reset to 0) on both respawn and permanent death.

### Powerup System
- **Enhanced Powerup Collision**: Powerups can now be collected when player is within 2 grid cells (5x5 area check) for easier collection.
- **Powerup Effects**:
  - **Armor**: Survives one collision (consumes armor instead of dying)
  - **Speed**: Moves twice per tick (double movement speed)
  - **Magnet**: Attracts food within range 3 (with grid wrapping)
- **Multiple Food Items**: Food system now supports 2-5 food items based on player count, dynamically scaling with alive players.

### Bot AI Improvements
- **Smart Targeting**: Bots now actively seek out the closest food items and powerups instead of moving in one direction.
- **Priority System**: Bots prioritize powerups over food (higher value targets).
- **Distance Calculation**: Uses proper Manhattan distance with grid wrapping to find closest targets.
- **Collision Avoidance**: Bots still avoid collisions while actively pursuing targets.

### Chat System
- **Full Chat Functionality**: Added complete chat system to both lobby and in-game.
- **Real-time Messaging**: Messages broadcast to all players in the room via WebSocket.
- **Typing Indicators**: Shows when other players are typing with animated "is typing..." indicator.
- **Auto-scroll**: Chat automatically scrolls to latest messages, but allows manual scrolling for history.
- **Message History**: Limited to last 50 messages per room.

### Fullscreen Mode
- **Browser Fullscreen API**: Fullscreen button now uses native browser fullscreen (like F11) with cross-browser support.
- **Adjustable Sidebar**: Sidebar width adjustable between 15-25% of screen width in fullscreen mode.
- **Resizable Interface**: Drag handle between game board and sidebar for custom sizing.
- **Locked Game Viewport**: Game area locked at 94% height with 3% gaps top/bottom, preventing scrolling.
- **Centered Game Board**: Game board centered in fullscreen mode for optimal viewing.

### UI/UX Improvements
- **Player Name Persistence**: Player names saved to localStorage and automatically loaded on "Play Again".
- **Rematch System**: 
  - 15-second auto-rematch timer after game ends
  - "Play Again" button returns to lobby for immediate rematch
  - Timer display shows countdown
- **Layout Fixes**: 
  - Fixed sidebar overlap in normal mode (left-aligned layout)
  - Consistent background color in fullscreen mode
  - Proper separation between game board and sidebar

### Bug Fixes
- **Host Game Start**: Fixed issue where host was kicked out of lobby when starting game - host now properly receives room update and can play.
- **Fullscreen Duplicate Screens**: Fixed duplicate game board rendering in fullscreen mode.
- **Sidebar Overlap**: Fixed sidebar overlapping game board in smaller windows and normal mode.
- **Score Calculation**: Fixed issue where smaller snakes could have more points - scores now properly reset on death.

### Technical Changes
- **Grid Size**: Changed from 80x80 to 100x100 for better gameplay area.
- **WebSocket Updates**: Enhanced room state management for chat and typing indicators.
- **State Management**: Improved room state synchronization between client and server.

---

## Previous Updates

### Initial Features
- Multiplayer snake game with WebSocket real-time communication
- Room-based gameplay with room codes
- Bot players support
- Powerup system (armor, speed, magnet)
- Multiple food items
- Point system and lives (3 respawns + 1 initial life)
- Clockwise starting directions for players
- Proper snake initialization to prevent immediate collisions
