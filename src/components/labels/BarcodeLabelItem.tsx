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
  widthMm = 64,
  heightMm = 34,
  className = '',
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  const hasBarcode = Boolean(product.barcode && product.barcode.trim());
  // Compact format: e.g. TechNova 48L (48 × 24 mm)
  const isCompact = heightMm <= 26;

  useEffect(() => {
    if (hasBarcode && svgRef.current) {
      try {
        JsBarcode(svgRef.current, product.barcode.trim(), {
          format: 'CODE128',
          lineColor: '#000000',
          width: isCompact ? 1.05 : 1.25,
          height: isCompact ? 9 : 14,
          displayValue: true,
          fontOptions: 'bold',
          fontSize: isCompact ? 6 : 7.5,
          font: 'monospace',
          margin: 0,
          textMargin: 1,
          background: '#FFFFFF',
        });
      } catch (err) {
        console.warn('JsBarcode render error:', err);
      }
    }
  }, [product.barcode, hasBarcode, isCompact, widthMm, heightMm]);

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
        maxWidth: `${widthMm}mm`,
        maxHeight: `${heightMm}mm`,
        boxSizing: 'border-box',
        color: '#000000',
        backgroundColor: '#FFFFFF',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
        padding: isCompact ? '0.8mm 1.5mm' : '1.5mm 2mm',
      }}
      className={`bg-white text-black flex flex-col justify-between items-center text-center select-none overflow-hidden border border-dashed border-stone-300 print:border-none print:m-0 break-inside-avoid relative ${className}`}
    >
      {/* 1. Shop Header at the top (Solid Jet Black, Bold) */}
      <div className="w-full text-center shrink-0 border-b border-black pb-0.5 leading-none">
        <span
          style={{ color: '#000000' }}
          className={`font-black text-black block uppercase font-sans tracking-wide leading-none ${
            isCompact ? 'text-[6.5px]' : 'text-[7.5px]'
          }`}
        >
          AL BURHANI SWEET AND FARSAAN
        </span>
      </div>

      {/* 2. Product Name (Dark Bold Black) */}
      <div className="w-full text-center px-0.5 shrink-0 my-0.5 leading-tight">
        <span
          style={{ color: '#000000' }}
          className={`font-extrabold text-black block truncate leading-tight ${
            isCompact ? 'text-[7px]' : 'text-[8.5px]'
          }`}
          title={product.name}
        >
          {product.name}
        </span>
      </div>

      {/* 3. Barcode Graphic + Human-Readable Number (Strictly Bounded Inside Sticker) */}
      <div className="w-full flex-1 flex items-center justify-center overflow-hidden bg-white my-0.5">
        {hasBarcode ? (
          <svg
            ref={svgRef}
            className={`max-w-[96%] ${isCompact ? 'max-h-[16px]' : 'max-h-[22px]'}`}
          />
        ) : (
          <div className="text-[6.5px] text-black font-extrabold border border-black bg-white px-1 py-0.5 rounded">
            NO BARCODE
          </div>
        )}
      </div>

      {/* 4. MRP / Selling Price (Prominent Jet Black Bold) */}
      <div className="w-full text-center shrink-0 leading-none my-0.5">
        <span
          style={{ color: '#000000' }}
          className={`font-black font-mono text-black leading-none ${
            isCompact ? 'text-[7.5px]' : 'text-[9px]'
          }`}
        >
          MRP: Rs. {product.sellingPrice.toFixed(2)}
        </span>
      </div>

      {/* 5. Bottom Row: MFG (left) & EXP (right) (Dark Bold Black, Strictly Inside Boundary) */}
      <div
        style={{ color: '#000000', borderColor: '#000000' }}
        className={`w-full flex justify-between items-center border-t border-black pt-0.5 px-0.5 ${
          isCompact ? 'text-[6px]' : 'text-[7px]'
        } font-sans font-bold text-black leading-none shrink-0`}
      >
        <span className="truncate font-bold text-black">
          {mfgDate ? `MFG: ${formatDate(mfgDate)}` : 'MFG: Fresh'}
        </span>
        <span className="truncate font-bold text-black">
          {expDate ? `EXP: ${formatDate(expDate)}` : 'EXP: Best Before'}
        </span>
      </div>
    </div>
  );
};
