import React from 'react';
import { Product } from '../../types';
import { formatPriceWithBasis, formatStock } from '../../lib/pricing';
import { Barcode, Check, X } from 'lucide-react';

interface MultipleMatchModalProps {
  products: Product[];
  isOpen: boolean;
  onClose: () => void;
  onSelectProduct: (product: Product) => void;
}

export const MultipleMatchModal: React.FC<MultipleMatchModalProps> = ({
  products,
  isOpen,
  onClose,
  onSelectProduct,
}) => {
  if (!isOpen || products.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-sm animate-fade-in select-none">
      <div className="relative w-full max-w-lg rounded-2xl bg-white border border-[#E8DEC8] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] max-h-[85dvh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E8DEC8] bg-[#FAF8F5] flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-bold text-stone-900 text-sm sm:text-base">Multiple Products Matched</h3>
            <p className="text-xs text-stone-500 mt-0.5">Please select which product to add</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-200/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List of matched items */}
        <div className="p-4 overflow-y-auto space-y-2 custom-scrollbar flex-1 bg-white">
          {products.map((p) => (
            <div
              key={p.id}
              onClick={() => {
                onSelectProduct(p);
                onClose();
              }}
              className="p-3 rounded-xl bg-[#FAF8F5] hover:bg-[#F5F2EB] border border-[#E8DEC8] hover:border-[#C99A18] transition-all cursor-pointer flex items-center justify-between gap-3 group shadow-sm"
            >
              <div className="min-w-0">
                <div className="font-bold text-stone-900 text-sm group-hover:text-[#A67D0C] transition-colors">
                  {p.name}
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-stone-500">
                  <span className="font-mono font-semibold text-[#B8860B]">{p.sku}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1 font-mono">
                    <Barcode className="w-3.5 h-3.5 text-stone-400" />
                    {p.barcode}
                  </span>
                  <span>•</span>
                  <span>{formatStock(p.stock, p.unit)} in stock</span>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-sm font-bold font-mono text-stone-900 block">
                  {formatPriceWithBasis(p.sellingPrice, p.unit)}
                </span>
                <span className="text-[11px] text-[#A67D0C] group-hover:underline font-bold inline-flex items-center gap-1 mt-0.5">
                  Select <Check className="w-3 h-3" />
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#E8DEC8] bg-[#FAF8F5] flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
