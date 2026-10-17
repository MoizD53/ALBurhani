import React, { useState, useEffect } from 'react';
import { 
  Barcode, 
  Clock, 
  Volume2, 
  Menu, 
} from 'lucide-react';
import { playBeep } from '../../lib/utils';

interface HeaderProps {
  onToggleMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  onToggleMobileMenu,
}) => {
  const [time, setTime] = useState<string>('');

  useEffect(() => {
    const update = () => {
      setTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-14 px-3 sm:px-5 bg-[#0a0a0a] border-b border-white/[0.07] flex items-center justify-between z-10 shrink-0 gap-3">
      
      {/* Left: Mobile Hamburger + Brand */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile menu toggle */}
        <button
          onClick={onToggleMobileMenu}
          className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/[0.06] transition-colors shrink-0"
          title="Open Navigation Menu"
          aria-label="Open Navigation Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Brand */}
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="font-black text-sm tracking-widest uppercase font-serif text-[#D4AF37] hidden sm:block shrink-0">
            AL-BHURANI
          </span>
          <span className="text-white/20 hidden lg:block">·</span>
          <span className="text-xs text-gray-500 hidden lg:block truncate">
            Station Road · Main Counter
          </span>
        </div>
      </div>

      {/* Right: Status indicators */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">


        {/* Divider */}
        <div className="w-px h-4 bg-white/10 hidden sm:block" />

        {/* Scanner status */}
        <div className="flex items-center gap-1.5 text-xs shrink-0">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
          <Barcode className="w-3.5 h-3.5 text-gray-500 shrink-0" />
          <span className="hidden md:inline text-[11px] text-gray-400 font-medium">Scanner Ready</span>
        </div>

        {/* Beep test */}
        <button
          onClick={() => playBeep('scan')}
          title="Test POS Audio Beep"
          className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/[0.06] transition-colors shrink-0"
        >
          <Volume2 className="w-3.5 h-3.5" />
        </button>

        {/* Clock */}
        <div className="hidden lg:flex items-center gap-1 text-[11px] text-gray-400 font-mono shrink-0">
          <Clock className="w-3 h-3 text-gray-600" />
          <span>{time}</span>
        </div>

        {/* Divider */}
        <div className="w-px h-4 bg-white/10" />

        {/* Cashier avatar */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#D4AF37] to-amber-200 text-black flex items-center justify-center font-bold text-[10px] select-none shrink-0">
            C1
          </div>
          <div className="hidden sm:block text-left leading-tight">
            <span className="text-xs font-semibold text-white block">Counter 01</span>
            <span className="text-[10px] text-emerald-400 block">Shift Active</span>
          </div>
        </div>

      </div>
    </header>
  );
};
