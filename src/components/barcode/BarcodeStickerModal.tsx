import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { Product } from '../../types';
import { X, Printer, Tag, CheckCircle2 } from 'lucide-react';

interface BarcodeStickerModalProps {
  product: Product | null;
  onClose: () => void;
}

export const BarcodeStickerModal: React.FC<BarcodeStickerModalProps> = ({ product, onClose }) => {
  const barcodeRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (product && barcodeRef.current) {
      try {
        JsBarcode(barcodeRef.current, product.barcode, {
          format: 'CODE128',
          lineColor: '#000000',
          width: 2,
          height: 50,
          displayValue: true,
          fontSize: 14,
          font: 'monospace',
          margin: 4,
          background: '#FFFFFF',
        });
      } catch (err) {
        console.error('Failed to generate barcode SVG:', err);
      }
    }
  }, [product]);

  if (!product) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md rounded-2xl bg-[#121212] border border-[#D4AF37]/30 shadow-[0_20px_50px_rgba(0,0,0,0.9)] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D4AF37]/15 bg-[#181818]/70">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/20">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white tracking-wide">Barcode Sticker Preview</h3>
              <p className="text-xs text-[#B8B8B8]">Thermal Sticker (50mm × 35mm)</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sticker Card Body (What will be printed) */}
        <div className="p-6 flex flex-col items-center">
          
          <div 
            id="barcode-sticker-print"
            className="w-[320px] bg-white text-black p-4 rounded-xl shadow-lg border border-gray-300 flex flex-col items-center select-none"
          >
            {/* Store Branding */}
            <div className="text-center border-b border-dashed border-gray-400 pb-1 w-full">
              <span className="font-extrabold text-[13px] tracking-wider text-black block uppercase font-serif">
                AL-BHURANI SWEETS & DRY ITEMS
              </span>
              <span className="text-[10px] text-gray-600 block">
                Pure Mithai, Fresh Namkeen & Premium Dry Fruits
              </span>
            </div>

            {/* Product Info */}
            <div className="w-full mt-2 text-left">
              <div className="flex justify-between items-baseline">
                <span className="font-bold text-[14px] text-black leading-tight">
                  {product.name}
                </span>
                <span className="text-xs font-semibold bg-gray-100 px-1.5 py-0.5 rounded text-gray-800">
                  {product.netWeight}
                </span>
              </div>
              
              <div className="flex justify-between items-center text-[10px] text-gray-600 mt-1">
                <span>Batch: {product.batchNo}</span>
                <span>Pkg: {product.mfgDate}</span>
              </div>
              <div className="flex justify-between items-center text-[10px] text-gray-600">
                <span>Use Before: {product.expiryDate}</span>
                <span className="text-red-700 font-bold">Veg ✓</span>
              </div>
            </div>

            {/* Rendered SVG Barcode */}
            <div className="my-2 flex justify-center bg-white p-1 rounded w-full overflow-hidden">
              <svg ref={barcodeRef} className="w-full max-h-[70px]"></svg>
            </div>

            {/* Price section */}
            <div className="w-full flex justify-between items-center border-t border-dashed border-gray-400 pt-1.5">
              <span className="text-[11px] font-bold text-gray-700">MRP (Incl. of all taxes)</span>
              <span className="text-[18px] font-black text-black">
                ₹{product.sellingPrice.toFixed(2)}
              </span>
            </div>
          </div>

          <p className="mt-4 text-xs text-[#B8B8B8] text-center max-w-xs">
            Standard label formatted for thermal sticker printers (TVS, Citizen, Zebra, TSC, or Xprinter 2-inch roll).
          </p>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#D4AF37]/15 bg-[#161616]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-[#B8B8B8] hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handlePrint}
            className="btn-gold flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            Print Sticker Now
          </button>
        </div>

      </div>
    </div>
  );
};
