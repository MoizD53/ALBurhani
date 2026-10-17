import React, { useState, useEffect } from 'react';
import { Barcode, Clock, User, Volume2, Sparkles, Bell } from 'lucide-react';
import { playBeep } from '../../lib/utils';

interface HeaderProps {
  onOpenQuickScan?: () => void;
}

export const Header: React.FC<HeaderProps> = () => {
  const [time, setTime] = useState<string>('');

  useEffect(() => {
    const update = () => {
      setTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleTestBeep = () => {
    playBeep('scan');
  };

  return (
    <header className="h-16 px-6 liquid-glass border-b border-[#D4AF37]/15 flex items-center justify-between z-10">
      
      {/* Left: Outlet & Franchise badge */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/25 text-[#D4AF37] text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5" />
          <span>AL-BHURANI FRANCHISE POS</span>
        </div>
        <span className="text-xs text-gray-400 hidden md:inline">
          Station Road Main Counter
        </span>
      </div>

      {/* Center/Right Status & Quick tools */}
      <div className="flex items-center gap-3">
        
        {/* Hardware Barcode Scanner Status indicator */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-black/40 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
          <Barcode className="w-4 h-4 text-emerald-400" />
          <span className="hidden sm:inline">Scanner Engine: Ready</span>
        </div>

        {/* Test Beep button */}
        <button
          onClick={handleTestBeep}
          title="Test POS Audio Beep"
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-[#D4AF37] border border-white/10 transition-colors flex items-center gap-1.5 text-xs"
        >
          <Volume2 className="w-4 h-4" />
          <span className="hidden sm:inline">Test Beep</span>
        </button>

        {/* Live Clock */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-gray-400 font-mono px-2.5 py-1 rounded-lg bg-black/30 border border-white/5">
          <Clock className="w-3.5 h-3.5 text-[#D4AF37]" />
          <span>{time}</span>
        </div>

        {/* Cashier Profile */}
        <div className="flex items-center gap-2 pl-2 border-l border-white/10">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#D4AF37] to-amber-200 text-black flex items-center justify-center font-bold text-xs shadow-[0_0_10px_rgba(212,175,55,0.2)]">
            C1
          </div>
          <div className="hidden sm:block text-left">
            <span className="text-xs font-semibold text-white block leading-none">
              Cashier 01
            </span>
            <span className="text-[10px] text-[#D4AF37] block mt-0.5">
              Shift Active
            </span>
          </div>
        </div>

      </div>

    </header>
  );
};
