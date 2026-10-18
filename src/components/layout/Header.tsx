import React, { useState, useEffect } from 'react';
import { 
  Barcode, 
  Clock, 
  Volume2, 
  Menu, 
  Store,
  Wifi
} from 'lucide-react';
import { playBeep } from '../../lib/utils';

interface HeaderProps {
  onToggleMobileMenu?: () => void;
  isTursoConnected?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ 
  onToggleMobileMenu,
  isTursoConnected = false
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
    <header className="h-13 min-h-[52px] px-3 sm:px-5 bg-[#090909] border-b border-white/[0.08] flex items-center justify-between z-10 shrink-0 gap-3 select-none">
      
      {/* Left: Mobile Hamburger + Store & Branch info */}
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

        {/* Brand & Branch */}
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="font-extrabold text-sm sm:text-base tracking-widest uppercase font-serif text-[#D4AF37] shrink-0">
            AL-BHURANI
          </span>
          <span className="text-white/20 hidden sm:inline">|</span>
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-400 truncate">
            <Store className="w-3.5 h-3.5 text-gray-500 shrink-0" />
            <span className="truncate font-medium">Station Road Main Counter</span>
          </div>
        </div>
      </div>

      {/* Right: Status indicators & cashier pill */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">

        {/* Database Status Indicator */}
        <div 
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/[0.06] text-xs"
          title={isTursoConnected ? 'Connected to Turso Cloud libSQL Database' : 'Running on Local Storage Cache'}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${
            isTursoConnected 
              ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]' 
              : 'bg-amber-400/80'
          }`} />
          <Wifi className="w-3 h-3 text-gray-500" />
          <span className="text-[11px] text-gray-400 font-medium hidden md:inline">
            {isTursoConnected ? 'Cloud Sync' : 'Local Cache'}
          </span>
        </div>

        {/* Scanner Readiness */}
        <div 
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/[0.08] border border-emerald-500/20 text-xs"
          title="USB & Bluetooth Barcode Scanner Engine Ready"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <Barcode className="w-3.5 h-3.5 text-emerald-400/90" />
          <span className="hidden md:inline text-[11px] text-emerald-300 font-medium">Scanner Ready</span>
        </div>

        {/* Beep Audio Test Control */}
        <button
          onClick={() => playBeep('scan')}
          title="Test POS Barcode Audio Beep"
          className="p-1.5 rounded-lg text-gray-400 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10 transition-colors shrink-0"
          aria-label="Test POS Audio Beep"
        >
          <Volume2 className="w-4 h-4" />
        </button>

        {/* Live Digital Clock */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-gray-300 font-mono px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/[0.05] shrink-0">
          <Clock className="w-3.5 h-3.5 text-gray-500" />
          <span className="font-semibold tracking-wider">{time}</span>
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-white/10 mx-0.5" />

        {/* Cashier & Counter Information */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-[#D4AF37]/15 border border-[#D4AF37]/30 text-[#D4AF37] flex items-center justify-center font-bold text-xs font-serif select-none shrink-0 shadow-[0_0_8px_rgba(212,175,55,0.15)]">
            C1
          </div>
          <div className="hidden sm:block text-left leading-none">
            <span className="text-xs font-semibold text-white block">Counter 01</span>
            <span className="text-[10px] text-emerald-400 font-medium mt-0.5 block flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-emerald-400 inline-block" />
              Shift Active
            </span>
          </div>
        </div>

      </div>
    </header>
  );
};
