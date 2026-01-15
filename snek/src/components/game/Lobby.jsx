import React from 'react';
import { Button } from '../ui/button.jsx';
import { Copy, Play, Users, Crown, ArrowLeft, Cpu, X, Check } from 'lucide-react';

export default function Lobby({ room, playerId, onStart, onCopyCode, onLeave, onAddBot, onRemoveBot, onToggleReady }) {
  const isHost = room?.host_id === playerId;
  const canStart = room?.players?.length >= 2;
  
  // Check if all human players (excluding host) are ready
  // Host doesn't need to be ready since they start the game
  // Bots are always ready, so they don't need to be checked
  const guestPlayers = room?.players?.filter(p => !p.isBot && p.id !== room?.host_id) || [];
  // If there are no guest players (only host + bots), allReady is true
  // Otherwise, check if all guest players have ready === true (handle undefined as false)
  const allReady = guestPlayers.length === 0 || guestPlayers.every(p => p.ready === true);
  
  // Debug logging
  if (process.env.NODE_ENV === 'development') {
    console.log('[Lobby] Ready check:', {
      totalPlayers: room?.players?.length,
      guestPlayers: guestPlayers.length,
      guestPlayersDetails: guestPlayers.map(p => ({ name: p.name, ready: p.ready })),
      allReady,
      canStart,
      bots: room?.players?.filter(p => p.isBot).length
    });
  }
  const currentPlayer = room?.players?.find(p => p.id === playerId);
  const isReady = currentPlayer?.ready === true;
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
                  <>
                    <Cpu className="w-4 h-4 text-purple-400" />
                    <Check className="w-4 h-4 text-green-400" title="Bot (Always Ready)" />
                  </>
                )}
                {!player.isBot && player.ready && (
                  <Check className="w-4 h-4 text-green-400" />
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
        
        {/* Start Button / Ready Button */}
        {isHost ? (
          <>
            <Button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                // Double-check conditions before calling onStart
                if (!canStart || !allReady) {
                  console.warn('[Lobby] Start button clicked but conditions not met', { 
                    canStart, 
                    allReady, 
                    guestPlayers: guestPlayers.length,
                    guestPlayersReady: guestPlayers.filter(p => p.ready).length,
                    players: room?.players?.map(p => ({ name: p.name, isBot: p.isBot, ready: p.ready }))
                  });
                  return;
                }
                console.log('[Lobby] Start button clicked - starting game', { 
                  canStart, 
                  allReady, 
                  guestPlayers: guestPlayers.length
                });
                if (onStart) {
                  onStart();
                } else {
                  console.error('[Lobby] onStart handler is not provided!');
                }
              }}
              disabled={!canStart || !allReady}
              className={`w-full py-6 ${(!canStart || !allReady) ? 'opacity-50 cursor-not-allowed' : ''}`}
              type="button"
            >
              <Play className="w-5 h-5 mr-2" />
              {allReady && canStart ? 'Start Game' : 'Waiting for players...'}
            </Button>
            {!canStart && (
              <p className="text-amber-400 text-sm text-center mt-3">
                Need at least 2 players to start
              </p>
            )}
            {canStart && !allReady && (
              <p className="text-amber-400 text-sm text-center mt-3">
                Waiting for all players to be ready... ({guestPlayers.filter(p => !p.ready).length} not ready)
              </p>
            )}
          </>
        ) : (
          <>
            <Button
              onClick={onToggleReady}
              className={`w-full py-6 ${isReady ? 'bg-green-600 hover:bg-green-700' : 'bg-[#93B301] hover:bg-[#627703]'}`}
            >
              <Check className="w-5 h-5 mr-2" />
              {isReady ? 'Ready!' : 'Ready'}
            </Button>
            <p className="text-gray-400 text-sm text-center mt-3">
              Click Ready when you're prepared to start
            </p>
          </>
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