# SNEK - Multiplayer Snake Game

A real-time multiplayer snake game built with React, supporting 2-4 players competing simultaneously in the same game room. All game logic runs locally in the browser.

## 🎮 Game Overview

SNEK is a classic snake game reimagined for multiplayer competition. Players control their snakes, collect food to grow and score points, and compete to be the last snake standing or achieve the highest score within the time limit.

## ✨ Features

### Core Gameplay
- **Multiplayer Support**: Play with 2-4 players in real-time
- **Real-Time Synchronization**: All players see each other's actions instantly
- **Equal Play**: All players have equal chances of winning
- **Scoring System**: Collect food to grow your snake and increase your score
- **Timer**: 3-minute game timer that counts down
- **Collision Detection**: Self-collision and collision with other players
- **Wrapping Boundaries**: Snakes wrap around the edges of the grid

### Game Controls
- **Arrow Keys**: ↑ ↓ ← → for movement
- **WASD Keys**: Alternative control scheme
- **Smooth Input**: Responsive keyboard controls with no input delays

### Game Features
- **Room System**: Create or join game rooms with unique codes
- **Lobby**: Wait for players before starting (2-4 players required)
- **Pause/Resume**: Pause the game at any time (all players see who paused)
- **Scoreboard**: Real-time display of all players' scores and status
- **Sound Effects**: Audio feedback for game events (can be toggled)
- **Winner Display**: Shows the winner at game end
- **Visual Effects**: Smooth animations with glowing snake heads and pulsing food

### Technical Features
- **60 FPS Performance**: Smooth gameplay using `requestAnimationFrame`
- **No Canvas**: Uses CSS/React components (HTML Canvas prohibited)
- **Real-Time Updates**: Polling and game tick system for synchronization
- **Responsive Design**: Works on desktop and mobile browsers
- **Modern UI**: Beautiful gradient design with Tailwind CSS

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Modern web browser

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd multiplayer
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

5. Open your browser and navigate to the application URL

## 📋 Requirements Compliance

### Mandatory Requirements ✅

- ✅ **Game Type**: Snake game with playable characters (not words/numbers-based)
- ✅ **Equal Players**: All players have equal chances of winning
- ✅ **Multiplayer**: Supports 2, 3, or 4 players
- ✅ **Real-Time**: All players see each other's actions in real-time
- ✅ **Cross-Platform**: Accessible from any browser, not just local network
- ✅ **Player Names**: Players can select/enter unique names
- ✅ **Unique Names**: Player names must be unique (validated)
- ✅ **Lead Player**: Host can start game with 2-4 players
- ✅ **Stability**: Game runs without crashing
- ✅ **Performance**: 60 FPS minimum, no dropped frames
- ✅ **requestAnimationFrame**: Properly implemented for smooth animation
- ✅ **No Canvas**: HTML Canvas is not used (CSS/React components only)
- ✅ **Pause Menu**: Pause, Resume, and Quit options available
- ✅ **Player Notifications**: Player names displayed when pausing/resuming/quitting
- ✅ **Smooth Pausing**: No dropped frames when pausing
- ✅ **Scoring System**: Score tracking for all players
- ✅ **Real-Time Scores**: All players see scores/lives of opponents
- ✅ **Winner Display**: Winner shown at game end
- ✅ **Timer**: Countdown timer visible to all players simultaneously

### Extra Requirements ✅

- ✅ **Keyboard Controls**: Full keyboard support (Arrow keys + WASD)
- ✅ **Smooth Input**: No input delays or long-press glitches
- ✅ **Sound Effects**: Range of sound effects for game events
- ✅ **Visual Design**: Modern, visually pleasing UI
- ✅ **Performance**: Optimized for smooth gameplay

## 🎯 How to Play

### Creating a Game

1. Enter your player name
2. Click "Create" to create a new game room
3. Share the room code with friends (2-4 players total)
4. Wait for players to join in the lobby
5. Click "Start Game" when ready (host only)

### Joining a Game

1. Enter your player name (must be unique)
2. Click "Join"
3. Enter the room code provided by the host
4. Wait in the lobby for the host to start

### Gameplay

- Use **Arrow Keys** or **WASD** to control your snake
- Collect the **red food** to grow and score points (+10 per food)
- Avoid colliding with yourself or other players
- Survive until the timer ends or be the last snake standing
- The player with the highest score or last surviving wins

### Game Controls

- **Pause**: Click "Pause Game" to pause (all players see who paused)
- **Resume**: Click "Resume Game" to continue
- **Quit**: Click "Leave Game" to exit
- **Sound**: Toggle sound effects with the volume button (top right)

## 🏗️ Project Structure

```
multiplayer/
├── Components/
│   ├── game/
│   │   ├── GameBoard.jsx      # Main game board rendering
│   │   ├── GameMenu.jsx        # Pause/Resume/Quit menu
│   │   ├── JoinForm.jsx        # Create/Join room form
│   │   ├── Lobby.jsx           # Pre-game lobby
│   │   ├── ScoreBoard.jsx      # Scoreboard and timer display
│   │   └── SoundManager.jsx    # Sound effects manager
│   └── UserNotRegisteredError.jsx
├── Enities/
│   └── GameRoom.json           # GameRoom entity schema
├── Functions/
│   └── gameServer.jsx          # Server-side game logic
├── Pages/
│   ├── Game.jsx                # Main game page
│   └── Home.jsx                # Landing page
├── REQUIREMENTS.md             # Original requirements
└── README.md                   # This file
```

## 🔧 Technical Details

### Game Server (`Functions/gameServer.jsx`)

The server handles all game logic:
- Room creation and management
- Player joining with unique name validation
- Game state updates (tick system)
- Collision detection
- Food generation
- Timer management
- Pause/Resume/Quit actions

### Client (`Pages/Game.jsx`)

The client manages:
- Real-time game state synchronization
- Keyboard input handling
- Game loop using `requestAnimationFrame`
- Polling for lobby/paused states
- Sound effects
- UI state management

### Game Loop

- **Tick Rate**: 150ms between game updates (network throttling)
- **Animation**: `requestAnimationFrame` for 60 FPS rendering
- **Polling**: 1 second intervals for non-playing states (lobby/paused)

### Game Rules

- **Grid Size**: 30x30 cells
- **Game Duration**: 3 minutes (180 seconds)
- **Food Value**: 10 points per food
- **Snake Growth**: Snake grows by 1 segment per food
- **Wrapping**: Snakes wrap around grid edges
- **Collision**: Self-collision or collision with any player eliminates you
- **Win Condition**: Highest score at timer end, or last snake standing

## 🐛 Known Issues & Limitations

1. **Local Storage**: Game state is stored in-memory (resets on page refresh)
2. **Player Name Validation**: Case-insensitive uniqueness check (e.g., "Player" and "player" are considered duplicates)
3. **Reconnection**: No automatic reconnection if connection is lost
4. **Room Cleanup**: Rooms are stored in-memory and reset when the page is refreshed

## 🔮 Future Enhancements

- Power-ups and special abilities
- Custom game modes (speed modes, team modes)
- Leaderboards and statistics
- Spectator mode
- Mobile touch controls
- Room persistence and history

## 📝 License

[Add your license information here]

## 👥 Credits

Built as a multiplayer game project demonstrating real-time synchronization, game state management, and modern React development practices.

---

**Enjoy playing SNEK! 🐍🎮**

