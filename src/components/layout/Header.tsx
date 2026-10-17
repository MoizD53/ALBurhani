import React, { useState, useEffect } from 'react';
import { 
  Barcode, 
  Clock, 
  Volume2, 
  Sparkles, 
  Menu, 
  Database,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { playBeep } from '../../lib/utils';

interface HeaderProps {
  onToggleMobileMenu?: () => void;
  onOpenTursoModal?: () => void;
  isTursoConnected?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ 
  onToggleMobileMenu,
  onOpenTursoModal,
  isTursoConnected = false
}) => {
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
    <header className="h-16 px-3 sm:px-6 liquid-glass border-b border-[#D4AF37]/15 flex items-center justify-between z-10 shrink-0">
      
      {/* Left: Mobile Hamburger + Franchise Badge */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        
        {/* Mobile menu toggle button */}
        <button
          onClick={onToggleMobileMenu}
          className="lg:hidden p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-[#D4AF37] border border-[#D4AF37]/20 transition-all shrink-0"
          title="Open Navigation Menu"
          aria-label="Open Navigation Menu"
        >
          <Menu className="w-5 h-5 text-[#D4AF37]" />
        </button>

        {/* Brand / Franchise Badge */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/25 text-[#D4AF37] text-[11px] sm:text-xs font-semibold shrink-0">
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">AL-BHURANI FRANCHISE POS</span>
          </div>

          <span className="text-xs text-gray-400 hidden xl:inline truncate">
            Station Road Main Counter
          </span>
        </div>
      </div>

      {/* Right: Quick Tools & Status */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        
        {/* Turso Cloud Sync Pill (Clickable to open modal) */}
        {onOpenTursoModal && (
          <button
            onClick={onOpenTursoModal}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-xl border text-xs font-medium transition-all ${
              isTursoConnected
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300 hover:border-emerald-500/60'
                : 'bg-[#D4AF37]/10 border-[#D4AF37]/30 text-[#E5C158] hover:border-[#D4AF37]/60'
            }`}
            title="Turso libSQL Cloud Database Status (Click to configure)"
          >
            <Database className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">
              {isTursoConnected ? 'Turso Cloud: Connected' : 'Turso: Setup'}
            </span>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isTursoConnected ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]' : 'bg-amber-400 animate-pulse'}`} />
          </button>
        )}

        {/* Hardware Barcode Scanner Status indicator */}
        <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1 rounded-xl bg-black/40 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <Barcode className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="hidden md:inline">Scanner: Ready</span>
        </div>

        {/* Test Beep button */}
        <button
          onClick={handleTestBeep}
          title="Test POS Audio Beep"
          className="p-1.5 sm:p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-[#D4AF37] border border-white/10 transition-colors flex items-center gap-1.5 text-xs shrink-0"
        >
          <Volume2 className="w-4 h-4 shrink-0" />
          <span className="hidden md:inline">Beep</span>
        </button>

        {/* Live Clock (Hidden on narrow screens to avoid wrapping) */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-gray-400 font-mono px-2.5 py-1 rounded-lg bg-black/30 border border-white/5 shrink-0">
          <Clock className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
          <span>{time}</span>
        </div>

        {/* Cashier Profile */}
        <div className="flex items-center gap-2 pl-1 sm:pl-2 border-l border-white/10 shrink-0">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#D4AF37] to-amber-200 text-black flex items-center justify-center font-bold text-xs shadow-[0_0_10px_rgba(212,175,55,0.2)] shrink-0 select-none">
            C1
          </div>
          <div className="hidden sm:block text-left">
            <span className="text-xs font-semibold text-white block leading-none">
              Counter 01
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
