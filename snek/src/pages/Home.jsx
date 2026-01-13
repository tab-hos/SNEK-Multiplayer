import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils.js';
import { Button } from '../components/ui/button.jsx';
import { Gamepad2, Users, Zap, Trophy, ArrowRight } from 'lucide-react';
import SNEKlogo from '../assets/SNEKlogo.png';
import SNEKlogo2 from '../assets/twoSNEKS.png';
import CLOCK from '../assets/CLOCK.png';
import CROWN from '../assets/CROWN.png';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#222531]">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-900/20 via-transparent to-transparent" />
        
        <div className="max-w-6xl mx-auto px-6 py-24 relative">
          <div className="text-center">
            <img src={SNEKlogo} alt="MultiSnake" className="w-30 h-30 mx-auto mb-8"/>  {/* LOGO */}
            
            <h1 className="text-6xl md:text-8xl font-annie text-white mb-6"> SNEK</h1>
            
            <p className="text-xl text-gray-400 mb-2 max-w-2xl mx-auto">
                Be a{" "}
                <span className="font-bold text-[#CF5A16]">SNEK</span>. 
                 Have a snack. 
                Grow big.{" "}
                <span className="font-bold text-[#75A91B]">Win</span>.
            </p>

<p className="text-xl text-gray-400 mb-12 max-w-2xl mx-auto">
  Now with multiplayer mode!
</p>
            
            <Link to={createPageUrl('Game')}>
              <Button className="bg-[#CF5A16] hover:bg-[#B84F14] text-lg px-8 py-6 rounded-xl " > Play Now </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-[#323645] backdrop-blur rounded-2xl p-8 border border-gray-800">
            <img src={SNEKlogo2} alt="SNEK" className="w-20 h-20 rounded-xl mb-6"/>

            <h3 className="text-xl font-bold text-white mb-3">SNEK</h3>
            <p className="text-gray-400">Play with 2-4 friends in the same game room. Share the code and beat their asses!</p>
          </div>
          
          <div className="bg-[#323645] backdrop-blur rounded-2xl p-8 border border-gray-800">
            <img src={CLOCK} alt="Real-Time" className="w-20 h-20 rounded-xl mb-6"/>

            <h3 className="text-xl font-bold text-white mb-3">Real-Time</h3>
            <p className="text-gray-400">Smooth as a snek gameplay with responsive controls. Every move counts!</p>
          </div>
          
          <div className="bg-[#323645] backdrop-blur rounded-2xl p-8 border border-gray-800">
            <img src={CROWN} alt="Compete" className="w-20 h-20 rounded-xl mb-6"/>

            <h3 className="text-xl font-bold text-white mb-3">Compete</h3>
            <p className="text-gray-400">Snack away, grow your tail, and be the last snek standing!</p>
          </div>
        </div>
      </div>

      {/* How to Play */}
      <div className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-white text-center mb-12">How to SNEK</h2>
        
        <div className="space-y-6">
          <div className="flex items-start gap-6">
            <div className="w-10 h-10 rounded-full bg-[#93B301] flex items-center justify-center shrink-0">
              <span className="text-white font-bold">1</span>
            </div>
            <div>
              <h4 className="text-lg font-bold text-white mb-1">Create or Join</h4>
              <p className="text-gray-400">Create a new game room or join an existing one with a code.</p>
            </div>
          </div>
          
          <div className="flex items-start gap-6">
            <div className="w-10 h-10 rounded-full bg-[#6422BF] flex items-center justify-center shrink-0">
              <span className="text-white font-bold">2</span>
            </div>
            <div>
              <h4 className="text-lg font-bold text-white mb-1">Control Your SNEK</h4>
              <p className="text-gray-400">Use arrow keys or WASD to move. Collect snack to grow and score!</p>
            </div>
          </div>
          
          <div className="flex items-start gap-6">
            <div className="w-10 h-10 rounded-full bg-[#CF5A16] flex items-center justify-center shrink-0">
              <span className="text-white font-bold">3</span>
            </div>
            <div>
              <h4 className="text-lg font-bold text-white mb-1">Survive & Win</h4>
              <p className="text-gray-400">Avoid collisions with yourself and others. Last snek standing wins!</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-8 text-gray-600">
        <p>Press any key to start controlling your snake</p>
      </div>
    </div>
  );
}