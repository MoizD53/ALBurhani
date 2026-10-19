import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Store, 
  Barcode, 
  ShieldCheck, 
  Volume2, 
  CheckCircle2, 
  Layers, 
  Terminal,
  Zap,
  Printer
} from 'lucide-react';
import { UserProfile, Product } from '../../types';
import { playBeep } from '../../lib/utils';

interface SettingsViewProps {
  currentUser: UserProfile;
  onChangeUser: (user: UserProfile) => void;
  productsCount: number;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentUser,
  onChangeUser,
  productsCount,
}) => {
  // Hardware scanner live test state
  const [testBuffer, setTestBuffer] = useState<string>('');
  const [lastScannedResult, setLastScannedResult] = useState<{
    code: string;
    speedMs: number;
    timestamp: string;
  } | null>(null);

  // Store information
  const [storeName, setStoreName] = useState('AL-BHURANI Sweets & Dry Items');
  const [branchName, setBranchName] = useState('Godi Road Main Counter');
  const [gstin, setGstin] = useState('24AABCA1234F1Z5');
  const [phone, setPhone] = useState('+91 98765 43210');
  const [isSavedMessage, setIsSavedMessage] = useState(false);

  // Hardware Scanner Speed Test Listener
  useEffect(() => {
    let rawBuffer = '';
    let startTime = 0;

    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      const now = Date.now();
      if (!startTime || now - startTime > 300) {
        startTime = now;
        rawBuffer = '';
      }

      if (e.key === 'Enter') {
        if (rawBuffer.length >= 3) {
          const totalTime = now - startTime;
          playBeep('scan');
          setLastScannedResult({
            code: rawBuffer,
            speedMs: totalTime,
            timestamp: new Date().toLocaleTimeString(),
          });
          rawBuffer = '';
          startTime = 0;
        }
      } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        rawBuffer += e.key;
        setTestBuffer(rawBuffer);
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const handleSaveStore = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavedMessage(true);
    setTimeout(() => setIsSavedMessage(false), 3000);
  };

  return (
    <div className="space-y-5 max-w-5xl select-none">
      
      {/* Title */}
      <div>
        <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2 font-serif">
          <Settings className="w-5 h-5 text-[#D4AF37]" />
          <span>System Settings & Hardware Diagnostics</span>
        </h2>
        <p className="text-xs text-zinc-400 mt-0.5">
          Store parameters and hardware scanner bench diagnostics
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* 1. Store Identity Settings */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#121214] border border-white/[0.08] shadow-md space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Store className="w-4 h-4 text-[#D4AF37]" />
            <span>Store Profile & Tax Setup</span>
          </h3>

          <form onSubmit={handleSaveStore} className="space-y-3">
            <div>
              <label className="text-[11px] font-semibold text-zinc-400 block mb-1">
                Store Brand Name
              </label>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="w-full text-xs py-2 px-3 bg-black/50 border border-white/[0.1] rounded-xl text-white focus:border-[#D4AF37]/60 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-zinc-400 block mb-1">
                Branch / Outlet Counter
              </label>
              <input
                type="text"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                className="w-full text-xs py-2 px-3 bg-black/50 border border-white/[0.1] rounded-xl text-white focus:border-[#D4AF37]/60 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-zinc-400 block mb-1">
                  GSTIN
                </label>
                <input
                  type="text"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value)}
                  className="w-full text-xs py-2 px-3 bg-black/50 border border-white/[0.1] rounded-xl text-white font-mono focus:border-[#D4AF37]/60 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-zinc-400 block mb-1">
                  Contact Phone
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full text-xs py-2 px-3 bg-black/50 border border-white/[0.1] rounded-xl text-white font-mono focus:border-[#D4AF37]/60 focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between">
              {isSavedMessage ? (
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Settings saved!
                </span>
              ) : <div />}

              <button
                type="submit"
                className="btn-gold text-xs py-2 px-4 font-bold"
              >
                Save Store Profile
              </button>
            </div>
          </form>
        </div>

        {/* 3. Hardware Diagnostic Bench (Barcode Scanner Speed Test) */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#121214] border border-white/[0.08] shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Barcode className="w-4 h-4 text-[#D4AF37]" />
              <span>Hardware Scanner Diagnostic Bench</span>
            </h3>
            <span className="text-[10px] text-emerald-400 font-mono font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Listening
            </span>
          </div>

          <p className="text-xs text-zinc-400">
            Plug in any USB or Wireless HID barcode scanner gun and scan a barcode to benchmark transmission latency in milliseconds.
          </p>

          {/* Test Display Card */}
          <div className="p-4 rounded-xl bg-black/60 border border-white/[0.1] font-mono text-center space-y-2">
            {lastScannedResult ? (
              <div className="space-y-1">
                <span className="text-[10px] text-zinc-500 uppercase">Decoded Barcode:</span>
                <div className="text-xl font-bold text-[#D4AF37] tracking-wider">
                  {lastScannedResult.code}
                </div>
                <div className="flex items-center justify-center gap-4 text-xs pt-1">
                  <span className="text-emerald-400 font-semibold">
                    ⚡ {lastScannedResult.speedMs} ms Latency
                  </span>
                  <span className="text-zinc-500">
                    {lastScannedResult.timestamp}
                  </span>
                </div>
              </div>
            ) : (
              <div className="py-3 text-zinc-500 text-xs">
                Scan any barcode now to benchmark scanner hardware...
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              onClick={() => playBeep('scan')}
              className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-zinc-300 flex items-center gap-1.5 transition-colors"
            >
              <Volume2 className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>Test Audio Beep</span>
            </button>

            <span className="text-[11px] text-zinc-500">
              HID Keyboard Emulation Mode
            </span>
          </div>
        </div>

      </div>

    </div>
  );
};
