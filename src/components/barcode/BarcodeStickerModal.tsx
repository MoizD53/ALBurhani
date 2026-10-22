import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { Product } from '../../types';
import { X, Printer, Tag } from 'lucide-react';
import { formatPriceWithBasis } from '../../lib/pricing';

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
          height: 52,
          displayValue: true,
          fontSize: 13,
          font: 'monospace',
          margin: 6,
          background: '#FFFFFF',
          flat: true,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-sm animate-fade-in select-none print:p-0 print:bg-white print:static print:block">
      <div className="relative w-full max-w-md rounded-2xl bg-white border border-[#E8DEC8] shadow-2xl max-h-[92vh] max-h-[92dvh] flex flex-col overflow-hidden print:border-none print:shadow-none print:max-h-none print:w-auto print:max-w-none print:static print:bg-white print:overflow-visible">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E8DEC8] bg-[#FAF8F5] shrink-0 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-[#FBF7EE] text-[#A67D0C] border border-[#C99A18]/30 shrink-0">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-stone-900 text-sm">Thermal Barcode Sticker</h3>
              <p className="text-[10px] text-stone-500">50mm × 35mm Label (CODE128)</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-200/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sticker Preview Body */}
        <div className="p-4 sm:p-6 flex flex-col items-center overflow-y-auto custom-scrollbar flex-1 bg-stone-50">
          
          <div 
            id="barcode-sticker-print"
            className="w-[300px] bg-white text-black p-3.5 rounded-xl shadow-md border border-stone-300 flex flex-col items-center select-none"
          >
            {/* Store Branding */}
            <div className="text-center border-b border-dashed border-gray-400 pb-1 w-full">
              <span className="font-extrabold text-xs tracking-wider text-black block uppercase font-serif">
                AL-BURHANI SWEETS & DRY ITEMS
              </span>
              <span className="text-[9px] text-gray-600 block font-medium">
                Pure Ghee Mithai · Fresh Namkeen · Dry Fruits
              </span>
            </div>

            {/* Product Info */}
            <div className="w-full mt-2 text-left">
              <div className="flex justify-between items-baseline">
                <span className="font-bold text-xs text-black leading-tight truncate">
                  {product.name}
                </span>
                <span className="text-[10px] font-bold font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-800 shrink-0 ml-1">
                  SKU: {product.sku}
                </span>
              </div>
              
              <div className="flex justify-between items-center text-[9px] text-gray-600 mt-0.5">
                <span>Unit: {product.unit} ({formatPriceWithBasis(product.sellingPrice, product.unit)})</span>
                <span className="text-emerald-700 font-bold">100% Pure ✓</span>
              </div>
            </div>

            {/* Rendered SVG Barcode */}
            <div className="my-1.5 flex justify-center bg-white p-1 rounded w-full overflow-hidden">
              <svg ref={barcodeRef} className="w-full max-h-[64px]"></svg>
            </div>

            {/* Product Code & Price */}
            <div className="w-full flex justify-between items-center border-t border-dashed border-gray-400 pt-1">
              <div>
                <span className="text-[9px] font-mono text-gray-600 block leading-tight font-bold">Code: {product.sku}</span>
                <span className="text-[9px] text-gray-700 font-semibold">MRP (Incl. All Taxes)</span>
              </div>
              <span className="text-base font-black font-mono text-black">
                {formatPriceWithBasis(product.sellingPrice, product.unit)}
              </span>
            </div>
          </div>

          <p className="mt-3 text-[11px] text-stone-500 text-center max-w-xs print:hidden">
            Print ready for TVS, TSC, Zebra, Citizen, or Xprinter 2-inch thermal sticker rolls.
          </p>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-3 border-t border-[#E8DEC8] bg-[#FAF8F5] shrink-0 print:hidden">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handlePrint}
            className="btn-gold text-xs py-2 px-4 flex items-center gap-1.5 font-bold shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Label</span>
          </button>
        </div>

      </div>
    </div>
  );
};
