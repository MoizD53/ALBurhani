import React, { useState } from 'react';
import { 
  Settings, 
  Store, 
  Barcode, 
  Volume2, 
  CheckCircle2
} from 'lucide-react';
import { UserProfile } from '../../types';
import { playBeep } from '../../lib/utils';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';

interface SettingsViewProps {
  currentUser: UserProfile;
  onChangeUser: (user: UserProfile) => void;
  productsCount?: number;
  ordersCount?: number;
  totalRevenue?: number;
  expensesCount?: number;
  totalExpenses?: number;
  savedCustomersCount?: number;
  onResetStoreData?: () => Promise<{ success: boolean; message: string }>;
  onResetAllStockToZero?: () => Promise<{ success: boolean; message: string }>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentUser,
  onChangeUser,
}) => {

  // Hardware scanner live test state (Bench testing only, never creates orders or touches stock)
  const [lastScannedResult, setLastScannedResult] = useState<{
    code: string;
    suffix: 'Enter' | 'Tab' | 'None';
    speedMs: number;
    charCount: number;
    avgIntervalMs: number;
    timestamp: string;
  } | null>(null);

  // Use universal scanner hook for live diagnostics
  useBarcodeScanner({
    onScan: (code, meta) => {
      playBeep('scan');
      setLastScannedResult({
        code,
        suffix: meta?.suffix || 'Enter',
        speedMs: meta?.elapsedMs || 0,
        charCount: meta?.charCount || code.length,
        avgIntervalMs: meta?.avgIntervalMs || 0,
        timestamp: new Date().toLocaleTimeString(),
      });
    },
    enabled: true,
    minChars: 1,
    maxIntervalMs: 80,
  });

  // Store information
  const [storeName, setStoreName] = useState('AL-BHURANI Sweets & Dry Items');
  const [branchName, setBranchName] = useState('Godi Road Main Counter');
  const [gstin, setGstin] = useState('24AABCA1234F1Z5');
  const [phone, setPhone] = useState('+91 98765 43210');
  const [isSavedMessage, setIsSavedMessage] = useState(false);

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
              <span>Universal USB Scanner Diagnostic Bench</span>
            </h3>
            <span className="text-[10px] text-emerald-400 font-mono font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live HID Listener
            </span>
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed">
            Plug in any USB, 2.4GHz wireless dongle, or Bluetooth HID barcode scanner gun. Scan any product or test barcode to verify transmission payload, detected suffix, and transmission latency.
          </p>

          {/* Test Display Card */}
          <div className="p-4 rounded-xl bg-black/60 border border-white/[0.1] font-mono space-y-3">
            {lastScannedResult ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs border-b border-white/[0.08] pb-1.5">
                  <span className="text-zinc-500 uppercase text-[10px]">Decoded Barcode:</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    lastScannedResult.suffix === 'Enter'
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : lastScannedResult.suffix === 'Tab'
                        ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                        : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  }`}>
                    Suffix: {lastScannedResult.suffix === 'Enter' ? 'Enter (CR/LF)' : lastScannedResult.suffix === 'Tab' ? 'Tab (\\t)' : 'No Suffix (Auto)'}
                  </span>
                </div>

                <div className="text-xl sm:text-2xl font-bold text-[#D4AF37] tracking-wider text-center py-1 break-all">
                  {lastScannedResult.code}
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-[11px] pt-1 border-t border-white/[0.06]">
                  <div className="bg-white/[0.02] p-1.5 rounded-lg border border-white/[0.04]">
                    <span className="text-zinc-500 block text-[9px] uppercase">Latency</span>
                    <span className="text-emerald-400 font-bold">⚡ {lastScannedResult.speedMs} ms</span>
                  </div>
                  <div className="bg-white/[0.02] p-1.5 rounded-lg border border-white/[0.04]">
                    <span className="text-zinc-500 block text-[9px] uppercase">Characters</span>
                    <span className="text-zinc-200 font-bold">{lastScannedResult.charCount} digits</span>
                  </div>
                  <div className="bg-white/[0.02] p-1.5 rounded-lg border border-white/[0.04]">
                    <span className="text-zinc-500 block text-[9px] uppercase">Avg Speed</span>
                    <span className="text-zinc-200 font-bold">{lastScannedResult.avgIntervalMs} ms/char</span>
                  </div>
                </div>

                <div className="text-[10px] text-zinc-500 text-center pt-0.5">
                  Captured at {lastScannedResult.timestamp} · Preserves exact string & leading zeros
                </div>
              </div>
            ) : (
              <div className="py-6 text-center space-y-1">
                <Barcode className="w-8 h-8 text-zinc-600 mx-auto stroke-1" />
                <p className="text-xs font-semibold text-zinc-300">Scanner Bench Ready</p>
                <p className="text-[11px] text-zinc-500">
                  Scan any barcode now to test hardware decoding, speed, and suffix...
                </p>
              </div>
            )}
          </div>

          {/* Scanner Compatibility Info & Action Buttons */}
          <div className="space-y-2 text-xs">
            <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] text-[11px] text-zinc-400 space-y-1">
              <span className="text-[#D4AF37] font-semibold block">Hardware Compatibility Guidance (iMing IR-5000 & Future Devices):</span>
              <p>
                • <strong>Universal USB HID Keyboard:</strong> 100% compatible with shop scanner (iMing IR-5000) and any standard 1D/2D wired USB, 2.4GHz wireless dongle, or Bluetooth scanner in standard HID mode. No special drivers, SDKs, or browser extensions needed.
              </p>
              <p>
                • <strong>Suffixes Supported:</strong> Automatically detects <em>Enter (CR/LF)</em>, <em>Tab (\t)</em>, and <em>No Suffix (rapid-burst detection)</em>. Exact barcodes with leading zeros (e.g. <code>0001</code>) are always preserved.
              </p>
              <p>
                • <strong>Configuration Note:</strong> If your scanner (e.g. iMing IR-5000) does not register keystrokes, ensure it is set to <em>"USB HID Keyboard Mode"</em> by scanning the mode barcode in the quick-start sheet. Scanners in Virtual COM / RS-232 / OPOS mode will not transmit keyboard events until switched to HID mode.
              </p>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => playBeep('scan')}
                  className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-xs font-semibold text-zinc-300 flex items-center gap-1.5 transition-colors"
                >
                  <Volume2 className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>Test Audio Chirp</span>
                </button>

                {lastScannedResult && (
                  <button
                    type="button"
                    onClick={() => setLastScannedResult(null)}
                    className="px-2.5 py-1.5 rounded-lg text-xs text-zinc-500 hover:text-white transition-colors"
                  >
                    Clear Bench
                  </button>
                )}
              </div>

              <span className="text-[10px] font-mono text-zinc-500">
                Safe Diagnostic Mode
              </span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
