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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-lg rounded-2xl bg-[#121214] border border-[#D4AF37]/30 shadow-[0_24px_64px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-white/[0.08] bg-[#161619] flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-bold text-white text-sm sm:text-base">Multiple Products Matched</h3>
            <p className="text-xs text-zinc-400 mt-0.5">Please select which product to add</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List of matched items */}
        <div className="p-4 overflow-y-auto space-y-2 custom-scrollbar flex-1">
          {products.map((p) => (
            <div
              key={p.id}
              onClick={() => {
                onSelectProduct(p);
                onClose();
              }}
              className="p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] hover:border-[#D4AF37]/40 transition-all cursor-pointer flex items-center justify-between gap-3 group"
            >
              <div className="min-w-0">
                <div className="font-semibold text-white text-sm group-hover:text-[#E5C158] transition-colors">
                  {p.name}
                </div>
                <div className="flex items-center gap-2 mt-1 text-xs text-zinc-400">
                  <span className="font-mono text-[#D4AF37]">{p.sku}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1 font-mono">
                    <Barcode className="w-3 h-3 text-zinc-500" />
                    {p.barcode}
                  </span>
                  <span>•</span>
                  <span>{formatStock(p.stock, p.unit)} in stock</span>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-sm font-bold font-mono text-white block">
                  {formatPriceWithBasis(p.sellingPrice, p.unit)}
                </span>
                <span className="text-[11px] text-[#D4AF37] group-hover:underline font-medium inline-flex items-center gap-1 mt-0.5">
                  Select <Check className="w-3 h-3" />
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/[0.08] bg-[#141418] flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
