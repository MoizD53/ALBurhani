import React, { useState, useEffect, useRef } from 'react';
import { Product } from '../../types';
import { 
  isWeightBasedProduct, 
  calculateLineTotal, 
  validateQuantity, 
  formatQuantity, 
  formatPriceWithBasis, 
  formatStock 
} from '../../lib/pricing';
import { Scale, PackageCheck, AlertCircle, Check, X } from 'lucide-react';

interface QuantitySelectorModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (product: Product, quantity: number, weightInGrams?: number) => void;
  existingCartQuantity?: number;
}

export const QuantitySelectorModal: React.FC<QuantitySelectorModalProps> = ({
  product,
  isOpen,
  onClose,
  onConfirm,
  existingCartQuantity = 0,
}) => {
  const isWeight = isWeightBasedProduct(product);

  // Hooks must be unconditional
  const [unitMode, setUnitMode] = useState<'g' | 'kg'>('g');
  const [inputValue, setInputValue] = useState<string>('250');
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Reset and focus when modal opens
  useEffect(() => {
    if (isOpen && product) {
      const weight = isWeightBasedProduct(product);
      if (weight) {
        setUnitMode('g');
        setInputValue('250');
      } else {
        setInputValue('1');
      }
      setError(null);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, product]);

  // Quick select presets
  const weightPresetsGrams = [50, 100, 250, 500, 1000];
  const piecePresets = [1, 2, 5, 10, 20];

  // Real-time calculation
  const numericVal = parseFloat(inputValue) || 0;
  const validation = product
    ? validateQuantity(product, numericVal, isWeight ? unitMode : 'pcs', existingCartQuantity)
    : { isValid: false, quantity: 0 };

  const lineCalc = product
    ? calculateLineTotal(product, {
        quantity: isWeight ? (unitMode === 'kg' ? numericVal : numericVal / 1000) : numericVal,
        grams: isWeight ? (unitMode === 'g' ? numericVal : Math.round(numericVal * 1000)) : undefined,
      })
    : { quantity: 0, lineTotal: 0, lineTotalPaise: 0 };

  const handlePresetClick = (presetValue: number) => {
    if (isWeight) {
      setUnitMode('g');
      setInputValue(presetValue.toString());
    } else {
      setInputValue(presetValue.toString());
    }
    setError(null);
    inputRef.current?.focus();
  };

  const handleConfirm = () => {
    if (!product || !validation.isValid) {
      setError(validation.error || 'Please enter a valid quantity');
      inputRef.current?.focus();
      return;
    }

    if (isWeight) {
      const grams = unitMode === 'g' ? numericVal : Math.round(numericVal * 1000);
      const kg = grams / 1000;
      onConfirm(product, kg, grams);
    } else {
      onConfirm(product, numericVal);
    }
    onClose();
  };

  // Global capture listener for Enter & Escape
  useEffect(() => {
    if (!isOpen || !product) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        handleConfirm();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown, true);
  }, [isOpen, numericVal, unitMode, isWeight, product, validation.isValid, onClose]);

  // Keyboard shortcut handler (Enter to confirm, Escape to cancel)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirm();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  // Early return after all React hooks
  if (!isOpen || !product) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div 
        className="relative w-full max-w-md rounded-2xl bg-[#121214] border border-[#D4AF37]/30 shadow-[0_24px_64px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="px-5 py-3.5 border-b border-white/[0.08] bg-[#161619] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] shrink-0">
              {isWeight ? <Scale className="w-4 h-4" /> : <PackageCheck className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#D4AF37] block leading-none">
                {isWeight ? 'Weight Quantity (KG / Grams)' : 'Piece Quantity (Count)'}
              </span>
              <h3 className="font-bold text-white text-sm sm:text-base truncate leading-snug mt-0.5">
                {product.name}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors"
            title="Cancel (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          
          {/* Product Meta & Pricing Basis */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.025] border border-white/[0.06]">
            <div>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Rate Basis</span>
              <span className="text-base font-bold font-mono text-[#E5C158]">
                {formatPriceWithBasis(product.sellingPrice, product.unit)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Available Stock</span>
              <span className={`text-xs font-mono font-semibold ${
                product.stock <= product.minStock ? 'text-amber-400' : 'text-emerald-400'
              }`}>
                {formatStock(product.stock, product.unit)}
              </span>
              {existingCartQuantity > 0 && (
                <span className="text-[10px] text-zinc-400 block">
                  ({formatQuantity(existingCartQuantity, product.unit)} in bill)
                </span>
              )}
            </div>
          </div>

          {/* Quick Presets Row */}
          <div>
            <div className="text-[11px] font-semibold text-zinc-400 mb-1.5 flex items-center justify-between">
              <span>Quick Select:</span>
              {isWeight && (
                <div className="flex items-center gap-1 bg-black/60 p-0.5 rounded-lg border border-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => {
                      if (unitMode !== 'g') {
                        setUnitMode('g');
                        setInputValue(Math.round(numericVal * 1000).toString());
                      }
                    }}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                      unitMode === 'g'
                        ? 'bg-[#D4AF37] text-black shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Grams (g)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (unitMode !== 'kg') {
                        setUnitMode('kg');
                        setInputValue((numericVal / 1000).toString());
                      }
                    }}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                      unitMode === 'kg'
                        ? 'bg-[#D4AF37] text-black shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Kg
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-5 gap-1.5">
              {isWeight
                ? weightPresetsGrams.map((grams) => {
                    const isSelected = unitMode === 'g' && numericVal === grams;
                    const label = grams >= 1000 ? `${grams / 1000}kg` : `${grams}g`;
                    return (
                      <button
                        key={grams}
                        type="button"
                        onClick={() => handlePresetClick(grams)}
                        className={`py-2 px-1 text-xs font-mono font-bold rounded-xl border transition-all ${
                          isSelected
                            ? 'bg-[#D4AF37] text-black border-[#D4AF37] shadow-[0_0_12px_rgba(212,175,55,0.3)]'
                            : 'bg-white/[0.03] text-zinc-300 border-white/[0.08] hover:bg-white/[0.08] hover:text-white'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })
                : piecePresets.map((pcs) => {
                    const isSelected = numericVal === pcs;
                    return (
                      <button
                        key={pcs}
                        type="button"
                        onClick={() => handlePresetClick(pcs)}
                        className={`py-2 px-1 text-xs font-mono font-bold rounded-xl border transition-all ${
                          isSelected
                            ? 'bg-[#D4AF37] text-black border-[#D4AF37] shadow-[0_0_12px_rgba(212,175,55,0.3)]'
                            : 'bg-white/[0.03] text-zinc-300 border-white/[0.08] hover:bg-white/[0.08] hover:text-white'
                        }`}
                      >
                        {pcs} pc{pcs > 1 ? 's' : ''}
                      </button>
                    );
                  })}
            </div>
          </div>

          {/* Custom Input Field */}
          <div>
            <label className="text-[11px] font-semibold text-zinc-400 block mb-1">
              {isWeight ? (
                <span>Enter Exact Weight ({unitMode === 'g' ? 'Grams' : 'Kilograms'}):</span>
              ) : (
                <span>Enter Quantity (Number of Pieces):</span>
              )}
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                type="number"
                step={isWeight && unitMode === 'kg' ? '0.05' : '1'}
                min="1"
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleConfirm();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    onClose();
                  }
                }}
                className={`w-full py-2.5 pl-4 pr-16 text-lg font-mono font-bold bg-black/80 border rounded-xl text-white placeholder:text-zinc-600 focus:outline-none transition-colors ${
                  !validation.isValid || error
                    ? 'border-red-500/70 focus:border-red-500'
                    : 'border-[#D4AF37]/50 focus:border-[#D4AF37]'
                }`}
                placeholder={isWeight ? (unitMode === 'g' ? 'e.g. 250, 375' : 'e.g. 0.25, 1.25') : 'e.g. 5'}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 font-mono text-xs font-bold text-zinc-400 uppercase pointer-events-none">
                {isWeight ? (unitMode === 'g' ? 'GRAMS' : 'KG') : 'PIECES'}
              </span>
            </div>

            {/* Error Message */}
            {(!validation.isValid || error) && (
              <div className="flex items-center gap-1.5 text-xs text-red-400 font-medium mt-1.5 animate-fade-in">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{error || validation.error}</span>
              </div>
            )}
          </div>

          {/* Live Calculation Preview Banner */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-[#D4AF37]/10 via-[#D4AF37]/5 to-transparent border border-[#D4AF37]/25 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 block leading-tight">
                Line Total Amount
              </span>
              <span className="text-xs text-zinc-300 font-mono mt-0.5 block">
                {isWeight
                  ? `${formatQuantity(lineCalc.quantity, 'KG', lineCalc.grams)} × ${formatPriceWithBasis(product.sellingPrice, 'KG')}`
                  : `${lineCalc.quantity} pcs × ${formatPriceWithBasis(product.sellingPrice, 'PCS')}`}
              </span>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black font-mono text-white tracking-tight">
                ₹{lineCalc.lineTotal.toFixed(2)}
              </span>
            </div>
          </div>

        </div>

        {/* Modal Actions */}
        <div className="px-5 py-3.5 border-t border-white/[0.08] bg-[#161619] flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
          >
            Cancel (Esc)
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!validation.isValid}
            className="btn-gold px-5 py-2 text-xs font-bold flex items-center gap-1.5 shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
            <span>Confirm & Add to Bill (Enter)</span>
          </button>
        </div>

      </div>
    </div>
  );
};
