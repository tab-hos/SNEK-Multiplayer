# Quick Start Guide

## 🚀 Getting Started

### Step 1: Install Dependencies ⚠️ IMPORTANT

**You MUST run this first!** In your WSL terminal, run:
```bash
npm install
```

This will install:
- `ws` - WebSocket server library
- `concurrently` - To run both server and client together
- All other React and build dependencies

**If you see "concurrently: not found" error, it means you haven't run `npm install` yet!**

### Step 2: Start the Application

**Option A: Run separately (Recommended - Most Reliable)**

Open **Terminal 1** (WebSocket Server):
```bash
npm run dev:server
```

Open **Terminal 2** (Vite Client):
```bash
npm run dev:client
```

**Option B: Run together (requires concurrently)**
```bash
npm run dev
```

This is the same as `npm run dev:both` - runs both server and client together.

**Option C: Simple script (Linux/WSL)**
```bash
chmod +x start.sh
./start.sh
```

This will start:
- ✅ WebSocket server on `ws://localhost:3001`
- ✅ Vite dev server on `http://localhost:5173`

### Step 3: Open the Game

1. Open your browser to `http://localhost:5173`
2. Create a room or join an existing one
3. Share the room code with friends (they need to be on the same network or use your IP)

## 🌐 Online Multiplayer

### For Local Network Play

1. Find your local IP address:
   ```bash
   # Linux/WSL
   hostname -I
   # or
   ip addr show
   ```

2. Update WebSocket URL in `.env` file:
   ```
   VITE_WS_URL=ws://YOUR_IP:3001
   ```

3. Friends can access: `http://YOUR_IP:5173`

### For Internet Play

You'll need to:
1. Deploy the WebSocket server to a hosting service
2. Update `VITE_WS_URL` to point to your deployed server
3. Deploy the frontend or use a service like Vercel/Netlify

## 🐛 Troubleshooting

### "concurrently: not found"
Run `npm install` to install dependencies.

### "WebSocket connection failed"
- Make sure the WebSocket server is running
- Check that port 3001 is not in use
- Verify firewall settings allow port 3001

### "Cannot find module 'ws'"
Run `npm install` to install all dependencies.

### Port Already in Use
If port 3001 is taken, you can change it in `server/websocketServer.js`:
```javascript
const PORT = 3001; // Change this
```

## 📝 Notes

- The WebSocket server stores rooms in memory (resets on server restart)
- For production, consider adding:
  - Database for room persistence
  - Authentication
  - Rate limiting
  - HTTPS/WSS support

