import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { Product } from '../../types';

interface BarcodeLabelItemProps {
  product: Product;
  mfgDate?: string;
  expDate?: string;
  widthMm?: number;
  heightMm?: number;
  className?: string;
}

export const BarcodeLabelItem: React.FC<BarcodeLabelItemProps> = ({
  product,
  mfgDate,
  expDate,
  widthMm = 50,
  heightMm = 30,
  className = '',
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  const hasBarcode = Boolean(product.barcode && product.barcode.trim());

  useEffect(() => {
    if (hasBarcode && svgRef.current) {
      try {
        JsBarcode(svgRef.current, product.barcode.trim(), {
          format: 'CODE128',
          lineColor: '#000000',
          width: 1.4,
          height: 28,
          displayValue: true,
          fontSize: 9,
          font: 'monospace',
          margin: 1,
          background: '#FFFFFF',
        });
      } catch (err) {
        console.warn('JsBarcode render error:', err);
      }
    }
  }, [product.barcode, hasBarcode]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`; // YYYY-MM-DD -> DD/MM/YYYY
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  return (
    <div
      style={{
        width: `${widthMm}mm`,
        height: `${heightMm}mm`,
        minWidth: `${widthMm}mm`,
        minHeight: `${heightMm}mm`,
      }}
      className={`bg-white text-black p-1.5 flex flex-col justify-between items-center text-center select-none overflow-hidden box-border border border-gray-300 print:border-none print:m-0 break-inside-avoid ${className}`}
    >
      {/* 1. Shop Header */}
      <div className="w-full text-center shrink-0 border-b border-black/30 pb-0.5">
        <span className="font-extrabold text-[8.5px] tracking-wider text-black block uppercase font-sans leading-tight">
          AL BURHANI SWEET AND FARSAAN
        </span>
      </div>

      {/* 2. Product Name */}
      <div className="w-full text-center px-0.5 my-0.5 shrink-0">
        <span className="font-bold text-[9px] text-black leading-tight block truncate" title={product.name}>
          {product.name}
        </span>
      </div>

      {/* 3. Barcode Graphic + Human-Readable Number */}
      <div className="w-full flex-1 flex items-center justify-center overflow-hidden my-0.5 bg-white">
        {hasBarcode ? (
          <svg ref={svgRef} className="max-w-full max-h-[36px]"></svg>
        ) : (
          <div className="text-[7.5px] text-red-600 font-bold border border-red-300 bg-red-50 p-1 rounded">
            NO BARCODE
          </div>
        )}
      </div>

      {/* 4. Footer: Price & MFG / EXP Dates */}
      <div className="w-full flex justify-between items-end border-t border-black/40 pt-0.5 px-0.5 text-[7.5px] leading-tight shrink-0 font-sans">
        <div className="text-left font-medium text-black">
          {mfgDate && <div>MFG: {formatDate(mfgDate)}</div>}
          {expDate && <div>EXP: {formatDate(expDate)}</div>}
          {!mfgDate && !expDate && <div className="text-gray-400">Fresh Stock</div>}
        </div>
        <div className="text-right">
          <span className="text-[7px] text-gray-700 block uppercase font-semibold">MRP (Incl. Tax)</span>
          <span className="text-xs font-black font-mono text-black leading-none">
            ₹{product.sellingPrice.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
};
