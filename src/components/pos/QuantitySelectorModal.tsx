import React, { useState, useEffect, useRef } from 'react';
import { Product } from '../../types';
import {
  isWeightBasedProduct,
  calculateLineTotal,
  validateQuantity,
  formatQuantity,
  formatPriceWithBasis
} from '../../lib/pricing';
import { Scale, PackageCheck, AlertCircle, Check, X, IndianRupee, Pencil } from 'lucide-react';

interface QuantitySelectorModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (
    product: Product,
    quantity: number,
    weightInGrams?: number,
    isEditMode?: boolean,
    customUnitPrice?: number
  ) => void;
  existingCartQuantity?: number;
  initialWeightInGrams?: number;
  initialQuantity?: number;
  initialUnitPrice?: number;
  isEditMode?: boolean;
}

export const QuantitySelectorModal: React.FC<QuantitySelectorModalProps> = ({
  product,
  isOpen,
  onClose,
  onConfirm,
  existingCartQuantity = 0,
  initialWeightInGrams,
  initialQuantity,
  initialUnitPrice,
  isEditMode = false,
}) => {
  const isWeight = isWeightBasedProduct(product);

  // Hooks must be unconditional
  const [entryMode, setEntryMode] = useState<'qty' | 'rupees'>('qty');
  const [unitMode, setUnitMode] = useState<'g' | 'kg'>('g');
  const [inputValue, setInputValue] = useState<string>('250');
  const [rupeesValue, setRupeesValue] = useState<string>('50');
  const [isEditingRate, setIsEditingRate] = useState<boolean>(false);
  const [customRate, setCustomRate] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const rupeesInputRef = useRef<HTMLInputElement>(null);

  const effectiveRate = parseFloat(customRate) > 0 ? parseFloat(customRate) : (product?.sellingPrice || 0);

  // Reset and focus when modal opens
  useEffect(() => {
    if (isOpen && product) {
      setEntryMode('qty');
      setIsEditingRate(false);
      setCustomRate(initialUnitPrice ? initialUnitPrice.toString() : '');
      const weight = isWeightBasedProduct(product);
      if (weight) {
        if (initialWeightInGrams && initialWeightInGrams > 0) {
          if (initialWeightInGrams >= 1000 && initialWeightInGrams % 1000 === 0) {
            setUnitMode('kg');
            setInputValue((initialWeightInGrams / 1000).toString());
          } else {
            setUnitMode('g');
            setInputValue(initialWeightInGrams.toString());
          }
        } else {
          setUnitMode('g');
          setInputValue('250');
        }
      } else {
        if (initialQuantity && initialQuantity > 0) {
          setInputValue(initialQuantity.toString());
        } else {
          setInputValue('1');
        }
      }
      setError(null);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, product, initialWeightInGrams, initialQuantity, initialUnitPrice]);

  // Quick select presets (includes 300g)
  const weightPresetsGrams = [50, 100, 200, 250, 300, 500, 1000];
  const piecePresets = [1, 2, 5, 10, 20];
  const rupeesPresets = [20, 50, 100, 150, 200, 500];

  // Real-time calculation based on entryMode
  let numericVal = parseFloat(inputValue) || 0;
  if (entryMode === 'rupees') {
    const targetRs = parseFloat(rupeesValue) || 0;
    if (targetRs > 0 && effectiveRate > 0) {
      if (isWeight) {
        // grams = targetRs / (effectiveRate / 1000)
        const calcGrams = Math.round((targetRs / effectiveRate) * 1000);
        numericVal = unitMode === 'kg' ? calcGrams / 1000 : calcGrams;
      } else {
        numericVal = Math.max(1, Math.round(targetRs / effectiveRate));
      }
    }
  }

  const effectiveProduct = product && effectiveRate !== product.sellingPrice
    ? { ...product, sellingPrice: effectiveRate }
    : product;

  const validation = effectiveProduct
    ? validateQuantity(effectiveProduct, numericVal, isWeight ? unitMode : 'pcs', existingCartQuantity)
    : { isValid: false, quantity: 0 };

  const lineCalc = effectiveProduct
    ? calculateLineTotal(effectiveProduct, {
        quantity: isWeight ? (unitMode === 'kg' ? numericVal : numericVal / 1000) : numericVal,
        grams: isWeight ? (unitMode === 'g' ? numericVal : Math.round(numericVal * 1000)) : undefined,
      })
    : { quantity: 0, grams: undefined, unitPrice: 0, lineTotal: 0, lineTotalPaise: 0 };

  const handlePresetClick = (presetValue: number) => {
    if (entryMode === 'rupees') {
      setRupeesValue(presetValue.toString());
    } else {
      if (isWeight) {
        setUnitMode('g');
        setInputValue(presetValue.toString());
      } else {
        setInputValue(presetValue.toString());
      }
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

    const appliedRate = parseFloat(customRate) > 0 ? parseFloat(customRate) : undefined;

    if (isWeight) {
      const grams = unitMode === 'g' ? numericVal : Math.round(numericVal * 1000);
      const kg = grams / 1000;
      onConfirm(product, kg, grams, isEditMode, appliedRate);
    } else {
      onConfirm(product, numericVal, undefined, isEditMode, appliedRate);
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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-sm animate-fade-in select-none"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div 
        className="relative w-full max-w-md rounded-2xl bg-white border border-[#E8DEC8] shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="px-5 py-3.5 border-b border-[#E8DEC8] bg-[#FAF8F5] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#FBF7EE] border border-[#C99A18]/30 flex items-center justify-center text-[#A67D0C] shrink-0">
              {isWeight ? <Scale className="w-4 h-4" /> : <PackageCheck className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#A67D0C] block leading-none">
                {isEditMode ? 'Edit Bill Quantity' : (isWeight ? 'Weight Quantity (KG / Grams)' : 'Piece Quantity (Count)')}
              </span>
              <h3 className="font-bold text-stone-900 text-sm sm:text-base truncate leading-snug mt-0.5">
                {product.name}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-200/60 transition-colors"
            title="Cancel (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 bg-white">
          
          {/* Product Meta & Pricing Basis */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#FAF8F5] border border-[#E8DEC8]">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-stone-500 uppercase font-semibold tracking-wider block">Rate Basis</span>
                {!isEditingRate && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingRate(true);
                      setCustomRate(effectiveRate.toString());
                    }}
                    className="text-[10px] text-[#A67D0C] hover:text-[#8B6508] font-bold flex items-center gap-0.5 underline cursor-pointer"
                    title="Override rate for this item"
                  >
                    <Pencil className="w-2.5 h-2.5" />
                    <span>Edit Rate</span>
                  </button>
                )}
              </div>
              {isEditingRate ? (
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-500">₹</span>
                    <input
                      type="number"
                      step="any"
                      min="1"
                      value={customRate}
                      onChange={(e) => setCustomRate(e.target.value)}
                      placeholder={product.sellingPrice.toString()}
                      className="w-24 pl-5 pr-2 py-1 text-xs font-bold font-mono bg-white border border-amber-400 rounded-lg text-stone-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingRate(false);
                      setCustomRate('');
                    }}
                    className="text-[10px] text-stone-500 hover:text-stone-700 underline"
                  >
                    Reset
                  </button>
                </div>
              ) : (
                <span className="text-base font-bold font-mono text-[#A67D0C]">
                  {formatPriceWithBasis(effectiveRate, product.unit)}
                  {effectiveRate !== product.sellingPrice && (
                    <span className="text-[10px] text-stone-400 line-through ml-1.5">
                      ₹{product.sellingPrice}
                    </span>
                  )}
                </span>
              )}
            </div>
            <div className="text-right">
              <span className="text-[10px] text-stone-500 uppercase font-semibold tracking-wider block">Category</span>
              <span className="text-xs font-bold text-stone-700">
                {product.category}
              </span>
              {existingCartQuantity > 0 && (
                <span className="text-[10px] text-stone-500 block">
                  ({formatQuantity(existingCartQuantity, product.unit)} in bill)
                </span>
              )}
            </div>
          </div>

          {/* Mode Selector: By Quantity vs By Rupees */}
          <div className="flex rounded-xl bg-[#FAF8F5] p-1 border border-[#E8DEC8]">
            <button
              type="button"
              onClick={() => {
                setEntryMode('qty');
                setError(null);
                setTimeout(() => inputRef.current?.focus(), 50);
              }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                entryMode === 'qty'
                  ? 'bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              {isWeight ? 'By Weight (Grams / KG)' : 'By Quantity (Pieces)'}
            </button>
            <button
              type="button"
              onClick={() => {
                setEntryMode('rupees');
                setError(null);
                setTimeout(() => rupeesInputRef.current?.focus(), 50);
              }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${
                entryMode === 'rupees'
                  ? 'bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-white shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <IndianRupee className="w-3.5 h-3.5" />
              <span>By Target Amount (₹)</span>
            </button>
          </div>

          {/* Quick Presets Row */}
          <div>
            <div className="text-[11px] font-bold text-stone-700 mb-1.5 flex items-center justify-between">
              <span>{entryMode === 'rupees' ? 'Quick Rupees (₹):' : 'Quick Select:'}</span>
              {entryMode === 'qty' && isWeight && (
                <div className="flex items-center gap-1 bg-[#FAF8F5] p-0.5 rounded-lg border border-[#E8DEC8]">
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
                        ? 'bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-white shadow-sm'
                        : 'text-stone-600 hover:text-stone-900'
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
                        ? 'bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-white shadow-sm'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    Kg
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-5 sm:grid-cols-6 gap-1.5">
              {entryMode === 'rupees'
                ? rupeesPresets.map((rs) => {
                    const isSelected = parseFloat(rupeesValue) === rs;
                    return (
                      <button
                        key={rs}
                        type="button"
                        onClick={() => handlePresetClick(rs)}
                        className={`py-2 px-1 text-xs font-mono font-bold rounded-xl border transition-all ${
                          isSelected
                            ? 'bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-white border-[#B8860B] shadow-sm'
                            : 'bg-[#FAF8F5] text-stone-700 border-[#E8DEC8] hover:bg-[#F5F2EB] hover:text-stone-900'
                        }`}
                      >
                        ₹{rs}
                      </button>
                    );
                  })
                : isWeight
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
                            ? 'bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-white border-[#B8860B] shadow-sm'
                            : 'bg-[#FAF8F5] text-stone-700 border-[#E8DEC8] hover:bg-[#F5F2EB] hover:text-stone-900'
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
                            ? 'bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-white border-[#B8860B] shadow-sm'
                            : 'bg-[#FAF8F5] text-stone-700 border-[#E8DEC8] hover:bg-[#F5F2EB] hover:text-stone-900'
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
            <label className="text-[11px] font-bold text-stone-700 block mb-1">
              {entryMode === 'rupees' ? (
                <span>Enter Amount (in ₹ Rupees):</span>
              ) : isWeight ? (
                <span>Enter Exact Weight ({unitMode === 'g' ? 'Grams' : 'Kilograms'}):</span>
              ) : (
                <span>Enter Quantity (Number of Pieces):</span>
              )}
            </label>
            <div className="relative">
              {entryMode === 'rupees' ? (
                <>
                  <input
                    ref={rupeesInputRef}
                    type="number"
                    step="1"
                    min="1"
                    value={rupeesValue}
                    onChange={(e) => {
                      setRupeesValue(e.target.value);
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
                    className="w-full py-2.5 pl-8 pr-16 text-lg font-mono font-bold bg-[#FAF8F5] border border-[#E8DEC8] rounded-xl text-stone-900 placeholder:text-stone-400 focus:bg-white focus:border-[#C99A18] focus:outline-none"
                    placeholder="e.g. 50, 100"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm font-bold text-stone-500 pointer-events-none">
                    ₹
                  </span>
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-mono text-xs font-bold text-stone-400 uppercase pointer-events-none">
                    RUPEES
                  </span>
                </>
              ) : (
                <>
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
                    className={`w-full py-2.5 pl-4 pr-16 text-lg font-mono font-bold bg-[#FAF8F5] border rounded-xl text-stone-900 placeholder:text-stone-400 focus:bg-white focus:outline-none transition-colors ${
                      !validation.isValid || error
                        ? 'border-rose-400 focus:border-rose-500'
                        : 'border-[#E8DEC8] focus:border-[#C99A18]'
                    }`}
                    placeholder={isWeight ? (unitMode === 'g' ? 'e.g. 250, 375' : 'e.g. 0.25, 1.25') : 'e.g. 5'}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 font-mono text-xs font-bold text-stone-400 uppercase pointer-events-none">
                    {isWeight ? (unitMode === 'g' ? 'GRAMS' : 'KG') : 'PIECES'}
                  </span>
                </>
              )}
            </div>

            {/* Error Message */}
            {(!validation.isValid || error) && (
              <div className="flex items-center gap-1.5 text-xs text-rose-600 font-medium mt-1.5 animate-fade-in">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{error || validation.error}</span>
              </div>
            )}
          </div>

          {/* Live Calculation Preview Banner */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-[#FBF7EE] to-[#FAF8F5] border border-[#E8DEC8] flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-stone-500 block leading-tight">
                Line Total Amount
              </span>
              <span className="text-xs text-stone-600 font-mono mt-0.5 block">
                {isWeight
                  ? `${formatQuantity(lineCalc.quantity, 'KG', lineCalc.grams)} × ${formatPriceWithBasis(lineCalc.unitPrice, 'KG')}`
                  : `${lineCalc.quantity} pcs × ${formatPriceWithBasis(lineCalc.unitPrice, 'PCS')}`}
              </span>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black font-mono text-stone-900 tracking-tight">
                Rs. {lineCalc.lineTotal.toFixed(2)}
              </span>
            </div>
          </div>

        </div>

        {/* Modal Actions */}
        <div className="px-5 py-3.5 border-t border-[#E8DEC8] bg-[#FAF8F5] flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 transition-colors"
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
            <span>{isEditMode ? 'Update Quantity (Enter)' : 'Confirm & Add to Bill (Enter)'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
