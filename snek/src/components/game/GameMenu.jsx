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
  rematchTimer
}) {
  return (
    <div className="bg-[#323645] rounded-xl p-4">
      <h3 className="text-lg font-bold text-white mb-4 text-center">Game Menu</h3>
      
      {message && (
        <div className="mb-4 p-3 bg-[#222531] rounded-lg text-center">
          <p className="text-[#CF5A16] text-sm">{message}</p>
        </div>
      )}
      
      {winner && (
        <div className="mb-4 p-4 bg-gradient-to-r from-yellow-500/20 to-amber-500/20 rounded-lg text-center border border-yellow-500/30">
          <p className="text-yellow-400 font-bold text-lg">🏆 {winner} Wins!</p>
        </div>
      )}
      
      <div className="space-y-2">
        {status === 'playing' && (
          <Button
            onClick={onPause}
            className="w-full bg-amber-600 hover:bg-amber-700"
          >
            <Pause className="w-4 h-4 mr-2" />
            Pause Game
          </Button>
        )}
        
        {status === 'paused' && (
          <Button
            onClick={onResume}
            className="w-full !bg-[#93B301] hover:!bg-[#627703] !text-white hover:!text-white transition-colors"

          >
            <Play className="w-4 h-4 mr-2" />
            Resume Game
          </Button>
        )}
        
        {status === 'ended' && (
          <>
            <Button
              onClick={onPlayAgain}
              className="w-full !bg-[#93B301] hover:!bg-[#627703] text-white"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Play Again
            </Button>
            {rematchTimer !== null && rematchTimer > 0 && (
              <p className="text-center text-sm text-gray-400 mt-2">
                Auto-rematch in {rematchTimer}s
              </p>
            )}
          </>
        )}
        
        <Button
          onClick={onQuit}
          variant="outline"
          className="w-full border-red-500/50 text-red-400 hover:bg-red-500/20"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Leave Game
        </Button>
      </div>
      
      {/* Controls help */}
      <div className="mt-4 pt-4">
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