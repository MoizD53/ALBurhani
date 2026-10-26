import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Plus, 
  Trash2, 
  Search, 
  Package, 
  AlertCircle, 
  Check, 
  IndianRupee,
  Calendar,
  FileText,
  User,
  Phone
} from 'lucide-react';
import { Product, PurchaseBill, PurchaseItem, Vendor } from '../../types';
import { getKolkataDateString } from '../../lib/utils';

interface NewPurchaseBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (bill: PurchaseBill) => Promise<boolean>;
  existingVendors: Vendor[];
  products: Product[];
  editingBill?: PurchaseBill | null;
}

interface SearchableProductSelectProps {
  products: Product[];
  selectedProductId?: string;
  onSelect: (product?: Product) => void;
}

const SearchableProductSelect: React.FC<SearchableProductSelectProps> = ({
  products,
  selectedProductId,
  onSelect,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 320,
  });

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId),
    [products, selectedProductId]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase().trim();
    return products.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      (p.sku && p.sku.toLowerCase().includes(q)) ||
      (p.barcode && p.barcode.includes(q)) ||
      (p.category && p.category.toLowerCase().includes(q))
    );
  }, [products, search]);

  const updateCoords = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const popoverWidth = 320;
      let left = rect.left;
      if (left + popoverWidth > window.innerWidth - 12) {
        left = Math.max(12, window.innerWidth - popoverWidth - 12);
      }
      if (left < 12) left = 12;

      const spaceBelow = window.innerHeight - rect.bottom;
      const popoverHeight = 320;
      let top = rect.bottom + 4;
      if (spaceBelow < popoverHeight && rect.top > popoverHeight) {
        top = Math.max(10, rect.top - popoverHeight - 4);
      }
      setCoords({ top, left, width: popoverWidth });
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updateCoords();
    window.addEventListener('resize', updateCoords);
    window.addEventListener('scroll', updateCoords, true);
    return () => {
      window.removeEventListener('resize', updateCoords);
      window.removeEventListener('scroll', updateCoords, true);
    };
  }, [isOpen, updateCoords]);

  return (
    <div className="w-full min-w-[130px]">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          updateCoords();
          setIsOpen(!isOpen);
          setSearch('');
        }}
        className={`w-full px-2 py-1.5 text-[11px] rounded-lg text-left flex items-center justify-between transition-colors shadow-2xs cursor-pointer border ${
          selectedProduct
            ? 'bg-amber-50/90 border-[#C99A18] text-[#8C6D15] font-bold'
            : 'bg-[#FAF8F5] hover:bg-white border-[#E8DEC8] hover:border-[#C99A18] text-stone-700'
        }`}
        title={selectedProduct ? `Linked to ${selectedProduct.name}` : 'Click to search and select product'}
      >
        <span className="truncate">
          {selectedProduct ? selectedProduct.name : '🔍 Select Product'}
        </span>
        <Search className="w-3 h-3 text-stone-400 shrink-0 ml-1" />
      </button>

      {isOpen && typeof document !== 'undefined' && createPortal(
        <>
          {/* Backdrop for outside click */}
          <div
            className="fixed inset-0 z-[99998] bg-black/15"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(false);
            }}
          />

          {/* Floating unclipped dropdown */}
          <div
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              width: `${coords.width}px`,
              zIndex: 99999,
            }}
            className="bg-white border-2 border-[#C99A18] rounded-xl shadow-2xl overflow-hidden animate-fade-in text-left flex flex-col max-h-[340px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-2 border-b border-[#E8DEC8] bg-[#FAF8F5] shrink-0">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Search by name, SKU or barcode..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-[#E8DEC8] rounded-lg text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#C99A18]"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-0.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="text-[10px] text-stone-500 font-medium mt-1 px-1 flex justify-between items-center">
                <span>{filtered.length} of {products.length} products</span>
                <span className="text-[#A67D0C] font-semibold">Click to link & auto-fill</span>
              </div>
            </div>

            <div className="overflow-y-auto custom-scrollbar divide-y divide-[#F5F2EB] flex-1">
              <button
                type="button"
                onClick={() => {
                  onSelect(undefined);
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-2 text-left text-xs hover:bg-amber-50 flex items-center justify-between transition-colors cursor-pointer ${
                  !selectedProductId ? 'bg-amber-50 font-bold text-[#8C6D15]' : 'text-stone-600'
                }`}
              >
                <div>
                  <div className="font-semibold text-stone-800">Auto-create / Unlinked Item</div>
                  <div className="text-[10px] text-stone-400">Creates new catalog item or matches name</div>
                </div>
                {!selectedProductId && <Check className="w-4 h-4 text-[#C99A18] shrink-0" />}
              </button>

              {filtered.map((p) => {
                const isSelected = p.id === selectedProductId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onSelect(p);
                      setIsOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-xs hover:bg-[#FAF8F5] flex items-center justify-between transition-colors cursor-pointer ${
                      isSelected ? 'bg-amber-50 font-bold text-[#8C6D15]' : 'text-stone-800'
                    }`}
                  >
                    <div className="min-w-0 pr-2 flex-1">
                      <div className="truncate font-semibold text-stone-900">{p.name}</div>
                      <div className="text-[10px] text-stone-500 flex items-center gap-2 mt-0.5 font-mono">
                        <span>{p.category || 'General'}</span>
                        <span>·</span>
                        <span>{p.unit}</span>
                        {p.costPrice > 0 && (
                          <>
                            <span>·</span>
                            <span className="text-emerald-700 font-bold">Cost: Rs.{p.costPrice}</span>
                          </>
                        )}
                        <span>·</span>
                        <span className="text-stone-600">Stock: {p.stock || 0}</span>
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-[#C99A18] shrink-0 ml-2" />}
                  </button>
                );
              })}

              {filtered.length === 0 && (
                <div className="p-4 text-center text-xs text-stone-400">
                  No matching product found for "{search}"
                </div>
              )}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
};

