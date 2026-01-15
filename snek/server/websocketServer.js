// WebSocket server for SNEK game
import { WebSocketServer } from 'ws';
import http from 'http';
import { fileURLToPath } from 'url';
import { dirname, join, extname } from 'path';
import { readFile } from 'fs/promises';
import { calculateBotDirection } from './botAI.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 3001;
const rooms = new Map();

const server = http.createServer();
const wss = new WebSocketServer({ server });

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  server.on('request', async (req, res) => {
    // Skip WebSocket upgrade requests
    if (req.headers.upgrade === 'websocket') {
      return;
    }
    
    let url = req.url === '/' ? '/index.html' : req.url;
    // Remove query string
    url = url.split('?')[0];
    const filePath = join(__dirname, '../dist', url);
    
    try {
      const content = await readFile(filePath);
      const ext = extname(filePath);
      const contentType = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.ttf': 'font/ttf'
      }[ext] || 'application/octet-stream';
      
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    } catch (error) {
      // If file not found, serve index.html for SPA routing
      if (error.code === 'ENOENT') {
        try {
          const indexPath = join(__dirname, '../dist/index.html');
          const content = await readFile(indexPath);
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(content);
        } catch {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not found');
        }
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Server error');
      }
    }
  });
}

const GRID_SIZE = 40; // Larger play area for better gameplay
const COLORS = ['#DAFE34', '#EB8347', '#68CFFD', '#8E52E0'];
const GAME_DURATION = 180;
const MAX_LIVES = 4; // 3 respawns + 1 initial life = 4 total lives

// Powerup system constants
const POWERUP_TYPES = ['armor', 'speed', 'magnet'];
const POWERUP_DURATION = 5000; // 5 seconds
const POWERUP_SPAWN_CHANCE = 0.15; // 15% chance per tick
const MAX_POWERUPS_ON_BOARD = 2;
const MAX_POWERUPS_PER_PLAYER = 2;
const MAGNET_RANGE = 3; // Range for magnet effect
const SPEED_MULTIPLIER = 0.6; // Speed boost reduces tick delay

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
  // Directions based on starting position to ensure clockwise movement from corners
  // This creates a clockwise perimeter pattern where players move away from center
  // Player 0: top-left (5, 5) -> go right (east) - moves along top edge clockwise
  // Player 1: bottom-right (GRID_SIZE-6, GRID_SIZE-6) -> go left (west) - moves along bottom edge clockwise
  // Player 2: top-right (GRID_SIZE-6, 5) -> go down (south) - moves along right edge clockwise
  // Player 3: bottom-left (5, GRID_SIZE-6) -> go up (north) - moves along left edge clockwise
  // This ensures: top-left->right, top-right->down, bottom-right->left, bottom-left->up
  // All moving clockwise around the perimeter, avoiding head-on collisions
  const dirs = [
    { x: 1, y: 0 },   // Player 0: top-left -> right (east)
    { x: -1, y: 0 },  // Player 1: bottom-right -> left (west)
    { x: 0, y: 1 },   // Player 2: top-right -> down (south)
    { x: 0, y: -1 }   // Player 3: bottom-left -> up (north)
  ];
  return dirs[playerIndex % 4];
}

function createInitialSnake(startPos, direction) {
  // Create snake body segments behind the head based on direction
  // Body should be positioned opposite to the movement direction
  const body1 = {
    x: (startPos.x - direction.x + GRID_SIZE) % GRID_SIZE,
    y: (startPos.y - direction.y + GRID_SIZE) % GRID_SIZE
  };
  const body2 = {
    x: (startPos.x - direction.x * 2 + GRID_SIZE) % GRID_SIZE,
    y: (startPos.y - direction.y * 2 + GRID_SIZE) % GRID_SIZE
  };
  return [startPos, body1, body2];
}

function calculateDistance(pos1, pos2, gridSize) {
  // Calculate Manhattan distance with wrapping
  const dx = Math.min(Math.abs(pos1.x - pos2.x), gridSize - Math.abs(pos1.x - pos2.x));
  const dy = Math.min(Math.abs(pos1.y - pos2.y), gridSize - Math.abs(pos1.y - pos2.y));
  return dx + dy;
}

// Powerup helper functions
function getFoodCount(playerCount) {
  // Max 3 food items on the field at the same time
  return Math.min(3, Math.max(1, playerCount));
}

function createRandomPowerup(occupied = []) {
  const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
  return { 
    ...getRandomPosition(occupied), 
    type, 
    spawnTime: Date.now() 
  };
}

function getActivePowerups(player) {
  if (!player.powerups || !Array.isArray(player.powerups)) return [];
  const now = Date.now();
  return player.powerups.filter(p => (now - p.startTime) < p.duration);
}

function addPowerup(player, type) {
  const now = Date.now();
  const powerup = { type, startTime: now, duration: POWERUP_DURATION };
  let powerups = getActivePowerups(player);
  
  // If player has max powerups, replace the one with least time remaining
  if (powerups.length >= MAX_POWERUPS_PER_PLAYER) {
    const timeRemaining = powerups.map(p => p.duration - (now - p.startTime));
    const minIndex = timeRemaining.indexOf(Math.min(...timeRemaining));
    powerups[minIndex] = powerup;
  } else {
    powerups.push(powerup);
  }
  
  return powerups;
}

