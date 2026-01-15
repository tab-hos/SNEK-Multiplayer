import React from 'react';
import { Button } from '../ui/button.jsx';
import { Play, Pause, LogOut, RotateCcw } from 'lucide-react';

export default function GameMenu({ 
  status, 
  onPause, 
  onResume, 
  onQuit, 
  onPlayAgain,
  winner,
  message,
  room,
  playerId
}) {
  // Check if current player can resume (only the one who paused)
  const canResume = status === 'paused' && room?.paused_by === playerId;
  return (
    <div
      className="bg-[#323645] rounded-xl"
      style={{ padding: 'clamp(8px, 1.2vh, 16px)' }}
    >
      <h3 className="text-base font-bold text-white mb-2 text-center">Game Menu</h3>
      
      {message && (
        <div className="mb-2 p-2 bg-[#222531] rounded-lg text-center">
          <p className="text-[#CF5A16] text-sm">{message}</p>
        </div>
      )}
      
      {winner && (
        <div className="mb-2 p-3 bg-gradient-to-r from-yellow-500/20 to-amber-500/20 rounded-lg text-center border border-yellow-500/30">
          <p className="text-yellow-400 font-bold text-lg">🏆 {winner} Wins!</p>
        </div>
      )}
      
      <div className="space-y-2">
        {status === 'playing' && (
          <Button
            onClick={onPause}
            className="w-full bg-amber-600 hover:bg-amber-700 h-9"
          >
            <Pause className="w-4 h-4 mr-2" />
            Pause Game
          </Button>
        )}
        
        {status === 'paused' && (
          <Button
            onClick={onResume}
            disabled={!canResume}
            className="w-full !bg-[#93B301] hover:!bg-[#627703] !text-white hover:!text-white transition-colors h-9 disabled:opacity-50 disabled:cursor-not-allowed"
            title={!canResume ? 'Only the player who paused can resume' : 'Resume Game'}
          >
            <Play className="w-4 h-4 mr-2" />
            {canResume ? 'Resume Game' : 'Waiting for pauser to resume...'}
          </Button>
        )}
        
        {status === 'ended' && (
          <>
            <Button
              onClick={onPlayAgain}
              className="w-full !bg-[#93B301] hover:!bg-[#627703] text-white h-9"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Back to Lobby
            </Button>
          </>
        )}
        
        <Button
          onClick={onQuit}
          variant="outline"
          className="w-full border-red-500/50 text-red-400 hover:bg-red-500/20 h-9"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Leave Game
        </Button>
      </div>
      
      {/* Controls help */}
      <div className="mt-3 pt-3">
        <p className="text-xs text-gray-400 text-center mb-2">Controls</p>
        <div className="flex justify-center gap-1">
          <kbd className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-300">↑</kbd>
          <kbd className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-300">↓</kbd>
          <kbd className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-300">←</kbd>
          <kbd className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-300">→</kbd>
        </div>
        <p className="text-xs text-gray-500 text-center mt-2">or WASD</p>
      </div>
    </div>
  );
}