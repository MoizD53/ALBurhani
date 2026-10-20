import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Store, 
  Barcode, 
  Volume2, 
  CheckCircle2,
  RefreshCw,
  Printer
} from 'lucide-react';
import { UserProfile } from '../../types';
import { playBeep } from '../../lib/utils';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import { saveSettingToTurso, fetchSettingsFromTurso } from '../../lib/turso';
import { 
  getSavedThermalRollWidth, 
  saveThermalRollWidth, 
  ThermalRollWidth 
} from '../../lib/pdfReceipt';

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
  const [storeName, setStoreName] = useState(() => {
    try {
      const saved = localStorage.getItem('albhurani_store_profile');
      if (saved) return JSON.parse(saved).storeName || 'AL-BHURANI Sweets & Dry Items';
    } catch {}
    return 'AL-BHURANI Sweets & Dry Items';
  });
  const [branchName, setBranchName] = useState(() => {
    try {
      const saved = localStorage.getItem('albhurani_store_profile');
      if (saved) return JSON.parse(saved).branchName || 'Godi Road Main Counter';
    } catch {}
    return 'Godi Road Main Counter';
  });
  const [gstin, setGstin] = useState(() => {
    try {
      const saved = localStorage.getItem('albhurani_store_profile');
      if (saved) return JSON.parse(saved).gstin || '24AABCA1234F1Z5';
    } catch {}
    return '24AABCA1234F1Z5';
  });
  const [phone, setPhone] = useState(() => {
    try {
      const saved = localStorage.getItem('albhurani_store_profile');
      if (saved) return JSON.parse(saved).phone || '+91 98765 43210';
    } catch {}
    return '+91 98765 43210';
  });
  const [thermalWidth, setThermalWidth] = useState<ThermalRollWidth>(getSavedThermalRollWidth);
  const [isSavedMessage, setIsSavedMessage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveRollWidth = (width: ThermalRollWidth) => {
    setThermalWidth(width);
    saveThermalRollWidth(width);
  };

  useEffect(() => {
    fetchSettingsFromTurso('store_profile').then((res) => {
      if (res && res.store_profile) {
        const p = res.store_profile;
        if (p.storeName) setStoreName(p.storeName);
        if (p.branchName) setBranchName(p.branchName);
        if (p.gstin) setGstin(p.gstin);
        if (p.phone) setPhone(p.phone);
        try {
          localStorage.setItem('albhurani_store_profile', JSON.stringify(p));
        } catch {}
      }
    });
  }, []);

  const handleSaveStore = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const profile = { storeName, branchName, gstin, phone };
    try {
      localStorage.setItem('albhurani_store_profile', JSON.stringify(profile));
      await saveSettingToTurso('store_profile', profile);
      setIsSavedMessage(true);
      setTimeout(() => setIsSavedMessage(false), 3000);
    } catch (err) {
      console.warn('Failed to save settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5 max-w-5xl select-none">
      
      {/* Title */}
      <div>
        <h2 className="text-lg sm:text-xl font-bold text-stone-900 flex items-center gap-2">
          <Settings className="w-5 h-5 text-[#B8860B]" />
          <span>System Settings & Hardware Diagnostics</span>
        </h2>
        <p className="text-xs text-stone-500 mt-0.5">
          Store parameters and hardware scanner bench diagnostics
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* 1. Store Identity Settings */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E8DEC8] shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
            <Store className="w-4 h-4 text-[#B8860B]" />
            <span>Store Profile & Tax Setup</span>
          </h3>

          <form onSubmit={handleSaveStore} className="space-y-3">
            <div>
              <label className="text-[11px] font-bold text-stone-700 block mb-1">
                Store Brand Name
              </label>
              <input
                type="text"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                className="w-full text-xs py-2 px-3 bg-white border border-[#E8DEC8] rounded-xl text-stone-900 focus:border-[#C99A18] focus:ring-1 focus:ring-[#C99A18] focus:outline-none shadow-sm"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-stone-700 block mb-1">
                Branch / Outlet Counter
              </label>
              <input
                type="text"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                className="w-full text-xs py-2 px-3 bg-white border border-[#E8DEC8] rounded-xl text-stone-900 focus:border-[#C99A18] focus:ring-1 focus:ring-[#C99A18] focus:outline-none shadow-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-stone-700 block mb-1">
                  GSTIN
                </label>
                <input
                  type="text"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value)}
                  className="w-full text-xs py-2 px-3 bg-white border border-[#E8DEC8] rounded-xl text-stone-900 font-mono focus:border-[#C99A18] focus:ring-1 focus:ring-[#C99A18] focus:outline-none shadow-sm"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-stone-700 block mb-1">
                  Contact Phone
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full text-xs py-2 px-3 bg-white border border-[#E8DEC8] rounded-xl text-stone-900 font-mono focus:border-[#C99A18] focus:ring-1 focus:ring-[#C99A18] focus:outline-none shadow-sm"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between">
              {isSavedMessage ? (
                <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Settings saved!
                </span>
              ) : <div />}

              <button
                type="submit"
                disabled={isSaving}
                className="btn-gold text-xs py-2 px-4 font-bold shadow-md"
              >
                {isSaving ? 'Saving...' : 'Save Store Profile'}
              </button>
            </div>
          </form>
        </div>

        {/* 2. Hardware Diagnostic Bench (Barcode Scanner Speed Test) */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E8DEC8] shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <Barcode className="w-4 h-4 text-[#B8860B]" />
              <span>Universal USB Scanner Diagnostic Bench</span>
            </h3>
            <span className="text-[10px] text-emerald-600 font-mono font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live HID Listener
            </span>
          </div>

          <p className="text-xs text-stone-500 leading-relaxed">
            Plug in any USB, 2.4GHz wireless dongle, or Bluetooth HID barcode scanner gun. Scan any product or test barcode to verify transmission payload, detected suffix, and transmission latency.
          </p>

          {/* Test Display Card */}
          <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E8DEC8] font-mono space-y-3">
            {lastScannedResult ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs border-b border-[#E8DEC8] pb-1.5">
                  <span className="text-stone-500 uppercase text-[10px] font-bold">Decoded Barcode:</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    lastScannedResult.suffix === 'Enter'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : lastScannedResult.suffix === 'Tab'
                        ? 'bg-cyan-50 text-cyan-700 border border-cyan-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}>
                    Suffix: {lastScannedResult.suffix === 'Enter' ? 'Enter (CR/LF)' : lastScannedResult.suffix === 'Tab' ? 'Tab (\\t)' : 'No Suffix (Auto)'}
                  </span>
                </div>

                <div className="text-xl sm:text-2xl font-black text-[#A67D0C] tracking-wider text-center py-1 break-all">
                  {lastScannedResult.code}
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-[11px] pt-1 border-t border-[#E8DEC8]">
                  <div className="bg-white p-1.5 rounded-lg border border-[#E8DEC8]">
                    <span className="text-stone-500 block text-[9px] uppercase font-bold">Latency</span>
                    <span className="text-emerald-600 font-bold">⚡ {lastScannedResult.speedMs} ms</span>
                  </div>
                  <div className="bg-white p-1.5 rounded-lg border border-[#E8DEC8]">
                    <span className="text-stone-500 block text-[9px] uppercase font-bold">Characters</span>
                    <span className="text-stone-900 font-bold">{lastScannedResult.charCount} digits</span>
                  </div>
                  <div className="bg-white p-1.5 rounded-lg border border-[#E8DEC8]">
                    <span className="text-stone-500 block text-[9px] uppercase font-bold">Avg Speed</span>
                    <span className="text-stone-900 font-bold">{lastScannedResult.avgIntervalMs} ms/char</span>
                  </div>
                </div>

                <div className="text-[10px] text-stone-500 text-center pt-0.5">
                  Captured at {lastScannedResult.timestamp} · Preserves exact string & leading zeros
                </div>
              </div>
            ) : (
              <div className="py-6 text-center space-y-1">
                <Barcode className="w-8 h-8 text-stone-300 mx-auto stroke-1" />
                <p className="text-xs font-bold text-stone-700">Scanner Bench Ready</p>
                <p className="text-[11px] text-stone-500">
                  Scan any barcode now to test hardware decoding, speed, and suffix...
                </p>
              </div>
            )}
          </div>

          {/* Scanner Compatibility Info & Action Buttons */}
          <div className="space-y-2 text-xs">
            <div className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#E8DEC8] text-[11px] text-stone-600 space-y-1">
              <span className="text-[#A67D0C] font-bold block">Hardware Compatibility Guidance (iMing IR-5000 & Future Devices):</span>
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
                  className="px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-xs font-bold text-stone-700 flex items-center gap-1.5 transition-colors"
                >
                  <Volume2 className="w-3.5 h-3.5 text-[#B8860B]" />
                  <span>Test Audio Chirp</span>
                </button>

                {lastScannedResult && (
                  <button
                    type="button"
                    onClick={() => setLastScannedResult(null)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-stone-500 hover:text-stone-800 transition-colors"
                  >
                    Clear Bench
                  </button>
                )}
              </div>

              <span className="text-[10px] font-mono text-stone-400">
                Safe Diagnostic Mode
              </span>
            </div>
          </div>
        </div>

        {/* 3. Thermal Receipt Roll Printer Configuration */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E8DEC8] shadow-sm space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <Printer className="w-4 h-4 text-[#B8860B]" />
              <span>Thermal Receipt Roll Printer Setup</span>
            </h3>
            <span className="text-[10px] text-emerald-600 font-mono font-bold">
              Continuous Roll
            </span>
          </div>

          <p className="text-xs text-stone-500 leading-relaxed">
            Select your thermal printer's installed paper roll width. Eliminates A4 paper waste, removes trailing white space, and drives continuous roll paper cutting directly from receipt content height.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleSaveRollWidth('80mm')}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                thermalWidth === '80mm'
                  ? 'border-[#C99A18] bg-amber-50/60 ring-2 ring-[#C99A18]/30 shadow-xs'
                  : 'border-[#E8DEC8] bg-[#FAF8F5] hover:bg-stone-50'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-stone-900 text-xs">80 mm Thermal Roll (Standard Retail)</span>
                {thermalWidth === '80mm' && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                )}
              </div>
              <p className="text-[11px] text-stone-600 leading-snug">
                Recommended for Epson TM-T82, TVS, NGX, and 3-inch POS printers. Printable width 72mm.
              </p>
            </button>

            <button
              type="button"
              onClick={() => handleSaveRollWidth('58mm')}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                thermalWidth === '58mm'
                  ? 'border-[#C99A18] bg-amber-50/60 ring-2 ring-[#C99A18]/30 shadow-xs'
                  : 'border-[#E8DEC8] bg-[#FAF8F5] hover:bg-stone-50'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-stone-900 text-xs">58 mm Thermal Roll (Compact Mobile)</span>
                {thermalWidth === '58mm' && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                )}
              </div>
              <p className="text-[11px] text-stone-600 leading-snug">
                For 2-inch mobile Bluetooth / USB thermal receipt printers. Printable width 48mm.
              </p>
            </button>
          </div>

          <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E8DEC8] text-[11px] text-stone-600 space-y-1">
            <span className="text-[#A67D0C] font-bold block">Epson Thermal Printer Configuration Guidance:</span>
            <p>
              • <strong>Paper Size Setting:</strong> In Chrome Print Preview &gt; <em>More settings</em>, select Paper size <strong>80 x 297 mm</strong> or <strong>Roll Paper 80 x Receipt</strong> with <strong>Margins: None</strong>.
            </p>
            <p>
              • <strong>Automatic Cut Behavior:</strong> In Windows Printer Properties &gt; Document Settings &gt; Paper Source, set to <em>"Receipt [Feed, Cut]"</em> or <em>"Cut at end of document"</em>.
            </p>
          </div>
        </div>

      </div>

    </div>
  );
};
