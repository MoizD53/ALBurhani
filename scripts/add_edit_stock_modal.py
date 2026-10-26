with open('src/components/product-management/ProductManagementView.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Update interface
c = c.replace(
    'onUpdateStock?: (productId: string, newStock: number) => Promise<boolean> | boolean | void;\n  initialBarcodeToRegister?: string | null;\n  onClearInitialBarcode?: () => void;',
    'onUpdateStock?: (productId: string, newStock: number, reason?: string, actor?: string) => Promise<boolean> | boolean | void;\n  initialBarcodeToRegister?: string | null;\n  onClearInitialBarcode?: () => void;\n  actingUser?: string;'
)

# 2. Update props destructured
c = c.replace(
    '  initialBarcodeToRegister,\n  onClearInitialBarcode,\n}) => {',
    '  initialBarcodeToRegister,\n  onClearInitialBarcode,\n  actingUser = "Admin",\n}) => {'
)

# 3. Add state and handlers
state_hook_target = '  const [editingProduct, setEditingProduct] = useState<Product | null>(null);'
new_state_and_handlers = '''  // Manual Edit Stock Modal State
  const [editingStockProduct, setEditingStockProduct] = useState<Product | null>(null);
  const [manualStockInput, setManualStockInput] = useState<string>('0');
  const [stockAdjustmentReason, setStockAdjustmentReason] = useState<string>('Physical Inventory Count');
  const [stockCustomNotes, setStockCustomNotes] = useState<string>('');
  const [isSavingStock, setIsSavingStock] = useState(false);
  const [stockModalError, setStockModalError] = useState<string | null>(null);

  const handleOpenEditStockModal = (product: Product) => {
    setEditingStockProduct(product);
    setManualStockInput(String(product.stock ?? 0));
    setStockAdjustmentReason('Physical Inventory Count');
    setStockCustomNotes('');
    setStockModalError(null);
  };

  const handleSaveStockModal = async () => {
    if (!editingStockProduct) return;
    const val = Number(manualStockInput);
    if (isNaN(val)) {
      setStockModalError('Please enter a valid numeric stock quantity.');
      return;
    }
    setIsSavingStock(true);
    setStockModalError(null);
    try {
      const fullReason = stockCustomNotes.trim() 
        ? `${stockAdjustmentReason}: ${stockCustomNotes.trim()}`
        : stockAdjustmentReason;
      if (onUpdateStock) {
        await onUpdateStock(editingStockProduct.id, val, fullReason, actingUser || 'Admin');
      } else {
        onUpdateProduct({ ...editingStockProduct, stock: val });
      }
      setFeedbackToast({
        type: 'success',
        message: `Stock for "${editingStockProduct.name}" updated to ${val} ${editingStockProduct.unit}`,
      });
      setEditingStockProduct(null);
    } catch (err: any) {
      setStockModalError(err?.message || 'Failed to update stock');
    } finally {
      setIsSavingStock(false);
    }
  };

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);'''

c = c.replace(state_hook_target, new_state_and_handlers, 1)

# 4. Add Edit Stock button in Actions column
action_target = '''                            <button
                              onClick={() => handleOpenEditProduct(p)}
                              className="p-1.5 rounded-lg text-stone-500 hover:text-amber-700 hover:bg-amber-50/50 border border-transparent hover:border-amber-200 transition-colors"
                              title="Edit product item"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>'''

action_replacement = '''                            <button
                              onClick={() => handleOpenEditStockModal(p)}
                              className="p-1.5 rounded-lg text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 border border-transparent hover:border-emerald-200 transition-colors"
                              title="Edit Stock (Manual Inventory Adjustment)"
                            >
                              <Boxes className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleOpenEditProduct(p)}
                              className="p-1.5 rounded-lg text-stone-500 hover:text-amber-700 hover:bg-amber-50/50 border border-transparent hover:border-amber-200 transition-colors"
                              title="Edit product item"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>'''

c = c.replace(action_target, action_replacement, 1)

# 5. Insert Modal markup before final </div>\n  );\n};
modal_markup = '''      {/* ==================================================================== */}
      {/* 5. MANUAL EDIT STOCK MODAL                                           */}
      {/* ==================================================================== */}
      {editingStockProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-[#E8DEC8] rounded-2xl shadow-xl w-full max-w-lg overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-5 py-4 border-b border-[#E8DEC8] bg-[#FAF8F5] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-800 shadow-xs">
                  <Boxes className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-stone-900 font-serif">
                    Edit Stock Quantity
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Manual inventory adjustment with complete audit log
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingStockProduct(null)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              {stockModalError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span className="font-semibold">{stockModalError}</span>
                </div>
              )}

              {/* Product Identity Card */}
              <div className="p-3.5 bg-[#FAF8F5] border border-[#E8DEC8] rounded-xl space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-stone-900 text-sm leading-tight">
                      {editingStockProduct.name}
                    </h4>
                    <div className="flex items-center gap-2 text-stone-500 font-mono text-[11px] mt-1 flex-wrap">
                      <span className="bg-stone-100 px-1.5 py-0.5 rounded border border-stone-200">
                        SKU: {editingStockProduct.sku || 'N/A'}
                      </span>
                      <span className="bg-stone-100 px-1.5 py-0.5 rounded border border-stone-200">
                        Barcode: {editingStockProduct.barcode}
                      </span>
                      <span className="text-stone-600 font-semibold">
                        {editingStockProduct.category}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] uppercase font-bold text-stone-500 tracking-wider">Current Stock</div>
                    <div className={`font-mono text-sm font-extrabold ${
                      (editingStockProduct.stock ?? 0) > 0 ? 'text-emerald-700' : (editingStockProduct.stock ?? 0) === 0 ? 'text-stone-600' : 'text-red-600'
                    }`}>
                      {(editingStockProduct.stock ?? 0) > 0 ? `+${editingStockProduct.stock}` : `${editingStockProduct.stock ?? 0}`} {editingStockProduct.unit}
                    </div>
                  </div>
                </div>
              </div>

              {/* New Stock Input */}
              <div>
                <label className="text-xs font-bold text-stone-800 block mb-1.5">
                  New Stock Quantity ({editingStockProduct.unit}) <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step={editingStockProduct.unit === 'KG' ? '0.001' : '1'}
                    required
                    value={manualStockInput}
                    onChange={(e) => setManualStockInput(e.target.value)}
                    placeholder="0"
                    className="w-full px-3.5 py-2.5 text-sm font-mono font-bold bg-[#FAF8F5] border border-[#E8DEC8] rounded-xl text-stone-900 focus:bg-white focus:border-[#C99A18] focus:ring-1 focus:ring-[#C99A18] focus:outline-none"
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs font-semibold text-stone-400">
                    {editingStockProduct.unit}
                  </span>
                </div>
                <p className="text-[11px] text-stone-500 mt-1">
                  Enter any value. Zero and negative numbers (e.g. -3) are fully supported.
                </p>
              </div>

              {/* Live Preview of Effect */}
              {(() => {
                const prev = editingStockProduct.stock ?? 0;
                const nextVal = Number(manualStockInput);
                const isValid = !isNaN(nextVal);
                const diff = isValid ? (editingStockProduct.unit === 'KG' ? Math.round((nextVal - prev) * 1000) / 1000 : Math.round(nextVal - prev)) : 0;

                return (
                  <div className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                    !isValid
                      ? 'bg-stone-50 border-stone-200 text-stone-500'
                      : nextVal < 0
                      ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                      : diff > 0
                      ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                      : diff < 0
                      ? 'bg-rose-50/80 border-rose-200 text-rose-900'
                      : 'bg-stone-50 border-stone-200 text-stone-700'
                  }`}>
                    <div className="flex items-center justify-between font-mono font-semibold text-[11px]">
                      <span>Previous: {prev} {editingStockProduct.unit}</span>
                      <span>→</span>
                      <span>New: {isValid ? nextVal : '—'} {editingStockProduct.unit}</span>
                      <span>({diff >= 0 ? `+${diff}` : `${diff}`} {editingStockProduct.unit})</span>
                    </div>
                    <div className="text-[11px] leading-relaxed">
                      {!isValid ? (
                        'Enter a number to preview adjustment effect.'
                      ) : nextVal < 0 ? (
                        <span>⚠️ <strong>Negative Stock:</strong> Stock will be set to {nextVal} {editingStockProduct.unit}. Billing will continue normally without restrictions.</span>
                      ) : diff > 0 ? (
                        <span>Inventory will increase by <strong>+{diff} {editingStockProduct.unit}</strong>.</span>
                      ) : diff < 0 ? (
                        <span>Inventory will decrease by <strong>{Math.abs(diff)} {editingStockProduct.unit}</strong>.</span>
                      ) : (
                        <span>Stock remains unchanged at <strong>{nextVal} {editingStockProduct.unit}</strong>.</span>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Reason for Adjustment */}
              <div>
                <label className="text-xs font-bold text-stone-800 block mb-1.5">
                  Reason for Adjustment
                </label>
                <select
                  value={stockAdjustmentReason}
                  onChange={(e) => setStockAdjustmentReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E8DEC8] rounded-xl text-stone-900 focus:bg-white focus:border-[#C99A18] focus:outline-none mb-2"
                >
                  <option value="Physical Inventory Count">Physical Inventory Count</option>
                  <option value="Opening Stock Balance Correction">Opening Stock Balance Correction</option>
                  <option value="Damaged / Expired Goods">Damaged / Expired Goods</option>
                  <option value="Return / Exchange Adjustment">Return / Exchange Adjustment</option>
                  <option value="Receipt / Inward Correction">Receipt / Inward Correction</option>
                  <option value="Manual Correction">Manual Correction</option>
                </select>

                <input
                  type="text"
                  value={stockCustomNotes}
                  onChange={(e) => setStockCustomNotes(e.target.value)}
                  placeholder="Additional notes or reason details (optional)"
                  className="w-full px-3 py-1.5 text-xs bg-[#FAF8F5] border border-[#E8DEC8] rounded-xl text-stone-900 focus:bg-white focus:border-[#C99A18] focus:outline-none"
                />
              </div>

              {/* Acting Admin */}
              <div className="flex items-center justify-between text-[11px] text-stone-500 pt-2 border-t border-[#E8DEC8]">
                <span>Acting Operator: <strong className="text-stone-800 font-mono">{actingUser || 'Admin'}</strong></span>
                <span>Immediate Cloud Sync</span>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingStockProduct(null)}
                  disabled={isSavingStock}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:text-stone-900 hover:bg-[#FAF8F5] border border-[#E8DEC8] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveStockModal}
                  disabled={isSavingStock || isNaN(Number(manualStockInput))}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  {isSavingStock ? 'Saving Stock...' : 'Save Stock Adjustment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
'''

c = c.replace('\n    </div>\n  );\n};', '\n' + modal_markup + '\n    </div>\n  );\n};', 1)

with open('src/components/product-management/ProductManagementView.tsx', 'w', encoding='utf-8') as f:
    f.write(c)

print('Successfully updated ProductManagementView.tsx with Edit Stock Modal!')
