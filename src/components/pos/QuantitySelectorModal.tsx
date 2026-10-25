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

  const [unitMode, setUnitMode] = useState<'g' | 'kg'>('g');
  const [inputValue, setInputValue] = useState<string>('250');
  const [totalInputValue, setTotalInputValue] = useState<string>('');
  const [isEditingRate, setIsEditingRate] = useState<boolean>(false);
  const [customRate, setCustomRate] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const lineTotalInputRef = useRef<HTMLInputElement>(null);
  const lastEditedFieldRef = useRef<'qty' | 'total'>('qty');

  const effectiveRate = parseFloat(customRate) > 0 ? parseFloat(customRate) : (product?.sellingPrice || 0);

  // Quick select presets
  const weightPresetsGrams = [50, 100, 200, 250, 300, 500, 1000];
  const piecePresets = [1, 2, 5, 10, 20];

  const numericVal = parseFloat(inputValue) || 0;

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

  // Reset and focus when modal opens
  useEffect(() => {
    if (isOpen && product) {
      lastEditedFieldRef.current = 'qty';
      setIsEditingRate(false);
      setCustomRate(initialUnitPrice ? initialUnitPrice.toString() : '');
      const weight = isWeightBasedProduct(product);
      let initQty = '1';
      if (weight) {
        if (initialWeightInGrams && initialWeightInGrams > 0) {
          if (initialWeightInGrams >= 1000 && initialWeightInGrams % 1000 === 0) {
            setUnitMode('kg');
            initQty = (initialWeightInGrams / 1000).toString();
          } else {
            setUnitMode('g');
            initQty = initialWeightInGrams.toString();
          }
        } else {
          setUnitMode('g');
          initQty = '250';
        }
      } else {
        if (initialQuantity && initialQuantity > 0) {
          initQty = initialQuantity.toString();
        } else {
          initQty = '1';
        }
      }
      setInputValue(initQty);
      setError(null);

      const rate = initialUnitPrice && initialUnitPrice > 0 ? initialUnitPrice : product.sellingPrice;
      const numQ = parseFloat(initQty) || 0;
      const initialCalc = calculateLineTotal(
        { ...product, sellingPrice: rate },
        {
          quantity: weight ? (unitMode === 'kg' ? numQ : numQ / 1000) : numQ,
          grams: weight ? (unitMode === 'g' ? numQ : Math.round(numQ * 1000)) : undefined,
        }
      );
      setTotalInputValue(initialCalc.lineTotal > 0 ? initialCalc.lineTotal.toFixed(2) : '');

      const timer = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, product, initialWeightInGrams, initialQuantity, initialUnitPrice]);

  // Keep total input synchronized when user edits quantity or presets
  useEffect(() => {
    if (lastEditedFieldRef.current === 'qty') {
      if (lineCalc.lineTotal > 0) {
        setTotalInputValue(lineCalc.lineTotal.toFixed(2));
      } else {
        setTotalInputValue('');
      }
    }
  }, [lineCalc.lineTotal]);

  const handlePresetClick = (presetValue: number) => {
    lastEditedFieldRef.current = 'qty';
    if (isWeight) {
      setUnitMode('g');
      setInputValue(presetValue.toString());
    } else {
      setInputValue(presetValue.toString());
    }
    setError(null);
    inputRef.current?.focus();
  };

  const handleQuantityInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    lastEditedFieldRef.current = 'qty';
    setInputValue(e.target.value);
    setError(null);
  };

  // Direct editing in the Line Total Amount box
  const handleTotalInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valStr = e.target.value;
    lastEditedFieldRef.current = 'total';
    setTotalInputValue(valStr);
    setError(null);

    const enteredTotal = parseFloat(valStr);
    if (isNaN(enteredTotal) || enteredTotal < 0) return;

    if (enteredTotal === 0) {
      setInputValue('0');
      return;
    }

    if (effectiveRate <= 0) return;

    if (isWeight) {
      // Calculate exact grams from entered amount: grams = (targetRs / rate_per_kg) * 1000
      const calcGrams = Math.round((enteredTotal / effectiveRate) * 1000);
      if (calcGrams > 0) {
        if (unitMode === 'kg') {
          setInputValue((calcGrams / 1000).toString());
        } else {
          setInputValue(calcGrams.toString());
        }
      }
    } else {
      // Piece-based product:
      // If entered total is an exact multiple of the item rate:
      if (enteredTotal >= effectiveRate && Math.abs(enteredTotal % effectiveRate) < 0.001) {
        const calcPcs = Math.round(enteredTotal / effectiveRate);
        setInputValue(calcPcs.toString());
        setCustomRate('');
      } else {
        // Direct price override: customer/admin enters custom total for current quantity
        const currentQty = Math.max(1, Math.round(parseFloat(inputValue) || 1));
        const newUnitRate = Math.round((enteredTotal / currentQty) * 100) / 100;
        setCustomRate(newUnitRate.toString());
      }
    }
  };

  const handleTotalInputBlur = () => {
    lastEditedFieldRef.current = 'qty';
    if (lineCalc.lineTotal > 0) {
      setTotalInputValue(lineCalc.lineTotal.toFixed(2));
    }
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

          {/* Quick Presets Row */}
          <div>
            <div className="text-[11px] font-bold text-stone-700 mb-1.5 flex items-center justify-between">
              <span>Quick Select:</span>
              {isWeight && (
                <div className="flex items-center gap-1 bg-[#FAF8F5] p-0.5 rounded-lg border border-[#E8DEC8]">
                  <button
                    type="button"
                    onClick={() => {
                      if (unitMode !== 'g') {
                        setUnitMode('g');
                        setInputValue(Math.round(numericVal * 1000).toString());
                      }
                    }}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer ${
                      unitMode === 'g'
                        ? 'bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-white shadow-xs'
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
                    className={`px-2 py-0.5 text-[10px] font-bold rounded cursor-pointer ${
                      unitMode === 'kg'
                        ? 'bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-white shadow-xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    Kg
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-5 sm:grid-cols-6 gap-1.5">
              {isWeight
                ? weightPresetsGrams.map((grams) => {
                    const isSelected = unitMode === 'g' && numericVal === grams;
                    const label = grams >= 1000 ? `${grams / 1000}kg` : `${grams}g`;
                    return (
                      <button
                        key={grams}
                        type="button"
                        onClick={() => handlePresetClick(grams)}
                        className={`py-2 px-1 text-xs font-mono font-bold rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-white border-[#B8860B] shadow-xs'
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
                        className={`py-2 px-1 text-xs font-mono font-bold rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-white border-[#B8860B] shadow-xs'
                            : 'bg-[#FAF8F5] text-stone-700 border-[#E8DEC8] hover:bg-[#F5F2EB] hover:text-stone-900'
                        }`}
                      >
                        {pcs} pc{pcs > 1 ? 's' : ''}
                      </button>
                    );
                  })}
            </div>
          </div>

          {/* Custom Quantity Input Field */}
          <div>
            <label className="text-[11px] font-bold text-stone-700 block mb-1">
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
                min="0.001"
                value={inputValue}
                onChange={handleQuantityInputChange}
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
            </div>

            {/* Error Message */}
            {(!validation.isValid || error) && (
              <div className="flex items-center gap-1.5 text-xs text-rose-600 font-medium mt-1.5 animate-fade-in">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{error || validation.error}</span>
              </div>
            )}
          </div>

          {/* Directly Editable Line Total Amount Banner */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-[#FBF7EE] to-[#FAF8F5] border-2 border-[#C99A18]/60 focus-within:border-[#C99A18] focus-within:ring-2 focus-within:ring-[#C99A18]/20 transition-all flex items-center justify-between gap-3 shadow-2xs">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-stone-600 block leading-tight">
                  Line Total Amount
                </span>
                <span className="text-[9px] font-bold text-[#8C6D15] bg-[#F5EACB] px-1.5 py-0.5 rounded leading-none">
                  Directly Editable
                </span>
              </div>
              <span className="text-xs text-stone-600 font-mono mt-1 block truncate">
                {isWeight
                  ? `${formatQuantity(lineCalc.quantity, 'KG', lineCalc.grams)} × ${formatPriceWithBasis(lineCalc.unitPrice, 'KG')}`
                  : `${lineCalc.quantity} pcs × ${formatPriceWithBasis(lineCalc.unitPrice, 'PCS')}`}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-base font-black font-mono text-stone-700">Rs.</span>
              <input
                ref={lineTotalInputRef}
                type="number"
                step="any"
                min="0"
                value={totalInputValue}
                onChange={handleTotalInputChange}
                onBlur={handleTotalInputBlur}
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleConfirm();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    onClose();
                  }
                }}
                placeholder="0.00"
                className="w-28 sm:w-36 py-1 px-2 text-xl sm:text-2xl font-black font-mono text-right text-stone-900 bg-white border border-[#E8DEC8] focus:border-[#C99A18] rounded-lg focus:outline-none shadow-2xs"
                title="Type target total amount directly to auto-calculate price or quantity"
              />
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