function hasPowerup(player, type) {
  return getActivePowerups(player).some(p => p.type === type);
}

function checkMagnet(head, food, range = MAGNET_RANGE) {
  const dx = Math.abs(head.x - food.x);
  const dy = Math.abs(head.y - food.y);
  const wrapDx = Math.min(dx, GRID_SIZE - dx);
  const wrapDy = Math.min(dy, GRID_SIZE - dy);
  return wrapDx <= range && wrapDy <= range;
}

function checkPowerupCollision(head, powerup) {
  // Powerups visually take up 4 grid spaces (2x2 area)
  // Check if head is within 2 cells distance in any direction (5x5 area)
  // This makes it much easier to collect powerups - player can be 1 grid away and still collect
  const powerupX = powerup.x;
  const powerupY = powerup.y;
  
  // Check all 25 positions in a 5x5 grid centered on powerup (handles wrapping)
  for (let dx = -2; dx <= 2; dx++) {
    for (let dy = -2; dy <= 2; dy++) {
      const checkX = (powerupX + dx + GRID_SIZE) % GRID_SIZE;
      const checkY = (powerupY + dy + GRID_SIZE) % GRID_SIZE;
      if (head.x === checkX && head.y === checkY) {
        return true;
      }
    }
  }
  return false;
}

// Create a human player (host or joining player)
function createHumanPlayer(playerIndex, playerId, playerName) {
  const startPos = getStartPosition(playerIndex);
  const direction = getStartDirection(playerIndex);
  return {
    id: playerId,
    name: playerName,
    color: COLORS[playerIndex % 4],
    snake: createInitialSnake(startPos, direction),
    direction: direction,
    score: 0,
    alive: true,
    lives: MAX_LIVES,
    isBot: false
  };
}

// Create a bot player
function createBotPlayer(playerIndex) {
  const startPos = getStartPosition(playerIndex);
  const direction = getStartDirection(playerIndex);
  return {
    id: `bot_${Math.random().toString(36).substr(2, 9)}`,
    name: `Bot ${playerIndex}`,
    color: COLORS[playerIndex % 4],
    snake: createInitialSnake(startPos, direction),
    direction: direction,
    score: 0,
    alive: true,
    lives: MAX_LIVES,
    isBot: true,
    powerups: [],
    foodEaten: 0,
    powerupsCollected: 0
  };
}

function broadcastToRoom(roomCode, message, excludePlayerId = null) {
  const room = rooms.get(roomCode);
  if (!room) {
    if (process.env.DEBUG === 'true') {
      console.log(`[Server] Room ${roomCode} not found for broadcast`);
    }
    return;
  }
  
  // Only log broadcasts in debug mode
  if (process.env.DEBUG === 'true') {
    console.log(`[Server] Broadcasting to room ${roomCode}:`, message.type, `(excluding: ${excludePlayerId})`);
    console.log(`[Server] Room has ${room.clients.size} clients:`, Array.from(room.clients.keys()));
  }
  
  // Stringify message once for all clients (performance optimization)
  const messageString = JSON.stringify(message);
  
  room.clients.forEach((client, pid) => {
    if (pid !== excludePlayerId) {
      if (client.readyState === 1) {
        if (process.env.DEBUG === 'true') {
          console.log(`[Server] Sending to player ${pid}`);
        }
        // Use pre-stringified message for better performance
        client.send(messageString);
      } else {
        if (process.env.DEBUG === 'true') {
          console.log(`[Server] Client ${pid} not ready (state: ${client.readyState})`);
        }
      }
    } else {
      if (process.env.DEBUG === 'true') {
        console.log(`[Server] Skipping excluded player ${pid}`);
      }
    }
  });
}

