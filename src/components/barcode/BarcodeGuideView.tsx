import React, { useState, useEffect } from 'react';
import { 
  Barcode, 
  HelpCircle, 
  CheckCircle2, 
  Printer, 
  Zap, 
  Layers, 
  ExternalLink,
  ShieldCheck,
  Terminal
} from 'lucide-react';
import { playBeep } from '../../lib/utils';

export const BarcodeGuideView: React.FC = () => {
  const [testBuffer, setTestBuffer] = useState<string>('');
  const [lastScannedResult, setLastScannedResult] = useState<{
    code: string;
    speedMs: number;
    timestamp: string;
  } | null>(null);

  useEffect(() => {
    let rawBuffer = '';
    let startTime = 0;

    const handleKey = (e: KeyboardEvent) => {
      // Hardware barcode scanner hardware speed test
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

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2 font-serif">
          <Barcode className="w-5 h-5 text-[#D4AF37]" />
          Barcode System Hardware Guide & Live Tester
        </h2>
        <p className="text-xs text-[#B8B8B8] mt-0.5">
          Everything you need to demonstrate & set up barcode scanning for AL-BHURANI Franchise
        </p>
      </div>

      {/* LIVE HARDWARE SCANNER TEST BENCH */}
      <div className="p-6 rounded-2xl liquid-glass border border-[#D4AF37]/35 relative overflow-hidden shadow-2xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <span className="text-xs uppercase font-bold tracking-wider text-[#D4AF37] flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-[#D4AF37]" /> Live Hardware Scanner Diagnostic Bench
            </span>
            <p className="text-xs text-gray-300 mt-1">
              Plug in ANY barcode gun into this PC right now and pull the trigger on any packet. No configuration needed!
            </p>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            Listening for USB / Bluetooth Keystrokes
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          
          <div className="p-4 rounded-xl bg-black/50 border border-white/10 flex flex-col justify-between">
            <div className="flex items-center gap-2 text-xs text-gray-400 font-mono mb-2">
              <Terminal className="w-4 h-4 text-[#D4AF37]" />
              <span>Real-Time Raw Input Stream</span>
            </div>
            <div className="h-16 flex items-center justify-center font-mono text-xl text-white tracking-widest bg-black/60 rounded-lg border border-white/5">
              {testBuffer || <span className="text-gray-600 text-sm font-sans">Pull scanner trigger to test...</span>}
            </div>
            <p className="text-[10px] text-gray-400 mt-2">
              The scanner types barcode digits in milliseconds and appends [Enter].
            </p>
          </div>

          <div className="p-4 rounded-xl bg-black/50 border border-white/10">
            <div className="text-xs text-gray-400 font-mono mb-2 flex justify-between">
              <span>Last Decoded Barcode</span>
              {lastScannedResult && <span className="text-emerald-400">Status: Valid Read ✓</span>}
            </div>

            {lastScannedResult ? (
              <div className="space-y-1.5">
                <div className="text-2xl font-bold font-mono text-[#D4AF37]">
                  {lastScannedResult.code}
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-300">
                  <span>Transfer Speed: <strong className="text-white">{lastScannedResult.speedMs} ms</strong></span>
                  <span>Time: <strong className="text-white">{lastScannedResult.timestamp}</strong></span>
                </div>
              </div>
            ) : (
              <div className="h-16 flex items-center justify-center text-xs text-gray-500">
                Awaiting first barcode scan...
              </div>
            )}
          </div>

        </div>
      </div>

      {/* 3 Step Explanation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        <div className="p-5 rounded-2xl liquid-glass border border-white/10">
          <div className="p-2.5 w-fit rounded-xl bg-[#D4AF37]/15 text-[#D4AF37] mb-3">
            <Barcode className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-white text-sm">1. How Scanners Work</h4>
          <p className="text-xs text-gray-300 mt-2 leading-relaxed">
            Barcode guns act as an <strong>HID Keyboard</strong>. When pointed at any sweets box or snack pouch, they read the bars and type the numbers into AL-BHURANI POS at lightning speed.
          </p>
          <div className="mt-3 text-[11px] text-[#D4AF37] font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Zero software drivers needed
          </div>
        </div>

        <div className="p-5 rounded-2xl liquid-glass border border-white/10">
          <div className="p-2.5 w-fit rounded-xl bg-purple-500/15 text-purple-400 mb-3">
            <Printer className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-white text-sm">2. Printing Barcode Stickers</h4>
          <p className="text-xs text-gray-300 mt-2 leading-relaxed">
            For fresh in-house sweets (e.g. 500g Kaju Katli) or loose dry snacks, use any thermal label printer (TVS LP-46 / TSC) with <strong>50mm × 25mm</strong> or <strong>50mm × 38mm</strong> sticker rolls.
          </p>
          <div className="mt-3 text-[11px] text-purple-400 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> 1-Click Sticker Print included
          </div>
        </div>

        <div className="p-5 rounded-2xl liquid-glass border border-white/10">
          <div className="p-2.5 w-fit rounded-xl bg-blue-500/15 text-blue-400 mb-3">
            <Layers className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-white text-sm">3. Indian Retail Standards</h4>
          <p className="text-xs text-gray-300 mt-2 leading-relaxed">
            In India, packaged foods use <strong>EAN-13</strong> (prefixes 890...). For custom store items, <strong>CODE128</strong> barcodes are ideal because they can store item code, batch, and weight.
          </p>
          <div className="mt-3 text-[11px] text-blue-400 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Compliant with FSSAI & GS1
          </div>
        </div>

      </div>

      {/* Recommended Hardware Section for Franchise Client */}
      <div className="p-6 rounded-2xl liquid-glass border border-white/10">
        <h3 className="font-bold text-white text-sm mb-4 font-serif">
          Recommended Hardware for AL-BHURANI Franchise Outlets
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          <div className="p-3.5 rounded-xl bg-black/40 border border-white/5">
            <span className="text-[10px] uppercase font-bold text-gray-400 block">Entry-level Barcode Gun</span>
            <h5 className="font-semibold text-white text-xs mt-1">Pegasus / Netum USB 1D Laser</h5>
            <p className="text-[11px] text-gray-400 mt-1">Price: ₹900 - ₹1,400</p>
            <p className="text-[10px] text-emerald-400 mt-1">Plug & play, ideal for single counter</p>
          </div>

          <div className="p-3.5 rounded-xl bg-black/40 border border-white/5">
            <span className="text-[10px] uppercase font-bold text-gray-400 block">Heavy-duty 2D/QR Gun</span>
            <h5 className="font-semibold text-white text-xs mt-1">TVS BS-C 101 Star / Honeywell</h5>
            <p className="text-[11px] text-gray-400 mt-1">Price: ₹2,200 - ₹3,500</p>
            <p className="text-[10px] text-emerald-400 mt-1">Reads damaged & crinkled pouch barcodes</p>
          </div>

          <div className="p-3.5 rounded-xl bg-black/40 border border-white/5">
            <span className="text-[10px] uppercase font-bold text-gray-400 block">Thermal Label Printer</span>
            <h5 className="font-semibold text-white text-xs mt-1">TVS LP 46 Neo / TSC TE 244</h5>
            <p className="text-[11px] text-gray-400 mt-1">Price: ₹7,500 - ₹9,500</p>
            <p className="text-[10px] text-emerald-400 mt-1">For Mithai box & namkeen pouch stickers</p>
          </div>

          <div className="p-3.5 rounded-xl bg-black/40 border border-white/5">
            <span className="text-[10px] uppercase font-bold text-gray-400 block">Thermal Receipt Printer</span>
            <h5 className="font-semibold text-white text-xs mt-1">Epson TM-T82 / TVS RP 3200 (80mm)</h5>
            <p className="text-[11px] text-gray-400 mt-1">Price: ₹5,000 - ₹8,500</p>
            <p className="text-[10px] text-emerald-400 mt-1">High-speed customer bill printing</p>
          </div>

        </div>
      </div>

    </div>
  );
};
