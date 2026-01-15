#!/bin/bash
# Simple script to start both server and client

echo "Starting WebSocket server..."
node server/websocketServer.js &
SERVER_PID=$!

echo "Waiting for server to start..."
sleep 2

echo "Starting Vite client..."
npm run dev:client &
CLIENT_PID=$!

echo "Server PID: $SERVER_PID"
echo "Client PID: $CLIENT_PID"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for user interrupt
trap "kill $SERVER_PID $CLIENT_PID 2>/dev/null; exit" INT TERM

wait

