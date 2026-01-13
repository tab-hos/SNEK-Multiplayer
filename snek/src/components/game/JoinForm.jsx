import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button.jsx';
import { Input } from '../ui/input.jsx';
import SNEKlogo from '../../assets/SNEKlogo.png';
import { Plus, LogIn, Gamepad2 } from 'lucide-react';

const PLAYER_NAME_KEY = 'SNEK_playerName';

export default function JoinForm({ onCreateRoom, onJoinRoom, loading }) {
  // Load player name from localStorage on mount
  const [playerName, setPlayerName] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(PLAYER_NAME_KEY) || '';
    }
    return '';
  });
  const [roomCode, setRoomCode] = useState('');
  const [mode, setMode] = useState(null);
  const [error, setError] = useState('');
  
  // Save player name to localStorage when it changes
  useEffect(() => {
    if (playerName.trim() && typeof window !== 'undefined') {
      localStorage.setItem(PLAYER_NAME_KEY, playerName.trim());
    }
  }, [playerName]);

  const handleCreate = () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    setError('');
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(PLAYER_NAME_KEY, playerName.trim());
    }
    onCreateRoom(playerName.trim());
  };

  const handleJoin = () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!roomCode.trim()) {
      setError('Please enter room code');
      return;
    }
    setError('');
    // Save to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(PLAYER_NAME_KEY, playerName.trim());
    }
    onJoinRoom(playerName.trim(), roomCode.trim().toUpperCase());
  };

  return (
    <div className="max-w-md mx-auto text-center">
      <img src={SNEKlogo} alt="SNEK" className="w-30 h-30 mx-auto mb-8"/>  {/* LOGO */}
                  
      <h1 className="text-6xl md:text-8xl font-annie text-white mb-6"> SNEK</h1>

      <div className="rounded-2xl p-8 border border-gray-700">
        {!mode ? (
          <div className="space-y-4">
            <Input
              placeholder="Enter your SNEK-name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="bg-gray-800 border-gray-700 text-white text-center text-lg py-6"
              maxLength={15}
            />
            
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            
            <div className="grid grid-cols-2 gap-3 pt-4">
              <Button
                onClick={() => playerName.trim() ? setMode('create') : setError('Enter your name')}
                className="py-6"
              >
                <Plus className="w-5 h-5 mr-2" />
                Create
              </Button>
              <Button
                onClick={() => playerName.trim() ? setMode('join') : setError('Enter your name')}
                variant="outline"
                className="border-gray-600 text-white hover:bg-gray-800 py-6"
              >
                <LogIn className="w-5 h-5 mr-2" />
                Join
              </Button>
            </div>
          </div>
        ) : mode === 'create' ? (
          <div className="space-y-4">
            <p className="text-gray-400 text-center">Create a new game room</p>
            <div className="p-4 bg-gray-800/50 rounded-lg text-center">
              <span className="text-white">Playing as: </span>
              <span className="text-cyan-400 font-bold">{playerName}</span>
            </div>
            <Button
              onClick={handleCreate}
              disabled={loading}
              className="py-6"
            >
              {loading ? 'Creating...' : 'Create Room'}
            </Button>
            <Button
              onClick={() => setMode(null)}
              variant="ghost"
              className="w-full text-gray-400"
            >
              Back
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-gray-400 text-center">Enter room code to join</p>
            <div className="p-4 bg-gray-800/50 rounded-lg text-center">
              <span className="text-white">Playing as: </span>
              <span className="text-cyan-400 font-bold">{playerName}</span>
            </div>
            <Input
              placeholder="Room Code"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              className="bg-gray-800 border-gray-700 text-white text-center text-2xl font-mono tracking-wider py-6"
              maxLength={6}
            />
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            <Button
              onClick={handleJoin}
              disabled={loading}
              className="py-6"
            >
              {loading ? 'Joining...' : 'Join Room'}
            </Button>
            <Button
              onClick={() => setMode(null)}
              variant="ghost"
              className="w-full text-gray-400"
            >
              Back
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}