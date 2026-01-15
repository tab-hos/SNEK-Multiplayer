# Deployment Guide for Render

This guide explains how to deploy the SNEK game to Render.

## Prerequisites

1. A Render account (sign up at https://render.com)
2. Your code pushed to a Git repository (GitHub, GitLab, or Bitbucket)

## Setup Steps

### 1. Install Yarn (if not already installed)

In your WSL terminal, run:
```bash
npm install -g yarn
```

Or install yarn using one of these methods:
- Using npm: `npm install -g yarn`
- Using corepack (Node 16.10+): `corepack enable` then `corepack prepare yarn@stable --activate`

### 2. Generate yarn.lock

Run this command in your project directory:
```bash
yarn install
```

This will create a `yarn.lock` file that Render will use for dependency management.

### 3. Deploy to Render

#### Option A: Using render.yaml (Recommended)

1. Push your code (including `render.yaml`) to your Git repository
2. Go to Render Dashboard → New → Blueprint
3. Connect your repository
4. Render will automatically detect `render.yaml` and configure the service

#### Option B: Manual Setup

1. Go to Render Dashboard → New → Web Service
2. Connect your Git repository
3. Configure the service:
   - **Name**: `snek-game` (or your preferred name)
   - **Environment**: `Node`
   - **Build Command**: `yarn install && yarn build`
   - **Start Command**: `yarn start`
   - **Environment Variables**:
     - `NODE_ENV`: `production`
     - `PORT`: (automatically set by Render)

4. Click "Create Web Service"

### 4. Environment Variables

The following environment variables are automatically handled:
- `NODE_ENV`: Set to `production` by the start script
- `PORT`: Automatically provided by Render

If you need to customize the WebSocket URL, you can set:
- `VITE_WS_URL`: Custom WebSocket URL (defaults to auto-detection based on current host)

### 5. Build and Deploy

Render will automatically:
1. Install dependencies using `yarn install`
2. Build the frontend using `yarn build` (creates `dist/` folder)
3. Start the server using `yarn start`

The server will:
- Serve static files from the `dist/` folder
- Handle WebSocket connections on the same port
- Automatically detect `ws://` vs `wss://` based on the connection protocol

## Local Testing

To test the production build locally:

```bash
# Build the frontend
yarn build

# Start the production server
NODE_ENV=production yarn start
```

The server will run on `http://localhost:3001` (or the port specified in `PORT` env var).

## Troubleshooting

### Build Fails
- Check that all dependencies are listed in `package.json`
- Ensure `yarn.lock` is committed to your repository
- Check Render build logs for specific errors

### WebSocket Connection Fails
- Ensure the server is running in production mode (`NODE_ENV=production`)
- Check that Render is using HTTPS (WebSockets will automatically use WSS)
- Verify the `VITE_WS_URL` environment variable if you set a custom URL

### Static Files Not Loading
- Verify that `yarn build` completed successfully
- Check that the `dist/` folder exists and contains built files
- Ensure the server is running with `NODE_ENV=production`

## Notes

- The `dist/` folder is created by Vite during the build process
- The server serves both HTTP (static files) and WebSocket connections on the same port
- In production, WebSocket connections automatically use `wss://` when served over HTTPS
- The server uses the `PORT` environment variable provided by Render