function handleMessage(ws, playerId, rawMessage) {
  let responseId = null;
  try {
    const parsed = JSON.parse(rawMessage);
    const { action, roomCode, playerName, direction, message } = parsed;
    responseId = parsed.responseId || null;
    
    const sendResponse = (data) => {
      ws.send(JSON.stringify({ ...data, responseId }));
    };
    
    switch (action) {
      case 'createRoom': {
        const code = generateRoomCode();
        const hostPlayer = createHumanPlayer(0, playerId, playerName);
        // Initialize player with powerups array
        hostPlayer.powerups = [];
        hostPlayer.foodEaten = 0;
        hostPlayer.powerupsCollected = 0;
        
        const room = {
          room_code: code,
          host_id: playerId,
          status: 'waiting',
          players: [hostPlayer],
          food: Array.from({ length: getFoodCount(1) }, () => getRandomPosition()),
          powerups: [],
          grid_size: GRID_SIZE,
          timer: GAME_DURATION,
          last_update: Date.now(),
          message: '',
          chat: [],
          typing: {}, // Track who is typing: { playerId: timestamp }
          clients: new Map([[playerId, ws]])
        };
        rooms.set(code, room);
        if (process.env.DEBUG === 'true') {
          console.log(`[Server] Room ${code} created by host ${playerId}, clients: ${Array.from(room.clients.keys())}`);
        }
        sendResponse({ success: true, room });
        break;
      }

      case 'joinRoom': {
        const room = rooms.get(roomCode);
        if (!room) {
          sendResponse({ success: false, error: 'Room not found' });
          return;
        }
        if (room.status !== 'waiting') {
          sendResponse({ success: false, error: 'Game already started' });
          return;
        }
        if (room.players.length >= 4) {
          sendResponse({ success: false, error: 'Room is full' });
          return;
        }
        if (room.players.some(p => p.id === playerId)) {
          room.clients.set(playerId, ws);
          sendResponse({ success: true, room });
          broadcastToRoom(roomCode, { type: 'roomUpdate', room }, playerId);
          return;
        }
        
        if (room.players.some(p => p.name.toLowerCase() === playerName.toLowerCase())) {
          sendResponse({ success: false, error: 'Player name already taken' });
          return;
        }
        
        const playerIndex = room.players.length;
        const newPlayer = createHumanPlayer(playerIndex, playerId, playerName);
        // Initialize player with powerups array
        newPlayer.powerups = [];
        newPlayer.foodEaten = 0;
        newPlayer.powerupsCollected = 0;
        
        room.players.push(newPlayer);
        room.message = `${playerName} joined the game!`;
        room.clients.set(playerId, ws);
        rooms.set(roomCode, room);
        
        if (process.env.DEBUG === 'true') {
          console.log(`[Server] Player ${playerName} (${playerId}) joined room ${roomCode}`);
          console.log(`[Server] Room now has ${room.players.length} players`);
          console.log(`[Server] Room clients: ${Array.from(room.clients.keys())}`);
        }
        
        sendResponse({ success: true, room });
        // Broadcast to ALL clients including host (exclude only the joining player)
        broadcastToRoom(roomCode, { type: 'roomUpdate', room }, playerId);
        break;
      }

      case 'addBot': {
        const room = rooms.get(roomCode);
        if (!room) {
          sendResponse({ success: false, error: 'Room not found' });
          return;
        }
        if (room.host_id !== playerId) {
          sendResponse({ success: false, error: 'Only host can add bots' });
          return;
        }
        if (room.status !== 'waiting') {
          sendResponse({ success: false, error: 'Cannot add bots after game started' });
          return;
        }
        
        // Count existing bots
        const botCount = room.players.filter(p => p.isBot).length;
        const maxBots = 3;
        
        if (botCount >= maxBots) {
          sendResponse({ success: false, error: `Maximum ${maxBots} bots allowed` });
          return;
        }
        
        if (room.players.length >= 4) {
          sendResponse({ success: false, error: 'Room is full' });
          return;
        }
        
        const botPlayer = createBotPlayer(room.players.length);
        room.players.push(botPlayer);
        room.message = `${botPlayer.name} added!`;
        rooms.set(roomCode, room);
        
        sendResponse({ success: true, room });
        broadcastToRoom(roomCode, { type: 'roomUpdate', room }, playerId);
        break;
      }

      case 'removeBot': {
        const room = rooms.get(roomCode);
        if (!room) {
          sendResponse({ success: false, error: 'Room not found' });
          return;
        }
        if (room.host_id !== playerId) {
          sendResponse({ success: false, error: 'Only host can remove bots' });
          return;
        }
        if (room.status !== 'waiting') {
          sendResponse({ success: false, error: 'Cannot remove bots after game started' });
          return;
        }
        
        // Find and remove the last bot
        let botIndex = -1;
        for (let i = room.players.length - 1; i >= 0; i--) {
          if (room.players[i].isBot) {
            botIndex = i;
            break;
          }
        }
        
        if (botIndex === -1) {
          sendResponse({ success: false, error: 'No bots to remove' });
          return;
        }
        
        const removedBot = room.players[botIndex];
        room.players.splice(botIndex, 1);
        room.message = `${removedBot.name} removed`;
        rooms.set(roomCode, room);
        
        sendResponse({ success: true, room });
        broadcastToRoom(roomCode, { type: 'roomUpdate', room }, playerId);
        break;
      }

      case 'startGame': {
        const room = rooms.get(roomCode);
        if (!room) {
          sendResponse({ success: false, error: 'Room not found' });
          return;
        }
        if (room.host_id !== playerId) {
          sendResponse({ success: false, error: 'Only host can start' });
          return;
        }
        
        if (room.players.length < 2) {
          sendResponse({ success: false, error: 'Need at least 2 players to start' });
          return;
        }
        
        // Ensure all players have lives initialized before starting
        // Reinitialize human players and bots properly
        room.players = room.players.map((player, playerIndex) => {
          const startPos = getStartPosition(playerIndex);
          const direction = player.direction || getStartDirection(playerIndex);
          
          // Ensure powerups array exists
          if (!player.powerups) player.powerups = [];
          if (player.foodEaten === undefined) player.foodEaten = 0;
          if (player.powerupsCollected === undefined) player.powerupsCollected = 0;
          
          // If it's a bot, ensure it's properly initialized as a bot
          if (player.isBot) {
            return {
              ...player,
              alive: true,
              lives: player.lives !== undefined ? player.lives : MAX_LIVES,
              snake: player.snake && player.snake.length > 0 ? player.snake : createInitialSnake(startPos, direction),
              direction: direction,
              isBot: true,
              powerups: player.powerups || [],
              foodEaten: player.foodEaten || 0,
              powerupsCollected: player.powerupsCollected || 0
            };
          } else {
            // Human player - ensure proper initialization (similar to host)
            return {
              ...player,
              alive: true,
              lives: player.lives !== undefined ? player.lives : MAX_LIVES,
              snake: player.snake && player.snake.length > 0 ? player.snake : createInitialSnake(startPos, direction),
              direction: direction,
              isBot: false,
              powerups: player.powerups || [],
              foodEaten: player.foodEaten || 0,
              powerupsCollected: player.powerupsCollected || 0
            };
          }
        });
        
        // Initialize food as array and powerups
        const foodCount = getFoodCount(room.players.length);
        const allPositions = room.players.flatMap(p => p.snake || []);
        room.food = Array.isArray(room.food) ? room.food : [];
        while (room.food.length < foodCount) {
          room.food.push(getRandomPosition([...allPositions, ...room.food]));
        }
        if (!room.powerups) room.powerups = [];
        if (!room.chat) room.chat = [];
        if (!room.typing) room.typing = {};
        
        room.status = 'playing';
        room.last_update = Date.now();
        room.game_start_time = Date.now(); // Track when game actually started
        room.message = room.players.some(p => p.isBot) ? 'Game started with bot!' : 'Game started!';
        
        rooms.set(roomCode, room);
        
        broadcastToRoom(roomCode, { type: 'gameStart', room });
        break;
      }

      case 'updateDirection': {
        const room = rooms.get(roomCode);
        if (!room) {
          sendResponse({ success: false, error: 'Room not found' });
          return;
        }
        const playerIdx = room.players.findIndex(p => p.id === playerId);
        if (playerIdx === -1) {
          sendResponse({ success: false, error: 'Player not found' });
          return;
        }
        
        const player = room.players[playerIdx];
        if (!player.alive) {
          sendResponse({ success: false, error: 'Player is dead' });
          return;
        }
        
        const current = player.direction || { x: 0, y: 0 };
        
        // Prevent reversing into self (180 degree turn) - more robust check
        // Check if the new direction is exactly opposite to current direction
        const isOpposite = (direction.x !== 0 && direction.x === -current.x) ||
                          (direction.y !== 0 && direction.y === -current.y);
        
        // Also check if snake would immediately collide with its own body
        // (snake length > 1 means there's a body segment right behind the head)
        if (isOpposite && player.snake && player.snake.length > 1) {
          sendResponse({ success: true, message: 'Cannot reverse direction' });
          return;
        }
        
        // Update direction
        room.players[playerIdx] = { ...player, direction };
        rooms.set(roomCode, room);
        
        sendResponse({ success: true });
        break;
      }

      case 'tick': {
        const room = rooms.get(roomCode);
        if (!room || room.status !== 'playing') {
          sendResponse({ success: true, room });
          return;
        }

        const now = Date.now();
        const elapsed = (now - room.last_update) / 1000;
        const newTimer = Math.max(0, room.timer - elapsed);
        
        // Ensure all players have proper initialization
        // Separate handling for human players vs bots
        room.players = room.players.map((player, idx) => {
          let updatedPlayer = { ...player };
          
          // Initialize lives and alive status
          if (updatedPlayer.lives === undefined) {
            updatedPlayer.lives = MAX_LIVES;
          }
          if (updatedPlayer.alive === undefined) {
            updatedPlayer.alive = true;
          }
          
          // Initialize snake and direction based on player type
          if (!updatedPlayer.snake || updatedPlayer.snake.length === 0) {
            const startPos = getStartPosition(idx);
            const direction = updatedPlayer.direction || getStartDirection(idx);
            updatedPlayer.snake = createInitialSnake(startPos, direction);
          }
          
          if (!updatedPlayer.direction || (updatedPlayer.direction.x === 0 && updatedPlayer.direction.y === 0)) {
            updatedPlayer.direction = getStartDirection(idx);
          }
          
          // Ensure isBot flag is set correctly
          if (updatedPlayer.isBot === undefined) {
            updatedPlayer.isBot = false; // Default to human player
          }
          
          return updatedPlayer;
        });
        
        // Update bot directions before game tick (bots have their own AI logic)
        room.players.forEach((player, idx) => {
          if (player.isBot && player.alive) {
            const newDirection = calculateBotDirection(player, room);
            if (newDirection.x !== player.direction.x || newDirection.y !== player.direction.y) {
              room.players[idx] = { ...player, direction: newDirection };
            }
          }
        });
        
        // Initialize food as array if needed
        let food = Array.isArray(room.food) ? [...room.food] : (room.food ? [room.food] : []);
        let foodEaten = false;
        const eatenFoodIndices = [];
        
        // Update active powerups for all players
        room.players = room.players.map(player => ({
          ...player,
          powerups: getActivePowerups(player)
        }));
        
        // Move all players (human players and bots move the same way, but bots have AI-controlled direction)
        // IMPORTANT: Check food collision after EACH movement step (not just at the end)
        // This fixes the bug where speed powerup causes snake to skip over food
        let updatedPlayers = room.players.map((player, playerIndex) => {
          if (!player.alive) return player;
          
          // Human players: direction comes from user input (already set via updateDirection)
          // Bots: direction was just updated by calculateBotDirection above
          let direction = player.direction;
          if (!direction || (direction.x === 0 && direction.y === 0)) {
            direction = getStartDirection(playerIndex);
            player.direction = direction;
          }
          
          // Ensure player has a valid snake
          if (!player.snake || player.snake.length === 0) {
            const startPos = getStartPosition(playerIndex);
            player.snake = createInitialSnake(startPos, direction);
          }
          
          const head = player.snake[0];
          if (!head) {
            // If no head, create a new snake
            const startPos = getStartPosition(playerIndex);
            player.snake = createInitialSnake(startPos, direction);
            return { ...player, snake: player.snake };
          }
          
          const hasSpeed = hasPowerup(player, 'speed');
          const hasMagnet = hasPowerup(player, 'magnet');
          
          // Move the snake - FIRST movement
          let currentSnake = player.snake;
          const newHead1 = {
            x: (head.x + direction.x + GRID_SIZE) % GRID_SIZE,
            y: (head.y + direction.y + GRID_SIZE) % GRID_SIZE
          };
          currentSnake = [newHead1, ...currentSnake.slice(0, -1)];
          
          // Check food collision after first movement
          let playerFoodEaten = false;
          for (let i = 0; i < food.length; i++) {
            if (eatenFoodIndices.includes(i)) continue;
            
            const canEat = (newHead1.x === food[i].x && newHead1.y === food[i].y) || 
                          (hasMagnet && checkMagnet(newHead1, food[i]));
            
            if (canEat) {
              eatenFoodIndices.push(i);
              foodEaten = true;
              playerFoodEaten = true;
              const tail = currentSnake[currentSnake.length - 1];
              currentSnake = [...currentSnake, tail];
              break; // Only eat one food per tick
            }
          }
          
          // SECOND movement for speed powerup (only for this player)
          if (hasSpeed) {
            const newHead2 = currentSnake[0];
            const secondHead = {
              x: (newHead2.x + direction.x + GRID_SIZE) % GRID_SIZE,
              y: (newHead2.y + direction.y + GRID_SIZE) % GRID_SIZE
            };
            currentSnake = [secondHead, ...currentSnake.slice(0, -1)];
            
            // Check food collision after second movement
            for (let i = 0; i < food.length; i++) {
              if (eatenFoodIndices.includes(i)) continue;
              
              const canEat = (secondHead.x === food[i].x && secondHead.y === food[i].y) || 
                            (hasMagnet && checkMagnet(secondHead, food[i]));
              
              if (canEat) {
                eatenFoodIndices.push(i);
                foodEaten = true;
                playerFoodEaten = true;
                const tail = currentSnake[currentSnake.length - 1];
                currentSnake = [...currentSnake, tail];
                break; // Only eat one food per tick
              }
            }
          }
          
          // Update player with new snake and score if food was eaten
          let updatedPlayer = {
            ...player,
            snake: currentSnake,
            direction: direction
          };
          
          if (playerFoodEaten) {
            updatedPlayer = {
              ...updatedPlayer,
              score: player.score + 10,
              foodEaten: (player.foodEaten || 0) + 1
            };
          }
          
          return updatedPlayer;
        });

        // Remove eaten food and spawn new food to maintain count
        if (eatenFoodIndices.length > 0) {
          const allPositions = updatedPlayers.flatMap(p => p.snake || []);
          food = food.filter((_, i) => !eatenFoodIndices.includes(i));
          const targetCount = getFoodCount(updatedPlayers.filter(p => p.alive).length);
          const occupiedPositions = [...allPositions, ...food, ...(room.powerups || [])];
          while (food.length < targetCount) {
            food.push(getRandomPosition(occupiedPositions));
          }
        }
        
        // Initialize powerups array if needed
        let powerups = Array.isArray(room.powerups) ? [...room.powerups] : [];
        const collectedPowerups = [];
        let powerUpCollected = false;
        
        // Check powerup collection (powerups take up 4 grid spaces, so check 2x2 area)
        // IMPORTANT: For speed powerup, check both head positions to avoid skipping powerups
        updatedPlayers = updatedPlayers.map((player, idx) => {
          if (!player.alive) return player;
          const head = player.snake[0];
          // Check collision at current head position
          for (let i = 0; i < powerups.length; i++) {
            if (collectedPowerups.includes(i)) continue;
            // Check if player's head is within the powerup's 2x2 area (4 grid spaces)
            if (checkPowerupCollision(head, powerups[i])) {
              collectedPowerups.push(i);
              powerUpCollected = true;
              return {
                ...player,
                powerups: addPowerup(player, powerups[i].type),
                powerupsCollected: (player.powerupsCollected || 0) + 1
              };
            }
          }
          return player;
        });
        
        // Remove collected powerups
        if (collectedPowerups.length > 0) {
          powerups = powerups.filter((_, i) => !collectedPowerups.includes(i));
        }
        
        // Spawn new powerups (15% chance per tick, max 2 on board)
        if (Math.random() < POWERUP_SPAWN_CHANCE && powerups.length < MAX_POWERUPS_ON_BOARD) {
          const allPositions = [...updatedPlayers.flatMap(p => p.snake || []), ...food, ...powerups];
          powerups.push(createRandomPowerup(allPositions));
        }

        const allSegments = [];
        updatedPlayers.forEach((p, pIdx) => {
          if (p.alive && p.snake && p.snake.length > 0) {
            p.snake.forEach((seg, sIdx) => {
              allSegments.push({ ...seg, playerIdx: pIdx, segIdx: sIdx });
            });
          }
        });

        updatedPlayers = updatedPlayers.map((player, pIdx) => {
          // Ensure player has lives initialized
          if (player.lives === undefined) {
            player.lives = MAX_LIVES;
          }
          
          // Skip players who are permanently dead
          if (!player.alive && (player.lives || 0) <= 0) return player;
          
          // Skip if player has no snake or empty snake
          if (!player.snake || player.snake.length === 0) {
            // Try to respawn if they have lives
            if ((player.lives || MAX_LIVES) > 0) {
              const startPos = getStartPosition(pIdx);
              const direction = player.direction || getStartDirection(pIdx);
              return {
                ...player,
                alive: true,
                lives: player.lives || MAX_LIVES,
                snake: createInitialSnake(startPos, direction),
                direction: direction
              };
            }
            return player;
          }
          
          const head = player.snake[0];
          if (!head) {
            // If no head, try to respawn if they have lives
            if ((player.lives || MAX_LIVES) > 0) {
              const startPos = getStartPosition(pIdx);
              const direction = player.direction || getStartDirection(pIdx);
              return {
                ...player,
                alive: true,
                lives: player.lives || MAX_LIVES,
                snake: createInitialSnake(startPos, direction),
                direction: direction
              };
            }
            return player;
          }
          
          let shouldDie = false;
          const hasArmor = hasPowerup(player, 'armor');
          
          // Check self collision (skip head itself)
          for (let i = 1; i < player.snake.length; i++) {
            if (head.x === player.snake[i].x && head.y === player.snake[i].y) {
              shouldDie = true;
              break;
            }
          }
          
          // Check collision with other players (including their heads)
          if (!shouldDie) {
            for (const seg of allSegments) {
              if (seg.playerIdx !== pIdx && head.x === seg.x && head.y === seg.y) {
                shouldDie = true;
                break;
              }
            }
          }
          
          if (shouldDie) {
            // If player has armor, consume it instead of dying
            if (hasArmor) {
              const activePowerups = getActivePowerups(player);
              const updatedPowerups = activePowerups.filter(p => p.type !== 'armor');
              return {
                ...player,
                powerups: updatedPowerups
              };
            }
            
            const currentLives = player.lives || MAX_LIVES;
            const newLives = currentLives - 1;
            
            if (newLives > 0) {
              // Respawn player - use pIdx (current index in updatedPlayers array)
              const startPos = getStartPosition(pIdx);
              const direction = getStartDirection(pIdx);
              const respawnedPlayer = {
                ...player,
                alive: true,
                lives: newLives,
                snake: createInitialSnake(startPos, direction),
                direction: direction,
                score: 0, // ALWAYS reset score to 0 on death (player loses all points)
                foodEaten: 0, // Reset food eaten counter
                powerups: [] // Clear powerups on death
              };
              
              return respawnedPlayer;
            } else {
              // Out of lives - permanently dead
              return { 
                ...player, 
                alive: false, 
                lives: 0, 
                score: 0, // ALWAYS reset score to 0 on death
                foodEaten: 0 // Reset food eaten counter
              };
            }
          }
          
          return player;
        });


        // Count players with lives remaining (not just alive, but with lives > 0)
        const playersWithLives = updatedPlayers.filter(p => (p.lives || 0) > 0);
        const alivePlayers = updatedPlayers.filter(p => p.alive);
        let status = room.status;
        let winner = room.winner;
        let message = '';

        // Only end game if timer is up OR if there's only 1 player with lives left AND at least 2 seconds have passed
        // OR if there are 0 players with lives left (all players exhausted all respawns)
        const gameStartTime = room.game_start_time || room.last_update;
        const timeSinceStart = (now - gameStartTime) / 1000;
        const hasPlayedEnough = timeSinceStart >= 2; // At least 2 seconds of gameplay required
        
        if (newTimer <= 0 || (playersWithLives.length === 0) || (playersWithLives.length === 1 && hasPlayedEnough)) {
          status = 'ended';
          if (playersWithLives.length === 1) {
            winner = playersWithLives[0].name;
            message = `${winner} wins by survival!`;
          } else if (playersWithLives.length === 0) {
            // All players out of lives - winner by score
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
            // Timer ran out - winner by score
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
        room.powerups = powerups;
        room.timer = newTimer;
        room.status = status;
        room.winner = winner;
        room.message = message;
        room.last_update = now;
        rooms.set(roomCode, room);

        const result = { 
          success: true, 
          room: { ...room },
          foodEaten,
          powerUpCollected,
          eliminated: updatedPlayers.filter((p, i) => !p.alive && room.players[i]?.alive).map(p => p.name)
        };
        
        // Send response to the requesting player
        sendResponse(result);
        
        // Broadcast game update to all players (including the requester for consistency)
        // Throttle broadcasts to maintain 60 FPS while reducing network load
        // Track last broadcast time per room to throttle updates
        if (!room.lastBroadcast) room.lastBroadcast = 0;
        const timeSinceLastBroadcast = now - room.lastBroadcast;
        // Broadcast at least every 16ms (~60 FPS) for smooth gameplay, or immediately on important events
        const shouldBroadcast = timeSinceLastBroadcast >= 16 || // ~60 FPS for smooth gameplay
                                foodEaten || 
                                powerUpCollected || 
                                result.eliminated.length > 0 ||
                                status !== 'playing';
        
        if (shouldBroadcast) {
          room.lastBroadcast = now;
          // Only send essential data to reduce payload size
          // Minimize data sent - only include what's needed for rendering
          const broadcastData = {
            type: 'gameUpdate',
            room: {
              room_code: room.room_code,
              // Only send essential player data - snake positions, colors, alive status
              players: room.players.map(p => ({
                id: p.id,
                name: p.name,
                color: p.color,
                alive: p.alive,
                snake: p.snake, // Snake positions are essential
                score: p.score,
                lives: p.lives,
                powerups: p.powerups || [] // Active powerups
              })),
              food: room.food,
              powerups: room.powerups,
              timer: room.timer,
              status: room.status,
              winner: room.winner,
              message: room.message,
              grid_size: room.grid_size
            },
            foodEaten,
            powerUpCollected,
            eliminated: result.eliminated
          };
          broadcastToRoom(roomCode, broadcastData);
        }
        break;
      }

      case 'pauseGame': {
        const room = rooms.get(roomCode);
        if (!room) {
          sendResponse({ success: false, error: 'Room not found' });
          return;
        }
        if (room.status !== 'playing') {
          sendResponse({ success: false, error: 'Game is not playing' });
          return;
        }
        const player = room.players.find(p => p.id === playerId);
        
        room.status = 'paused';
        room.message = `${player?.name || 'A player'} paused the game`;
        room.last_update = Date.now(); // Update timestamp to track pause time
        rooms.set(roomCode, room);
        
        sendResponse({ success: true, room });
        broadcastToRoom(roomCode, { type: 'roomUpdate', room });
        break;
      }

      case 'resumeGame': {
        const room = rooms.get(roomCode);
        if (!room) {
          sendResponse({ success: false, error: 'Room not found' });
          return;
        }
        if (room.status !== 'paused') {
          sendResponse({ success: false, error: 'Game is not paused' });
          return;
        }
        const player = room.players.find(p => p.id === playerId);
        
        room.status = 'playing';
        room.last_update = Date.now(); // Reset timestamp for timer calculation
        room.message = `${player?.name || 'A player'} resumed the game`;
        rooms.set(roomCode, room);
        
        sendResponse({ success: true, room });
        broadcastToRoom(roomCode, { type: 'roomUpdate', room });
        break;
      }

      case 'quitGame': {
        const room = rooms.get(roomCode);
        if (!room) return;
        const player = room.players.find(p => p.id === playerId);
        
        const updatedPlayers = room.players.map(p => 
          p.id === playerId ? { ...p, alive: false } : p
        );
        
        room.players = updatedPlayers;
        room.message = `${player?.name || 'A player'} quit the game`;
        room.clients.delete(playerId);
        rooms.set(roomCode, room);
        
        broadcastToRoom(roomCode, { type: 'roomUpdate', room }, playerId);
        break;
      }

      case 'resetToLobby': {
        const room = rooms.get(roomCode);
        if (!room) {
          sendResponse({ success: false, error: 'Room not found' });
          return;
        }
        
        // Reset room to waiting state
        room.status = 'waiting';
        room.message = 'Game ended. Waiting for host to start...';
        room.winner = null;
        room.timer = GAME_DURATION;
        room.game_start_time = null;
        
        // Reset all players to initial state
        room.players = room.players.map((player, idx) => {
          const startPos = getStartPosition(idx);
          const direction = getStartDirection(idx);
          return {
            ...player,
            alive: true,
            lives: MAX_LIVES,
            snake: createInitialSnake(startPos, direction),
            direction: direction,
            score: 0,
            powerups: [],
            foodEaten: 0,
            powerupsCollected: 0
          };
        });
        
        // Clear food and powerups
        room.food = [];
        room.powerups = [];
        
        rooms.set(roomCode, room);
        
        sendResponse({ success: true, room });
        broadcastToRoom(roomCode, { type: 'roomUpdate', room });
        break;
      }

      case 'getRoom': {
        const room = rooms.get(roomCode);
        if (!room) {
          sendResponse({ success: false, error: 'Room not found' });
          return;
        }
        sendResponse({ success: true, room });
        break;
      }

      case 'sendMessage': {
        const room = rooms.get(roomCode);
        if (!room) {
          sendResponse({ success: false, error: 'Room not found' });
          return;
        }
        const player = room.players.find(p => p.id === playerId);
        if (!player) {
          sendResponse({ success: false, error: 'Player not found' });
          return;
        }
        
        const messageText = parsed.message || '';
        if (!messageText.trim()) {
          sendResponse({ success: false, error: 'Message cannot be empty' });
          return;
        }
        
        // Limit chat history to last 50 messages
        if (!room.chat) room.chat = [];
        const chatMessage = {
          id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          playerId: playerId,
          playerName: player.name,
          playerColor: player.color,
          message: messageText.trim(),
          timestamp: Date.now()
        };
        
        room.chat.push(chatMessage);
        if (room.chat.length > 50) {
          room.chat = room.chat.slice(-50); // Keep only last 50 messages
        }
        
        rooms.set(roomCode, room);
        
        // Clear typing status for this player
        if (room.typing && room.typing[playerId]) {
          delete room.typing[playerId];
        }
        
        // Send response to sender with updated room
        sendResponse({ success: true, room });
        // Broadcast to all other players (including sender for consistency)
        broadcastToRoom(roomCode, { type: 'chatMessage', room }, null);
        break;
      }

      case 'typing': {
        const room = rooms.get(roomCode);
        if (!room) {
          sendResponse({ success: false, error: 'Room not found' });
          return;
        }
        const player = room.players.find(p => p.id === playerId);
        if (!player) {
          sendResponse({ success: false, error: 'Player not found' });
          return;
        }
        
        // Initialize typing object if needed
        if (!room.typing) room.typing = {};
        
        const isTyping = parsed.isTyping || false;
        if (isTyping) {
          // Set typing status with timestamp (expires after 3 seconds)
          room.typing[playerId] = Date.now();
        } else {
          // Clear typing status
          delete room.typing[playerId];
        }
        
        rooms.set(roomCode, room);
        
        // Broadcast typing status to all players (except sender)
        broadcastToRoom(roomCode, { type: 'typingUpdate', room }, playerId);
        sendResponse({ success: true });
        break;
      }

      case 'leaveRoom': {
        const room = rooms.get(roomCode);
        if (room) {
          // Remove player from players array and mark as dead
          const playerIndex = room.players.findIndex(p => p.id === playerId);
          if (playerIndex !== -1) {
            const player = room.players[playerIndex];
            // Remove player from array completely
            room.players.splice(playerIndex, 1);
            room.message = `${player?.name || 'A player'} left the game`;
          }
          
          // Remove client connection
          room.clients.delete(playerId);
          
          if (room.clients.size === 0) {
            // No more clients, delete the room
            rooms.delete(roomCode);
          } else {
            // Update room and broadcast to remaining players
            rooms.set(roomCode, room);
            broadcastToRoom(roomCode, { type: 'roomUpdate', room }, playerId);
          }
        }
        sendResponse({ success: true, left: true });
        break;
      }
    }
  } catch (error) {
    console.error('Error handling message:', error);
    try {
      const parsed = typeof rawMessage === 'string' ? JSON.parse(rawMessage) : rawMessage;
      const errorResponseId = parsed?.responseId || responseId;
      ws.send(JSON.stringify({ success: false, error: error.message, responseId: errorResponseId }));
    } catch {
      ws.send(JSON.stringify({ success: false, error: error.message, responseId }));
    }
  }
}

wss.on('connection', (ws, req) => {
  // Store a temporary ID, will be replaced by client's playerId on first message
  let serverPlayerId = `player_${Math.random().toString(36).substr(2, 9)}`;
  ws.playerId = serverPlayerId;
  
  // Only log connections in debug mode (set DEBUG=true to see)
  if (process.env.DEBUG === 'true') {
    console.log(`[WebSocket] Client connected: ${serverPlayerId}`);
  }
  
  // Handle ping/pong keepalive for Render.com
  ws.on('message', (message) => {
    const msgStr = message.toString();
    
    // Handle ping/pong keepalive
    if (msgStr === 'ping') {
      try {
        ws.send('pong');
      } catch (error) {
        console.error('[WebSocket] Error sending pong:', error);
      }
      return;
    }
    
    // Use the playerId from the message (client's playerId)
    // This ensures consistency between client and server
    try {
      const parsed = JSON.parse(msgStr);
      const clientPlayerId = parsed.playerId || serverPlayerId;
      handleMessage(ws, clientPlayerId, msgStr);
    } catch {
      // Fallback to server ID if message can't be parsed
      handleMessage(ws, serverPlayerId, msgStr);
    }
  });
  
  ws.on('close', () => {
    // Only log disconnections in debug mode
    if (process.env.DEBUG === 'true') {
      console.log(`[WebSocket] Client disconnected: ${serverPlayerId}`);
    }
    // Clean up disconnected clients from rooms
    rooms.forEach((room, code) => {
      if (room.clients.has(serverPlayerId)) {
        // Remove player from players array
        const playerIndex = room.players.findIndex(p => p.id === serverPlayerId);
        if (playerIndex !== -1) {
          const player = room.players[playerIndex];
          room.players.splice(playerIndex, 1);
          room.message = `${player?.name || 'A player'} disconnected`;
        }
        
        // Remove client connection
        room.clients.delete(serverPlayerId);
        
        if (room.clients.size === 0) {
          rooms.delete(code);
        } else {
          rooms.set(code, room);
          broadcastToRoom(code, { type: 'roomUpdate', room }, serverPlayerId);
        }
      }
    });
  });
  
  ws.on('error', (error) => {
    console.error(`[WebSocket] Error for ${serverPlayerId}:`, error);
  });
});

server.listen(PORT, () => {
  const protocol = process.env.NODE_ENV === 'production' ? 'http' : 'ws';
  console.log(`Server running on ${protocol}://localhost:${PORT}`);
  if (process.env.NODE_ENV === 'production') {
    console.log(`Serving static files from dist/`);
  }
});

