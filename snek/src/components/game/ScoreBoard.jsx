import React from 'react';
import { Trophy, Skull, Clock, Heart } from 'lucide-react';

export default function Scoreboard({ players, timer }) {
  const sortedPlayers = [...(players || [])].sort((a, b) => b.score - a.score);
  
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-[#323645] rounded-xl p-4">
      {/* Timer */}
      <div className="flex items-center justify-center gap-2 mb-4 pb-3">
        <Clock className="w-5 h-5 text-white" />
        <span className="text-2xl font-mono font-bold text-white">
          {formatTime(timer || 0)}
        </span>
      </div>
      
      {/* Players */}
      <div className="space-y-2">
        {sortedPlayers.map((player, idx) => (
          <div
            key={player.id}
            className={`flex items-center gap-3 p-2 rounded-lg transition-all ${
              !player.alive ? 'opacity-50' : ''
            }`}
            style={{ backgroundColor: `${player.color}15` }}
          >
            <div className="flex items-center justify-center w-6">
              {idx === 0 && player.score > 0 ? (
                <Trophy className="w-4 h-4 text-yellow-400" />
              ) : !player.alive ? (
                <Skull className="w-4 h-4 text-red-400" />
              ) : (
                <span className="text-gray-500 text-sm">{idx + 1}</span>
              )}
            </div>
            
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: player.color, boxShadow: `0 0 8px ${player.color}` }}
            />
            
            <span className="flex-1 font-medium text-white truncate">
              {player.name}
            </span>
            
            {/* Lives */}
            <div className="flex items-center gap-1 mr-2">
              {Array.from({ length: player.lives || 0 }).map((_, i) => (
                <Heart
                  key={i}
                  className="w-3 h-3"
                  style={{ color: player.color, fill: player.color }}
                />
              ))}
            </div>
            
            {/* Active Powerups */}
            {player.alive && player.powerups && player.powerups.length > 0 && (
              <div className="flex items-center gap-1 mr-2">
                {player.powerups.map((powerup, i) => {
                  const icons = { armor: '🛡️', speed: '⚡', magnet: '🧲' };
                  const now = Date.now();
                  const isActive = (now - powerup.startTime) < powerup.duration;
                  if (!isActive) return null;
                  return (
                    <span key={i} className="text-sm" title={powerup.type}>
                      {icons[powerup.type] || '?'}
                    </span>
                  );
                })}
              </div>
            )}
            
            <span className="font-mono font-bold" style={{ color: player.color }}>
              {player.score}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}