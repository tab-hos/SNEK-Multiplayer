import React from 'react';
import { Button } from '../ui/button.jsx';
import { Copy, Play, Users, Crown, ArrowLeft, Cpu, X } from 'lucide-react';

export default function Lobby({ room, playerId, onStart, onCopyCode, onLeave, onAddBot, onRemoveBot }) {
  const isHost = room?.host_id === playerId;
  const canStart = room?.players?.length >= 2;
  const botCount = room?.players?.filter(p => p.isBot).length || 0;
  const maxBots = 3;
  const canAddBot = isHost && room?.status === 'waiting' && botCount < maxBots && room?.players?.length < 4;
  const canRemoveBot = isHost && room?.status === 'waiting' && botCount > 0;
  
  // Debug logging (only in development)
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // Room state updated (debug log removed)
      if (false) console.log('[Lobby] Room state:', {
        roomCode: room?.room_code,
        hostId: room?.host_id,
        playerId,
        isHost,
        playersCount: room?.players?.length,
        canStart,
        players: room?.players?.map(p => ({ id: p.id, name: p.name }))
      });
    }
  }, [room, playerId, isHost, canStart]);

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-[#323645] backdrop-blur rounded-2xl p-8 border border-gray-800">
        <h2 className="text-2xl font-bold text-white text-center mb-6">Game Lobby</h2>
        
        {/* Room Code */}
        <div className="mb-6">
          <p className="text-gray-400 text-sm text-center mb-2">Room Code</p>
          <div className="flex items-center justify-center gap-2">
            <span className="text-4xl font-mono font-bold text-[#93B301] tracking-wider">
              {room?.room_code}
            </span>
            <Button
              size="icon"
              variant="ghost"
              onClick={onCopyCode}
              className="text-gray-400 hover:text-white"
            >
              <Copy className="w-5 h-5" />
            </Button>
          </div>
          <p className="text-gray-500 text-xs text-center mt-2">Share this code with friends!</p>
        </div>
        
        {/* Players */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-400 text-sm flex items-center gap-2">
              <Users className="w-4 h-4" />
              Players
            </span>
            <span className="text-gray-500 text-sm">{room?.players?.length || 0}/4</span>
          </div>
          
          <div className="space-y-2">
            {room?.players?.map((player, idx) => (
              <div
                key={player.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/50"
              >
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: player.color, boxShadow: `0 0 10px ${player.color}` }}
                />
                <span className="flex-1 font-medium text-white">
                  {player.name}
                  {player.isBot && <span className="text-xs text-gray-400 ml-2">(Bot)</span>}
                </span>
                {player.id === room.host_id && (
                  <Crown className="w-4 h-4 text-yellow-400" />
                )}
                {player.isBot && (
                  <Cpu className="w-4 h-4 text-purple-400" />
                )}
              </div>
            ))}
            
            {/* Empty slots */}
            {Array.from({ length: 4 - (room?.players?.length || 0) }).map((_, idx) => (
              <div
                key={`empty-${idx}`}
                className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/30 border border-dashed border-gray-700"
              >
                <div className="w-4 h-4 rounded-full bg-gray-700" />
                <span className="text-gray-500">Waiting for player...</span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Start Button */}
        {isHost ? (
          <Button
            onClick={onStart}
            disabled={!canStart}
            className="w-full py-6"
          >
            <Play className="w-5 h-5 mr-2" />
            Start Game
          </Button>
        ) : (
          <div className="text-center text-gray-400 py-4">
            Waiting for host to start...
          </div>
        )}
        
        {!canStart && isHost && (
          <p className="text-amber-400 text-sm text-center mt-3">
            Need at least 2 players to start
          </p>
        )}
        
        {/* Bot Controls (Host only) */}
        {isHost && room?.status === 'waiting' && (
          <div className="mt-4 space-y-2">
            <div className="flex gap-2">
              <Button
                onClick={onAddBot}
                disabled={!canAddBot}
                variant="outline"
                className="flex-1 border-purple-600 text-purple-400 hover:bg-purple-900/20 hover:text-purple-300 disabled:opacity-50"
              >
                <Cpu className="w-4 h-4 mr-2" />
                Add Bot ({botCount}/{maxBots})
              </Button>
              {canRemoveBot && (
                <Button
                  onClick={onRemoveBot}
                  variant="outline"
                  className="border-red-600 text-red-400 hover:bg-red-900/20 hover:text-red-300"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
            {botCount > 0 && (
              <p className="text-xs text-center text-purple-400">
                {botCount} bot{botCount > 1 ? 's' : ''} ready to play
              </p>
            )}
          </div>
        )}
        
        {/* Leave Button */}
        <Button
          onClick={onLeave}
          variant="outline"
          className="w-full mt-4 border-gray-600 text-gray-400 hover:bg-gray-800 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Leave Lobby
        </Button>
      </div>
    </div>
  );
}