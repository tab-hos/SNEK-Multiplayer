// Local game server implementation
// Handles all game logic and state management using localStorage for cross-tab sharing

const GRID_SIZE = 30;
const COLORS = ['#00FFFF', '#FF00FF', '#00FF00', '#FF8800'];
const GAME_DURATION = 180; // 3 minutes
const STORAGE_KEY = 'SNEK_rooms';

// Room storage using localStorage for cross-tab sharing
function getRooms() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? new Map(JSON.parse(stored).map(([k, v]) => [k, v])) : new Map();
  } catch (e) {
    console.error('Error reading rooms from localStorage:', e);
    return new Map();
  }
}

function saveRooms(rooms) {
  try {
    // Convert Map to array for JSON serialization
    const array = Array.from(rooms.entries());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(array));
    // Broadcast to other tabs
    window.dispatchEvent(new StorageEvent('storage', {
      key: STORAGE_KEY,
      newValue: JSON.stringify(array)
    }));
  } catch (e) {
    console.error('Error saving rooms to localStorage:', e);
  }
}

// Listen for storage changes from other tabs
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      // Rooms updated in another tab, trigger a refresh if needed
      console.log('[Game Server] Rooms updated in another tab');
    }
  });
}

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function getRandomPosition(occupied = []) {
  let pos;
  let attempts = 0;
  const maxAttempts = GRID_SIZE * GRID_SIZE * 2;
  
  do {
    pos = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE)
    };
    attempts++;
    if (attempts >= maxAttempts) {
      for (let x = 0; x < GRID_SIZE; x++) {
        for (let y = 0; y < GRID_SIZE; y++) {
          if (!occupied.some(o => o.x === x && o.y === y)) {
            return { x, y };
          }
        }
      }
      return pos;
    }
  } while (occupied.some(o => o.x === pos.x && o.y === pos.y));
  return pos;
}

function getStartPosition(playerIndex) {
  const positions = [
    { x: 5, y: 5 },
    { x: GRID_SIZE - 6, y: GRID_SIZE - 6 },
    { x: GRID_SIZE - 6, y: 5 },
    { x: 5, y: GRID_SIZE - 6 }
  ];
  return positions[playerIndex % 4];
}

function getStartDirection(playerIndex) {
  const dirs = [
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 }
  ];
  return dirs[playerIndex % 4];
}