export const NewPurchaseBillModal: React.FC<NewPurchaseBillModalProps> = ({
  isOpen,
  onClose,
  onSave,
  existingVendors,
  products,
  editingBill = null,
}) => {
  // Vendor Info
  const [vendorName, setVendorName] = useState('');
  const [vendorContact, setVendorContact] = useState('');
  const [vendorInvoiceNumber, setVendorInvoiceNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(() => getKolkataDateString(Date.now()));
  const [notes, setNotes] = useState('');
  const [paymentMode, setPaymentMode] = useState<string>('Cash');
  const [amountPaid, setAmountPaid] = useState<string>('0');

  // Vendor Autocomplete
  const [vendorQuery, setVendorQuery] = useState('');
  const [showVendorSuggestions, setShowVendorSuggestions] = useState(false);

  // Line Items
  const [items, setItems] = useState<PurchaseItem[]>([
    { productName: '', quantity: 1, unit: 'PCS', unitPrice: 0, lineTotal: 0 },
  ]);

  // Discount & Charges
  const [discount, setDiscount] = useState<string>('0');
  const [additionalCharges, setAdditionalCharges] = useState<string>('0');

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form when opening or editing
  useEffect(() => {
    if (isOpen) {
      if (editingBill) {
        setVendorName(editingBill.vendorName || '');
        setVendorContact(editingBill.vendorContact || '');
        setVendorInvoiceNumber(editingBill.vendorInvoiceNumber || '');
        setPurchaseDate(editingBill.purchaseDate || getKolkataDateString(Date.now()));
        setNotes(editingBill.notes || '');
        setPaymentMode(editingBill.paymentMode || 'Cash');
        setAmountPaid(String(editingBill.amountPaid || 0));
        setDiscount(String(editingBill.discount || 0));
        setAdditionalCharges(String(editingBill.additionalCharges || 0));
        setItems(
          editingBill.items && editingBill.items.length > 0
            ? editingBill.items.map((it) => ({ ...it }))
            : [{ productName: '', quantity: 1, unit: 'PCS', unitPrice: 0, lineTotal: 0 }]
        );
      } else {
        setVendorName('');
        setVendorContact('');
        setVendorInvoiceNumber('');
        setPurchaseDate(getKolkataDateString(Date.now()));
        setNotes('');
        setPaymentMode('Cash');
        setAmountPaid('0');
        setDiscount('0');
        setAdditionalCharges('0');
        setItems([{ productName: '', quantity: 1, unit: 'PCS', unitPrice: 0, lineTotal: 0 }]);
      }
      setError(null);
    }
  }, [isOpen, editingBill]);

  // Vendor suggestions
  const filteredVendors = useMemo(() => {
    if (!vendorName.trim()) return [];
    const q = vendorName.toLowerCase().trim();
    return existingVendors.filter(
      (v) => v.name.toLowerCase().includes(q) || (v.contactNumber && v.contactNumber.includes(q))
    );
  }, [vendorName, existingVendors]);

  // Financial Calculations
  const subtotal = useMemo(() => {
    return items.reduce((sum, it) => sum + (Number(it.lineTotal) || 0), 0);
  }, [items]);

  const numDiscount = parseFloat(discount) || 0;
  const numCharges = parseFloat(additionalCharges) || 0;
  const grandTotal = Math.max(0, Math.round((subtotal - numDiscount + numCharges) * 100) / 100);

  const numAmountPaid = parseFloat(amountPaid) || 0;
  const balanceDue = Math.max(0, Math.round((grandTotal - numAmountPaid) * 100) / 100);

  const paymentStatus: 'Paid' | 'Partially Paid' | 'Unpaid' =
    balanceDue <= 0.01 ? 'Paid' : numAmountPaid > 0 ? 'Partially Paid' : 'Unpaid';

  // Handle Item Row Change
  const updateItem = (index: number, patch: Partial<PurchaseItem>) => {
    setItems((prev) => {
      const copy = [...prev];
      const updated = { ...copy[index], ...patch };
      // Recalculate line total if quantity or unitPrice changed
      const qty = typeof updated.quantity === 'number' ? updated.quantity : parseFloat(String(updated.quantity)) || 0;
      const rate = typeof updated.unitPrice === 'number' ? updated.unitPrice : parseFloat(String(updated.unitPrice)) || 0;
      updated.lineTotal = Math.round(qty * rate * 100) / 100;
      copy[index] = updated;
      return copy;
    });
  };

  const addItemRow = () => {
    setItems((prev) => [
      ...prev,
      { productName: '', quantity: 1, unit: 'PCS', unitPrice: 0, lineTotal: 0 },
    ]);
  };

  const removeItemRow = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Product Selection Autocomplete for a row
  const handleSelectProduct = (index: number, prod: Product) => {
    updateItem(index, {
      productId: prod.id,
      productName: prod.name,
      unit: prod.unit || 'PCS',
      unitPrice: prod.costPrice > 0 ? prod.costPrice : 0,
    });
  };

  const handleSelectVendor = (v: Vendor) => {
    setVendorName(v.name);
    if (v.contactNumber) setVendorContact(v.contactNumber);
    setShowVendorSuggestions(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorName.trim()) {
      setError('Please provide a vendor or supplier name.');
      return;
    }

    const validItems = items.filter((it) => it.productName.trim() && it.quantity > 0);
    if (validItems.length === 0) {
      setError('Please add at least one valid item with a name and quantity > 0.');
      return;
    }

    // Auto-link items to matching products in catalog if not explicitly selected
    const processedItems = validItems.map((it) => {
      if (it.productId) return it;
      const matched = products.find(
        (p) => p.name.trim().toLowerCase() === it.productName.trim().toLowerCase()
      );
      if (matched) {
        return { ...it, productId: matched.id };
      }
      return it;
    });

    setIsSubmitting(true);
    setError(null);

    const billPayload: PurchaseBill = {
      id: editingBill?.id || `pur-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      purchaseNumber: editingBill?.purchaseNumber || '',
      dailyBillNumber: editingBill?.dailyBillNumber || 0,
      businessDate: editingBill?.businessDate || purchaseDate,
      vendorName: vendorName.trim(),
      vendorContact: vendorContact.trim() || undefined,
      vendorInvoiceNumber: vendorInvoiceNumber.trim() || undefined,
      purchaseDate,
      items: processedItems,
      subtotal,
      discount: numDiscount,
      additionalCharges: numCharges,
      grandTotal,
      amountPaid: numAmountPaid,
      balanceDue,
      paymentStatus,
      paymentMode,
      notes: notes.trim() || undefined,
      status: editingBill?.status || 'Active',
      createdAt: editingBill?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      const ok = await onSave(billPayload);
      if (ok) {
        onClose();
      } else {
        setError('Failed to persist purchase bill. Please check connection and try again.');
      }
    } catch (err: any) {
      setError(err?.message || 'Error saving purchase bill.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-[#E8DEC8] rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-6">
        
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-[#E8DEC8] bg-[#FAF8F5] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#FAF8F5] border border-[#E8DEC8] text-[#B8860B]">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900 font-serif">
                {editingBill ? `Edit Purchase Bill — ${editingBill.purchaseNumber}` : 'Record New Purchase Bill'}
              </h2>
              <span className="text-[11px] text-stone-500 font-mono">
                Store inventory stock & vendor ledger entry
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Vendor & Invoice Details */}
          <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E8DEC8] space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#A67D0C] block">
              1. Supplier & Invoice Information
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Vendor Name with Suggestion Dropdown */}
              <div className="relative">
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  Vendor / Supplier Name <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={vendorName}
                  onChange={(e) => {
                    setVendorName(e.target.value);
                    setShowVendorSuggestions(true);
                  }}
                  onFocus={() => setShowVendorSuggestions(true)}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#E8DEC8] rounded-xl text-stone-900 focus:border-[#C99A18] focus:outline-none font-semibold"
                />

                {/* Vendor Autocomplete Popover */}
                {showVendorSuggestions && filteredVendors.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white border border-[#E8DEC8] rounded-xl shadow-lg max-h-40 overflow-y-auto">
                    {filteredVendors.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => handleSelectVendor(v)}
                        className="w-full px-3 py-2 text-left text-xs hover:bg-[#FAF8F5] border-b border-[#F0EBE0] last:border-none flex items-center justify-between"
                      >
                        <span className="font-bold text-stone-800">{v.name}</span>
                        {v.contactNumber && (
                          <span className="text-[10px] text-stone-500 font-mono">{v.contactNumber}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Vendor Contact */}
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  Contact Number
                </label>
                <input
                  type="text"
                  value={vendorContact}
                  onChange={(e) => setVendorContact(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#E8DEC8] rounded-xl text-stone-900 focus:border-[#C99A18] focus:outline-none font-mono"
                />
              </div>

              {/* Purchase Date */}
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  Purchase Date <span className="text-rose-600">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#E8DEC8] rounded-xl text-stone-900 focus:border-[#C99A18] focus:outline-none font-mono font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  Vendor Bill / Challan / Invoice # (Optional)
                </label>
                <input
                  type="text"
                  value={vendorInvoiceNumber}
                  onChange={(e) => setVendorInvoiceNumber(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#E8DEC8] rounded-xl text-stone-900 focus:border-[#C99A18] focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  Notes / Batch Details
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#E8DEC8] rounded-xl text-stone-900 focus:border-[#C99A18] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* 2. Items Purchased */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#A67D0C]">
                2. Items Purchased ({items.length} {items.length === 1 ? 'item' : 'items'})
              </span>
              <button
                type="button"
                onClick={addItemRow}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-[#FAF8F5] text-[#8C6D15] hover:bg-[#F3EAD3] border border-[#C99A18]/40 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            {/* Items Table (Desktop & Tablet) */}
            <div className="border border-[#E8DEC8] rounded-xl overflow-hidden bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-[#FAF8F5] text-[10px] font-bold text-stone-500 uppercase border-b border-[#E8DEC8]">
                    <tr>
                      <th className="py-2.5 px-3 min-w-[200px]">Item / Product Name</th>
                      <th className="py-2.5 px-3 w-24">Link Catalog</th>
                      <th className="py-2.5 px-3 w-20 text-center">Qty</th>
                      <th className="py-2.5 px-3 w-20 text-center">Unit</th>
                      <th className="py-2.5 px-3 w-24 text-right">Price / Unit</th>
                      <th className="py-2.5 px-3 w-24 text-right">Line Total</th>
                      <th className="py-2.5 px-2 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0EBE0]">
                    {items.map((it, idx) => (
                      <tr key={idx} className="hover:bg-[#FAF8F5]/50">
                        {/* Item Name */}
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            list={`catalog-items-${idx}`}
                            required
                            value={it.productName}
                            onChange={(e) => {
                              const val = e.target.value;
                              const matched = products.find((p) => p.name.toLowerCase() === val.toLowerCase());
                              if (matched) {
                                handleSelectProduct(idx, matched);
                              } else {
                                updateItem(idx, { productName: val });
                              }
                            }}
                            placeholder="Enter item name"
                            className="w-full px-2 py-1.5 text-xs bg-[#FAF8F5] border border-[#E8DEC8] rounded-lg text-stone-900 focus:bg-white focus:border-[#C99A18] focus:outline-none font-semibold"
                          />
                          <datalist id={`catalog-items-${idx}`}>
                            {products.map((p) => (
                              <option key={p.id} value={p.name}>
                                {p.category} · Stock: {p.stock} {p.unit}
                              </option>
                            ))}
                          </datalist>
                        </td>

                        {/* Optional Product Link */}
                        <td className="py-2 px-3">
                          <SearchableProductSelect
                            products={products}
                            selectedProductId={it.productId}
                            onSelect={(prod) => {
                              if (prod) {
                                handleSelectProduct(idx, prod);
                              } else {
                                updateItem(idx, { productId: undefined });
                              }
                            }}
                          />
                        </td>

                        {/* Quantity */}
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            step="any"
                            min="0.001"
                            required
                            value={it.quantity || ''}
                            onChange={(e) => updateItem(idx, { quantity: parseFloat(e.target.value) || 0 })}
                            className="w-full px-2 py-1.5 text-xs text-center font-mono font-bold bg-[#FAF8F5] border border-[#E8DEC8] rounded-lg text-stone-900 focus:bg-white focus:border-[#C99A18] focus:outline-none"
                          />
                        </td>

                        {/* Unit */}
                        <td className="py-2 px-3">
                          <select
                            value={it.unit || 'PCS'}
                            onChange={(e) => updateItem(idx, { unit: e.target.value })}
                            className="w-full px-2 py-1.5 text-xs text-center bg-[#FAF8F5] border border-[#E8DEC8] rounded-lg text-stone-700 focus:bg-white focus:border-[#C99A18] focus:outline-none font-semibold"
                          >
                            <option value="PCS">PCS</option>
                            <option value="KG">KG</option>
                            <option value="Box">Box</option>
                            <option value="Packet">Packet</option>
                            <option value="Pouch">Pouch</option>
                            <option value="Jar">Jar</option>
                            <option value="Litre">Litre</option>
                            <option value="Tin">Tin</option>
                          </select>
                        </td>

                        {/* Unit Price */}
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            required
                            value={it.unitPrice || ''}
                            onChange={(e) => updateItem(idx, { unitPrice: parseFloat(e.target.value) || 0 })}
                            placeholder="0.00"
                            className="w-full px-2 py-1.5 text-xs text-right font-mono font-bold bg-[#FAF8F5] border border-[#E8DEC8] rounded-lg text-stone-900 focus:bg-white focus:border-[#C99A18] focus:outline-none"
                          />
                        </td>

                        {/* Line Total */}
                        <td className="py-2 px-3 text-right font-mono font-bold text-stone-900">
                          Rs. {it.lineTotal.toFixed(2)}
                        </td>

                        {/* Delete Row */}
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            disabled={items.length <= 1}
                            onClick={() => removeItemRow(idx)}
                            className="p-1 rounded-md text-stone-400 hover:text-rose-600 disabled:opacity-30 disabled:hover:text-stone-400 transition-colors"
                            title="Remove row"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* 3. Totals & Payment Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-[#FAF8F5] border border-[#E8DEC8]">
            {/* Payment Details */}
            <div className="space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#A67D0C] block">
                3. Payment Details
              </span>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Payment Mode</label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-[#E8DEC8] rounded-xl text-stone-900 font-semibold focus:border-[#C99A18] focus:outline-none"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI / QR</option>
                    <option value="Bank Transfer">Bank Transfer / NEFT</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Amount Paid (Rs.)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-[#E8DEC8] rounded-xl text-stone-900 font-mono font-bold focus:border-[#C99A18] focus:outline-none"
                  />
                </div>
              </div>

              {/* Quick Exact / Full Paid Button */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAmountPaid(grandTotal.toString())}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-[#FBF7EE] text-[#8C6D15] border border-[#C99A18]/40 hover:bg-[#F3EAD3]"
                >
                  Pay Full (Rs. {grandTotal})
                </button>
                <button
                  type="button"
                  onClick={() => setAmountPaid('0')}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-stone-100 text-stone-700 hover:bg-stone-200 border border-stone-300"
                >
                  Unpaid (Full Credit)
                </button>
              </div>
            </div>

            {/* Calculations Breakdown */}
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between text-stone-600">
                <span>Items Subtotal:</span>
                <span className="font-bold text-stone-900">Rs. {subtotal.toFixed(2)}</span>
              </div>

              <div className="flex justify-between items-center text-stone-600">
                <span>Discount (−):</span>
                <div className="flex items-center gap-1">
                  <span>Rs.</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    className="w-20 text-right py-0.5 px-1.5 text-xs bg-white border border-[#E8DEC8] rounded font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center text-stone-600">
                <span>Freight / Extra Charges (+):</span>
                <div className="flex items-center gap-1">
                  <span>Rs.</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={additionalCharges}
                    onChange={(e) => setAdditionalCharges(e.target.value)}
                    className="w-20 text-right py-0.5 px-1.5 text-xs bg-white border border-[#E8DEC8] rounded font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-between text-sm font-bold text-stone-900 border-t border-[#E8DEC8] pt-2">
                <span>Grand Total:</span>
                <span className="font-black text-[#A67D0C] text-base">Rs. {grandTotal.toFixed(2)}</span>
              </div>

              <div className="flex justify-between text-xs pt-1">
                <span>Amount Paid:</span>
                <span className="text-emerald-700 font-bold">−Rs. {numAmountPaid.toFixed(2)}</span>
              </div>

              <div className="flex justify-between text-xs font-bold border-t border-[#E8DEC8] pt-1">
                <span className={balanceDue > 0 ? 'text-amber-800' : 'text-emerald-700'}>
                  {balanceDue > 0 ? 'Vendor Balance Due (उधार):' : 'Status:'}
                </span>
                <span className={balanceDue > 0 ? 'text-amber-900 font-black' : 'text-emerald-700 font-black'}>
                  {balanceDue > 0 ? `Rs. ${balanceDue.toFixed(2)}` : 'Fully Paid'}
                </span>
              </div>
            </div>
          </div>

          {/* Modal Actions Footer */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E8DEC8]">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:text-stone-900 hover:bg-[#FAF8F5] border border-[#E8DEC8]"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="py-2 px-5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#D4AF37] to-[#B8860B] hover:brightness-105 shadow-md flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Saving...' : editingBill ? 'Save Changes' : 'Confirm Purchase Bill'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
