import React, { useState } from 'react';
import { 
  Settings, 
  Store, 
  Barcode, 
  Volume2, 
  CheckCircle2, 
  RotateCcw,
  AlertTriangle,
  X
} from 'lucide-react';
import { UserProfile } from '../../types';
import { playBeep } from '../../lib/utils';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';

interface SettingsViewProps {
  currentUser: UserProfile;
  onChangeUser: (user: UserProfile) => void;
  productsCount: number;
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
  productsCount,
  ordersCount = 0,
  totalRevenue = 0,
  expensesCount = 0,
  totalExpenses = 0,
  savedCustomersCount = 0,
  onResetStoreData,
  onResetAllStockToZero,
}) => {
  const [isResetConfirmModalOpen, setIsResetConfirmModalOpen] = useState(false);
  const [isStockConfirmModalOpen, setIsStockConfirmModalOpen] = useState(false);
  const [resetStatus, setResetStatus] = useState<{ message: string; isError: boolean } | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  const handleExecuteReset = async () => {
    if (!onResetStoreData) return;
    setIsResetting(true);
    try {
      const res = await onResetStoreData();
      if (res.success) {
        playBeep('success');
        setResetStatus({ message: res.message, isError: false });
      } else {
        playBeep('error');
        setResetStatus({ message: res.message, isError: true });
      }
    } catch (err: any) {
      playBeep('error');
      setResetStatus({ message: err?.message || 'Reset failed', isError: true });
    } finally {
      setIsResetting(false);
      setIsResetConfirmModalOpen(false);
      setTimeout(() => setResetStatus(null), 6000);
    }
  };

  const handleExecuteStockReset = async () => {
    if (!onResetAllStockToZero) return;
    setIsResetting(true);
    try {
      const res = await onResetAllStockToZero();
      if (res.success) {
        playBeep('success');
        setResetStatus({ message: res.message, isError: false });
      } else {
        playBeep('error');
        setResetStatus({ message: res.message, isError: true });
      }
    } catch (err: any) {
      playBeep('error');
      setResetStatus({ message: err?.message || 'Stock reset failed', isError: true });
    } finally {
      setIsResetting(false);
      setIsStockConfirmModalOpen(false);
      setTimeout(() => setResetStatus(null), 6000);
    }
  };

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
              <span className="text-[#D4AF37] font-semibold block">Hardware Compatibility Guidance:</span>
              <p>
                • <strong>Universal USB HID:</strong> Compatible with all standard plug-and-play USB & 2.4GHz wireless barcode scanners without drivers or extensions.
              </p>
              <p>
                • <strong>Suffix Handling:</strong> Automatically supports scanners that append <em>Enter</em>, <em>Tab</em>, or <em>No Suffix</em>.
              </p>
              <p>
                • <strong>Scanner Setup:</strong> If a scanner does not type characters, scan the <em>"USB HID Keyboard Emulation Mode"</em> configuration barcode in its user manual (avoid Virtual COM / RS-232 / OPOS modes).
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

        {/* 3. Fresh Shop Opening & Data Reset Administration */}
        <div className="lg:col-span-2 p-4 sm:p-5 rounded-2xl bg-[#121214] border border-white/[0.08] shadow-md space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-[#D4AF37]" />
              <span>Fresh Shop Opening & Data Administration</span>
            </h3>
            <span className="text-[10px] text-zinc-400 font-mono">
              Safe Store Commissioning
            </span>
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed">
            Prepare the POS terminal for official grand opening. Zero-out demo and testing sales transactions, customer visit counts, expense logs, and payment tender drawer balances. Real customer contact records and imported inventory catalogue master items are strictly preserved.
          </p>

          {/* Live Data Summary Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
            <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06]">
              <span className="text-[10px] uppercase text-zinc-500 font-semibold block">Active Sales Bills</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-base font-bold font-mono text-white">{ordersCount}</span>
                <span className="text-[10px] text-zinc-400 font-mono">(₹{totalRevenue.toLocaleString('en-IN')})</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06]">
              <span className="text-[10px] uppercase text-zinc-500 font-semibold block">Expense Records</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-base font-bold font-mono text-white">{expensesCount}</span>
                <span className="text-[10px] text-zinc-400 font-mono">(₹{totalExpenses.toLocaleString('en-IN')})</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06]">
              <span className="text-[10px] uppercase text-zinc-500 font-semibold block">Preserved Customers</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-base font-bold font-mono text-emerald-400">{savedCustomersCount}</span>
                <span className="text-[10px] text-zinc-400">directory</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06]">
              <span className="text-[10px] uppercase text-zinc-500 font-semibold block">Catalog Master</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-base font-bold font-mono text-white">{productsCount}</span>
                <span className="text-[10px] text-zinc-400">SKUs</span>
              </div>
            </div>
          </div>

          {/* Status Message */}
          {resetStatus && (
            <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
              resetStatus.isError 
                ? 'bg-red-500/15 border border-red-500/30 text-red-300' 
                : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
            }`}>
              {resetStatus.isError ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
              <span>{resetStatus.message}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-white/[0.06]">
            <span className="text-[11px] text-zinc-500">
              Zeroes out Today's & Lifetime Revenue, Customer Counts, and Drawer Tenders.
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsStockConfirmModalOpen(true)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 border border-white/[0.08] transition-colors"
              >
                Zero-Out Opening Stock
              </button>

              <button
                type="button"
                onClick={() => setIsResetConfirmModalOpen(true)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 flex items-center gap-2 transition-all shadow-sm"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset All Demo/Test Data to ₹0</span>
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Reset Confirmation Modal */}
      {isResetConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#121214] border border-white/[0.12] rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Reset for Fresh Shop Opening</h3>
                  <p className="text-xs text-zinc-400">Confirmation required</p>
                </div>
              </div>
              <button
                onClick={() => !isResetting && setIsResetConfirmModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-zinc-300 space-y-2 leading-relaxed bg-black/40 p-3.5 rounded-xl border border-white/[0.06]">
              <p className="font-semibold text-white">This operation will execute the following:</p>
              <ul className="space-y-1 list-disc pl-4 text-zinc-400 text-[11px]">
                <li>Remove all test sales and bills (Today's & Lifetime Revenue will show ₹0).</li>
                <li>Reset demo customer transaction counts to 0.</li>
                <li>Clear test operating expenses (Today's & Total Expenses will show ₹0).</li>
                <li>Clear payment tender drawers (Cash, UPI, and Card will show ₹0).</li>
                <li><strong className="text-emerald-400">Preserved:</strong> Real customer contact directory ({savedCustomersCount} contacts) and full catalog ({productsCount} SKUs).</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isResetting}
                onClick={() => setIsResetConfirmModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white bg-white/[0.04] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isResetting}
                onClick={handleExecuteReset}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#D4AF37] hover:bg-[#E5C158] text-black flex items-center gap-2 transition-all shadow-md"
              >
                {isResetting ? 'Resetting...' : 'Confirm & Reset to ₹0'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Reset Confirmation Modal */}
      {isStockConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#121214] border border-white/[0.12] rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Zero-Out All Product Stock</h3>
                  <p className="text-xs text-zinc-400">Physical inventory preparation</p>
                </div>
              </div>
              <button
                onClick={() => !isResetting && setIsStockConfirmModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed bg-black/40 p-3.5 rounded-xl border border-white/[0.06]">
              This sets the stock level of all {productsCount} imported products to <strong className="text-white">0</strong>. Use this before opening to count and enter opening physical stock.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isResetting}
                onClick={() => setIsStockConfirmModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white bg-white/[0.04] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isResetting}
                onClick={handleExecuteStockReset}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-500 hover:bg-blue-600 text-white flex items-center gap-2 transition-all shadow-md"
              >
                {isResetting ? 'Zeroing Stock...' : 'Set All Stock to 0'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