export async function mockGameServer(action, params) {
  const { roomCode, playerName, playerId, direction } = params;

  switch (action) {
    case 'createRoom': {
      const rooms = getRooms();
      const code = generateRoomCode();
      const startPos = getStartPosition(0);
      const room = {
        id: `room_${Date.now()}`,
        room_code: code,
        host_id: playerId,
        status: 'waiting',
        players: [{
          id: playerId,
          name: playerName,
          color: COLORS[0],
          snake: [startPos, { x: startPos.x - 1, y: startPos.y }, { x: startPos.x - 2, y: startPos.y }],
          direction: getStartDirection(0),
          score: 0,
          alive: true
        }],
        food: getRandomPosition(),
        grid_size: GRID_SIZE,
        timer: GAME_DURATION,
        last_update: Date.now(),
        message: ''
      };
      rooms.set(code, room);
      saveRooms(rooms);
      return { success: true, room };
    }

    case 'joinRoom': {
      const rooms = getRooms();
      const room = rooms.get(roomCode);
      if (!room) {
        return { success: false, error: 'Room not found' };
      }
      if (room.status !== 'waiting') {
        return { success: false, error: 'Game already started' };
      }
      if (room.players.length >= 4) {
        return { success: false, error: 'Room is full' };
      }
      if (room.players.some(p => p.id === playerId)) {
        return { success: true, room };
      }
      
      // Check for duplicate player names
      if (room.players.some(p => p.name.toLowerCase() === playerName.toLowerCase())) {
        return { success: false, error: 'Player name already taken' };
      }
      
      const playerIndex = room.players.length;
      const startPos = getStartPosition(playerIndex);
      const newPlayer = {
        id: playerId,
        name: playerName,
        color: COLORS[playerIndex],
        snake: [startPos, { x: startPos.x - 1, y: startPos.y }, { x: startPos.x - 2, y: startPos.y }],
        direction: getStartDirection(playerIndex),
        score: 0,
        alive: true
      };
      
      room.players.push(newPlayer);
      room.message = `${playerName} joined the game!`;
      rooms.set(roomCode, room);
      saveRooms(rooms);
      return { success: true, room };
    }

    case 'startGame': {
      const rooms = getRooms();
      const room = rooms.get(roomCode);
      if (!room) {
        return { success: false, error: 'Room not found' };
      }
      if (room.host_id !== playerId) {
        return { success: false, error: 'Only host can start' };
      }
      if (room.players.length < 2) {
        return { success: false, error: 'Need at least 2 players' };
      }
      
      room.status = 'playing';
      room.last_update = Date.now();
      room.message = 'Game started!';
      rooms.set(roomCode, room);
      saveRooms(rooms);
      return { success: true, room };
    }

    case 'updateDirection': {
      const rooms = getRooms();
      const room = rooms.get(roomCode);
      if (!room) {
        return { success: false, error: 'Room not found' };
      }
      const playerIdx = room.players.findIndex(p => p.id === playerId);
      if (playerIdx === -1) return { success: false };
      
      const player = room.players[playerIdx];
      const current = player.direction;
      
      // Prevent 180-degree turns
      if ((direction.x !== 0 && direction.x === -current.x) ||
          (direction.y !== 0 && direction.y === -current.y)) {
        return { success: true, room };
      }
      
      room.players[playerIdx] = { ...player, direction };
      rooms.set(roomCode, room);
      saveRooms(rooms);
      return { success: true };
    }

    case 'tick': {
      const rooms = getRooms();
      const room = rooms.get(roomCode);
      if (!room) {
        return { success: false, error: 'Room not found' };
      }
      
      if (room.status !== 'playing') {
        return { success: true, room };
      }

      const now = Date.now();
      const elapsed = (now - room.last_update) / 1000;
      const newTimer = Math.max(0, room.timer - elapsed);
      
      let updatedPlayers = room.players.map(player => {
        if (!player.alive) return player;
        
        const head = player.snake[0];
        const newHead = {
          x: (head.x + player.direction.x + GRID_SIZE) % GRID_SIZE,
          y: (head.y + player.direction.y + GRID_SIZE) % GRID_SIZE
        };
        
        return {
          ...player,
          snake: [newHead, ...player.snake.slice(0, -1)]
        };
      });

      // Check food collision
      let food = room.food;
      let foodEaten = false;
      let eaterIndex = -1;
      
      updatedPlayers = updatedPlayers.map((player, idx) => {
        if (!player.alive) return player;
        const head = player.snake[0];
        if (head.x === food.x && head.y === food.y) {
          foodEaten = true;
          eaterIndex = idx;
          const tail = player.snake[player.snake.length - 1];
          return {
            ...player,
            snake: [...player.snake, tail],
            score: player.score + 10
          };
        }
        return player;
      });

      if (foodEaten) {
        const allPositions = updatedPlayers.flatMap(p => p.snake);
        food = getRandomPosition(allPositions);
      }

      // Check collisions
      const allSegments = [];
      updatedPlayers.forEach((p, pIdx) => {
        if (p.alive) {
          p.snake.forEach((seg, sIdx) => {
            allSegments.push({ ...seg, playerIdx: pIdx, segIdx: sIdx });
          });
        }
      });

      updatedPlayers = updatedPlayers.map((player, pIdx) => {
        if (!player.alive) return player;
        const head = player.snake[0];
        
        // Self collision (skip head)
        for (let i = 1; i < player.snake.length; i++) {
          if (head.x === player.snake[i].x && head.y === player.snake[i].y) {
            return { ...player, alive: false };
          }
        }
        
        // Other player collision
        for (const seg of allSegments) {
          if (seg.playerIdx !== pIdx && head.x === seg.x && head.y === seg.y) {
            return { ...player, alive: false };
          }
        }
        
        return player;
      });

      // Check game end
      const alivePlayers = updatedPlayers.filter(p => p.alive);
      let status = room.status;
      let winner = room.winner;
      let message = '';

      if (newTimer <= 0 || alivePlayers.length <= 1) {
        status = 'ended';
        if (alivePlayers.length === 1) {
          winner = alivePlayers[0].name;
          message = `${winner} wins by survival!`;
        } else if (alivePlayers.length === 0) {
          if (updatedPlayers.length > 0) {
            const highScore = Math.max(...updatedPlayers.map(p => p.score));
            const winners = updatedPlayers.filter(p => p.score === highScore);
            winner = (winners[0] && winners[0].name) || 'No one';
            message = winners.length > 0 ? `${winner} wins with ${highScore} points!` : 'No winner!';
          } else {
            winner = 'No one';
            message = 'No winner!';
          }
        } else {
          if (updatedPlayers.length > 0) {
            const highScore = Math.max(...updatedPlayers.map(p => p.score));
            const winners = updatedPlayers.filter(p => p.score === highScore);
            winner = (winners[0] && winners[0].name) || 'No one';
            message = winners.length > 0 ? `Time's up! ${winner} wins with ${highScore} points!` : "Time's up! No winner!";
          } else {
            winner = 'No one';
            message = "Time's up! No winner!";
          }
        }
      }

      room.players = updatedPlayers;
      room.food = food;
      room.timer = newTimer;
      room.status = status;
      room.winner = winner;
      room.message = message;
      room.last_update = now;
      rooms.set(roomCode, room);
      saveRooms(rooms);

      return { 
        success: true, 
        room: { ...room },
        foodEaten,
        eaterIndex,
        eliminated: updatedPlayers.filter((p, i) => !p.alive && room.players[i]?.alive).map(p => p.name)
      };
    }

    case 'pauseGame': {
      const rooms = getRooms();
      const room = rooms.get(roomCode);
      if (!room) return { success: false };
      const player = room.players.find(p => p.id === playerId);
      
      room.status = 'paused';
      room.message = `${player?.name || 'A player'} paused the game`;
      rooms.set(roomCode, room);
      saveRooms(rooms);
      
      return { success: true, room: { ...room } };
    }

    case 'resumeGame': {
      const rooms = getRooms();
      const room = rooms.get(roomCode);
      if (!room) return { success: false };
      const player = room.players.find(p => p.id === playerId);
      
      room.status = 'playing';
      room.last_update = Date.now();
      room.message = `${player?.name || 'A player'} resumed the game`;
      rooms.set(roomCode, room);
      saveRooms(rooms);
      
      return { success: true, room: { ...room } };
    }

    case 'quitGame': {
      const rooms = getRooms();
      const room = rooms.get(roomCode);
      if (!room) return { success: false };
      const player = room.players.find(p => p.id === playerId);
      
      const updatedPlayers = room.players.map(p => 
        p.id === playerId ? { ...p, alive: false } : p
      );
      
      room.players = updatedPlayers;
      room.message = `${player?.name || 'A player'} quit the game`;
      rooms.set(roomCode, room);
      saveRooms(rooms);
      
      return { success: true, room: { ...room } };
    }

    case 'getRoom': {
      const rooms = getRooms();
      const room = rooms.get(roomCode);
      if (!room) {
        return { success: false, error: 'Room not found' };
      }
      return { success: true, room: { ...room } };
    }

    default:
      return { success: false, error: 'Unknown action' };
  }
}

