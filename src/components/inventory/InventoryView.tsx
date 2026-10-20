import React, { useState, useMemo } from 'react';
import { 
  Package, 
  Plus, 
  Search, 
  Tag, 
  AlertTriangle, 
  Barcode, 
  Check, 
  X, 
  Edit2, 
  Download 
} from 'lucide-react';
import { Product, ProductCategory, SellingUnit } from '../../types';
import { 
  formatPriceWithBasis, 
  formatStock, 
  isWeightBasedProduct 
} from '../../lib/pricing';

interface InventoryViewProps {
  products: Product[];
  onAddProduct: (product: Product) => void;
  onUpdateProduct: (product: Product) => void;
  onUpdateStock: (productId: string, newStock: number) => void;
  onOpenStickerModal: (product: Product) => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  products,
  onAddProduct,
  onUpdateProduct,
  onUpdateStock,
  onOpenStickerModal,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Quick Stock Editing state
  const [quickStockEditingId, setQuickStockEditingId] = useState<string | null>(null);
  const [editStockVal, setEditStockVal] = useState<number>(0);

  // Form State
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [category, setCategory] = useState<ProductCategory>('Sweets');
  const [unit, setUnit] = useState<SellingUnit>('KG');
  const [costPrice, setCostPrice] = useState<number>(0);
  const [sellingPrice, setSellingPrice] = useState<number>(100);
  const [stock, setStock] = useState<number>(0);
  const [minStock, setMinStock] = useState<number>(0);
  const [mrp, setMrp] = useState<number>(100);
  const [taxRate, setTaxRate] = useState<number>(0);
  const [shelfLifeDays, setShelfLifeDays] = useState<number>(30);
  const [priceTiers, setPriceTiers] = useState<{ minQuantity: number; price: number }[]>([]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category && p.category.trim()) {
        set.add(p.category.trim());
      }
    });
    const primaryOrder = [
      'SNACKS',
      'FARSAAN MIX',
      'SWEETS',
      'BAKERY',
      'PURI',
      'ROASTED',
      'CHIPS',
      'KHARAS',
      'ACHAR',
      'CHATNI',
      'PAPAD',
      'MUKHWAS',
      'MAWA',
      'PAAK',
      'PARA',
      'TOAST',
      'PANIPURI PANI FLAVOUR',
    ];
    const ordered = primaryOrder.filter((c) => set.has(c));
    const others = Array.from(set).filter((c) => !primaryOrder.includes(c)).sort();
    return ['All', ...ordered, ...others];
  }, [products]);

  // Open modal for Adding
  const handleOpenAdd = () => {
    setEditingProduct(null);
    setName('');
    const randomSkuNum = Math.floor(100 + Math.random() * 900);
    setSku(`00${randomSkuNum}`);
    const randomBarcode = Math.floor(100000 + Math.random() * 900000);
    setBarcode(`890100${randomBarcode}`);
    setCategory('SNACKS');
    setUnit('KG');
    setCostPrice(0);
    setSellingPrice(100);
    setStock(10);
    setMinStock(2);
    setMrp(100);
    setTaxRate(5);
    setShelfLifeDays(30);
    setPriceTiers([]);
    setIsModalOpen(true);
  };

  // Open modal for Editing
  const handleOpenEdit = (product: Product) => {
    setEditingProduct(product);
    setName(product.name);
    setSku(product.sku);
    setBarcode(product.barcode);
    setCategory(product.category);
    setUnit(product.unit as SellingUnit);
    setCostPrice(product.costPrice);
    setSellingPrice(product.sellingPrice);
    setStock(product.stock);
    setMinStock(product.minStock);
    setMrp(product.mrp || product.sellingPrice);
    setTaxRate(product.taxRate || 5);
    setShelfLifeDays(product.shelfLifeDays || 30);
    setPriceTiers(product.priceTiers || []);
    setIsModalOpen(true);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !sku.trim() || !barcode.trim()) return;

    const isWeight = unit === 'KG';
    const priceBasis = isWeight ? 'Rs./kg' : 'Rs./pc';

    const productPayload: Product = {
      id: editingProduct ? editingProduct.id : Date.now().toString(),
      name: name.trim(),
      sku: sku.trim(),
      barcode: barcode.trim(),
      category,
      unit,
      priceBasis,
      costPrice: Number(costPrice) || 0,
      sellingPrice: Number(sellingPrice) || 0,
      stock: Number(stock) || 0,
      minStock: Number(minStock) || 0,
      mrp: Number(mrp) || Number(sellingPrice),
      taxRate: Number(taxRate) || 0,
      shelfLifeDays: Number(shelfLifeDays) || 30,
      priceTiers: priceTiers.filter((t) => t.minQuantity > 0 && t.price > 0),
    };

    if (editingProduct) {
      onUpdateProduct(productPayload);
    } else {
      onAddProduct(productPayload);
    }
    setIsModalOpen(false);
  };

  const filtered = products.filter((p) => {
    const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
    const q = search.trim().toLowerCase();
    if (!q) return matchesCat;

    const matchesSearch =
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q)) ||
      p.category.toLowerCase().includes(q);

    return matchesCat && matchesSearch;
  });

  // Export catalogue to CSV
  const handleExportCSV = () => {
    const headers = ['Product Name', 'SKU / Code', 'Barcode', 'Category', 'Unit', 'Price Basis', 'Cost Price', 'Selling Price', 'Current Stock', 'Min Stock Alert', 'MRP', 'Tax Rate (%)'];
    const rows = products.map((p) => [
      `"${p.name.replace(/"/g, '""')}"`,
      `="${p.sku}"`, // preserve leading zeroes in Excel
      `="${p.barcode}"`, // preserve leading zeroes in Excel
      `"${p.category}"`,
      p.unit,
      p.priceBasis || (isWeightBasedProduct(p) ? 'Rs./kg' : 'Rs./pc'),
      p.costPrice,
      p.sellingPrice,
      p.stock,
      p.minStock,
      p.mrp || p.sellingPrice,
      p.taxRate || 5,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `AL_BHURANI_Inventory_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 select-none">
      
      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-stone-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-[#B8860B]" />
            <span>Inventory & Price Catalogue</span>
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            {products.length} Products Total · {products.filter((p) => p.stock <= p.minStock).length} Low Stock Alerts
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-white text-stone-700 hover:text-stone-900 hover:bg-[#FAF8F5] border border-[#E8DEC8] flex items-center gap-1.5 transition-colors shadow-sm"
            title="Export full catalogue to CSV / Excel"
          >
            <Download className="w-3.5 h-3.5 text-stone-500" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="btn-gold text-xs py-2 px-3.5 flex items-center gap-1.5 font-bold shadow-md"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Controls: Search and Categories */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        
        {/* Category Filter Pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar flex-nowrap">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setSelectedCategory(c)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
                selectedCategory === c
                  ? 'bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-white shadow-sm'
                  : 'bg-white text-stone-600 hover:text-stone-900 hover:bg-[#FAF8F5] border border-[#E8DEC8]'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-72 shrink-0">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, SKU, or barcode..."
            style={{ paddingLeft: '34px' }}
            className="w-full pr-8 py-2 text-xs bg-white border border-[#E8DEC8] rounded-xl text-stone-900 placeholder:text-stone-400 focus:border-[#C99A18] focus:ring-1 focus:ring-[#C99A18] focus:outline-none shadow-sm"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

      </div>

      {/* Mobile Inventory Cards (< 640px) */}
      <div className="sm:hidden space-y-2.5">
        {filtered.map((p) => {
          const isLow = p.stock <= p.minStock && p.stock > 0;
          const isOut = p.stock <= 0;
          const isEditingStock = quickStockEditingId === p.id;

          return (
            <div 
              key={p.id}
              className="p-3.5 rounded-2xl bg-white border border-[#E8DEC8] shadow-sm space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="font-bold text-stone-900 text-sm leading-tight">{p.name}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono text-[10px] text-[#A67D0C] font-bold">{p.sku}</span>
                    <span className="text-stone-300">·</span>
                    <span className="font-mono text-[10px] text-stone-500">{p.barcode}</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#FAF8F5] text-stone-700 border border-[#E8DEC8] font-semibold shrink-0">
                  {p.category}
                </span>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-[#F5F2EB]">
                <div>
                  <div className="font-mono font-bold text-stone-900 text-base">
                    {formatPriceWithBasis(p.sellingPrice, p.unit)}
                  </div>
                  <div className="text-[10px] text-stone-400">
                    Cost: Rs. {p.costPrice} · {isWeightBasedProduct(p) ? 'Weight (KG)' : 'Count (PCS)'}
                  </div>
                </div>

                {/* Stock Badge & Quick Edit */}
                <div>
                  {isEditingStock ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step={isWeightBasedProduct(p) ? '0.25' : '1'}
                        value={editStockVal}
                        onChange={(e) => setEditStockVal(Number(e.target.value))}
                        className="w-16 py-1 px-1.5 text-xs font-mono font-bold text-center rounded-lg border border-[#C99A18] bg-white"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            onUpdateStock(p.id, editStockVal);
                            setQuickStockEditingId(null);
                          }
                          if (e.key === 'Escape') setQuickStockEditingId(null);
                        }}
                      />
                      <button
                        onClick={() => {
                          onUpdateStock(p.id, editStockVal);
                          setQuickStockEditingId(null);
                        }}
                        className="p-1.5 rounded-lg bg-emerald-600 text-white min-h-[36px] min-w-[36px] flex items-center justify-center"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setQuickStockEditingId(p.id);
                        setEditStockVal(p.stock);
                      }}
                      className={`px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${
                        isOut
                          ? 'bg-rose-50 border-rose-200 text-rose-700'
                          : isLow
                          ? 'bg-amber-50 border-amber-200 text-amber-700'
                          : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      }`}
                    >
                      <span className="font-bold font-mono text-xs">
                        {formatStock(p.stock, p.unit)}
                      </span>
                      <Edit2 className="w-3 h-3 text-stone-400" />
                    </button>
                  )}
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex items-center gap-2 pt-1 border-t border-[#F5F2EB]">
                <button
                  onClick={() => handleOpenEdit(p)}
                  className="flex-1 py-2 px-3 rounded-xl bg-stone-50 hover:bg-stone-100 border border-[#E8DEC8] text-stone-700 text-xs font-bold flex items-center justify-center gap-1.5 min-h-[44px]"
                >
                  <Edit2 className="w-3.5 h-3.5 text-[#B8860B]" />
                  <span>Edit Details</span>
                </button>
                <button
                  onClick={() => onOpenStickerModal(p)}
                  className="py-2 px-3 rounded-xl bg-[#FAF8F5] border border-[#E8DEC8] text-[#B8860B] text-xs font-bold flex items-center justify-center gap-1.5 min-h-[44px] shrink-0"
                >
                  <Tag className="w-3.5 h-3.5" />
                  <span>Barcode Sticker</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Inventory Table (Tablets & Desktop) */}
      <div className="hidden sm:block rounded-2xl bg-white border border-[#E8DEC8] overflow-hidden shadow-sm">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#E8DEC8] bg-[#FAF8F5] text-stone-600 uppercase tracking-wider font-bold text-[10px]">
                <th className="py-3 px-4">SKU / Code</th>
                <th className="py-3 px-4">Barcode</th>
                <th className="py-3 px-4">Product Name</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-center">Unit Basis</th>
                <th className="py-3 px-4 text-right">Cost</th>
                <th className="py-3 px-4 text-right">Selling Price</th>
                <th className="py-3 px-4 text-center">Stock Level</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8DEC8]">
              {filtered.map((p) => {
                const isLow = p.stock <= p.minStock && p.stock > 0;
                const isOut = p.stock <= 0;
                const isEditingStock = quickStockEditingId === p.id;

                return (
                  <tr key={p.id} className="hover:bg-[#FAF8F5] transition-colors">
                    {/* SKU / Code */}
                    <td className="py-3 px-4 font-mono font-bold text-[#A67D0C] whitespace-nowrap">
                      {p.sku}
                    </td>

                    {/* Barcode */}
                    <td className="py-3 px-4 font-mono text-stone-600 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Barcode className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                        <span>{p.barcode}</span>
                      </div>
                    </td>

                    {/* Name */}
                    <td className="py-3 px-4 min-w-[180px]">
                      <div className="font-bold text-stone-900">{p.name}</div>
                      <div className="text-[10px] text-stone-400">Exp: {p.expiryDate || 'N/A'}</div>
                    </td>

                    {/* Category */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#FAF8F5] text-stone-700 border border-[#E8DEC8] font-semibold">
                        {p.category}
                      </span>
                    </td>

                    {/* Unit Basis */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        isWeightBasedProduct(p)
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : 'bg-blue-50 text-blue-800 border border-blue-200'
                      }`}>
                        {isWeightBasedProduct(p) ? 'KG (Weight)' : 'PCS (Count)'}
                      </span>
                    </td>

                    {/* Cost */}
                    <td className="py-3 px-4 text-right font-mono text-stone-500 whitespace-nowrap">
                      Rs. {p.costPrice}
                    </td>

                    {/* Selling Price */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="font-mono font-bold text-stone-900 text-sm">
                        {formatPriceWithBasis(p.sellingPrice, p.unit)}
                      </div>
                      {p.priceTiers && p.priceTiers.length > 0 && (
                        <div className="text-[10px] text-[#A67D0C] font-semibold tracking-tight mt-0.5">
                          ⚡ {p.priceTiers.length} Bulk {p.priceTiers.length === 1 ? 'Tier' : 'Tiers'}
                        </div>
                      )}
                    </td>

                    {/* Stock Units (with quick inline edit) */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {isEditingStock ? (
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type="number"
                            step={isWeightBasedProduct(p) ? '0.25' : '1'}
                            value={editStockVal}
                            onChange={(e) => setEditStockVal(Number(e.target.value))}
                            className="w-16 py-0.5 px-1.5 text-center text-xs bg-white border border-[#C99A18] rounded font-mono text-stone-900"
                            autoFocus
                          />
                          <button
                            onClick={() => {
                              onUpdateStock(p.id, editStockVal);
                              setQuickStockEditingId(null);
                            }}
                            className="p-1 rounded btn-gold"
                            title="Save stock"
                          >
                            <Check className="w-3 h-3 stroke-[2.5]" />
                          </button>
                        </div>
                      ) : (
                        <div 
                          onClick={() => {
                            setQuickStockEditingId(p.id);
                            setEditStockVal(p.stock);
                          }}
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg cursor-pointer border transition-colors ${
                            isOut
                              ? 'bg-rose-50 border-rose-200 text-rose-700'
                              : isLow 
                              ? 'bg-amber-50 border-amber-200 text-amber-700' 
                              : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          }`}
                          title="Click to quickly edit stock count"
                        >
                          <span className="font-bold font-mono text-xs">
                            {formatStock(p.stock, p.unit)}
                          </span>
                          <Edit2 className="w-3 h-3 text-stone-400 hover:text-stone-700" />
                        </div>
                      )}
                    </td>

                    {/* Actions: Edit & Sticker */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleOpenEdit(p)}
                          className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 hover:text-stone-900 transition-colors"
                          title="Edit Product Details"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => onOpenStickerModal(p)}
                          className="p-1.5 rounded-lg bg-[#FAF8F5] hover:bg-[#F5F2EB] text-[#B8860B] hover:text-[#A67D0C] border border-[#E8DEC8] transition-colors"
                          title="Print Thermal Barcode Sticker"
                        >
                          <Tag className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-sm animate-fade-in select-none">
          <div className="relative w-full max-w-lg rounded-2xl bg-white border border-[#E8DEC8] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-[#E8DEC8] bg-[#FAF8F5] flex items-center justify-between shrink-0">
              <h3 className="font-bold text-stone-900 text-sm sm:text-base flex items-center gap-2">
                <Package className="w-4 h-4 text-[#B8860B]" />
                <span>{editingProduct ? 'Edit Product Setup' : 'Add New Sweets / Namkeen Product'}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-200/60 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveProduct} className="p-5 overflow-y-auto space-y-4 custom-scrollbar flex-1 bg-white">
              
              <div>
                <label className="text-xs text-stone-700 font-bold block mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Kaju Katli Special, Gulab Jamun"
                  className="w-full text-xs py-2 px-3 bg-white border border-[#E8DEC8] rounded-xl text-stone-900 focus:border-[#C99A18] focus:ring-1 focus:ring-[#C99A18] focus:outline-none shadow-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-stone-700 font-bold block mb-1">
                    Product Code / SKU *
                  </label>
                  <input
                    type="text"
                    required
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="e.g. 00101"
                    className="w-full text-xs py-2 px-3 bg-white border border-[#E8DEC8] rounded-xl text-stone-900 font-mono focus:border-[#C99A18] focus:ring-1 focus:ring-[#C99A18] focus:outline-none shadow-sm"
                  />
                  <span className="text-[10px] text-stone-400 mt-0.5 block">Preserves leading zeroes</span>
                </div>

                <div>
                  <label className="text-xs text-stone-700 font-bold block mb-1">
                    Barcode Number *
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      required
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                      placeholder="e.g. 890100100101"
                      className="w-full text-xs py-2 px-3 bg-white border border-[#E8DEC8] rounded-xl text-stone-900 font-mono focus:border-[#C99A18] focus:ring-1 focus:ring-[#C99A18] focus:outline-none shadow-sm"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const random = Math.floor(100000 + Math.random() * 900000);
                        setBarcode(`890100${random}`);
                      }}
                      className="px-2.5 py-1 bg-[#FAF8F5] border border-[#E8DEC8] rounded-xl text-xs text-[#A67D0C] hover:bg-[#F5F2EB] font-bold shrink-0 shadow-sm"
                      title="Auto-Generate Barcode"
                    >
                      Gen
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-stone-700 font-bold block mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full text-xs py-2 px-3 bg-white border border-[#E8DEC8] rounded-xl text-stone-900 focus:border-[#C99A18] focus:ring-1 focus:ring-[#C99A18] focus:outline-none shadow-sm"
                  >
                    {categories.filter((c) => c !== 'All').map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-stone-700 font-bold block mb-1">
                    Selling Unit *
                  </label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as SellingUnit)}
                    className="w-full text-xs py-2 px-3 bg-white border border-[#E8DEC8] rounded-xl text-stone-900 font-bold focus:border-[#C99A18] focus:ring-1 focus:ring-[#C99A18] focus:outline-none shadow-sm"
                  >
                    <option value="KG">KG — Sold by Weight (e.g. Rs. 800/kg)</option>
                    <option value="PCS">PCS — Sold by Count (e.g. Rs. 20/pc)</option>
                    <option value="Box">Box (Count)</option>
                    <option value="Pack">Pack (Count)</option>
                    <option value="Tin">Tin (Count)</option>
                    <option value="Jar">Jar (Count)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-stone-700 font-bold block mb-1">
                    Selling Price (Rs. {unit === 'KG' ? 'per KG' : 'per piece'}) *
                  </label>
                  <input
                    type="number"
                    step={unit === 'KG' ? '10' : '1'}
                    required
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(Number(e.target.value))}
                    className="w-full text-xs py-2 px-3 bg-white border border-[#E8DEC8] rounded-xl text-stone-900 font-mono font-bold focus:border-[#C99A18] focus:ring-1 focus:ring-[#C99A18] focus:outline-none shadow-sm"
                  />
                </div>

                <div>
                  <label className="text-xs text-stone-700 font-bold block mb-1">
                    Cost Price (Rs. {unit === 'KG' ? 'per KG' : 'per piece'})
                  </label>
                  <input
                    type="number"
                    value={costPrice}
                    onChange={(e) => setCostPrice(Number(e.target.value))}
                    className="w-full text-xs py-2 px-3 bg-white border border-[#E8DEC8] rounded-xl text-stone-900 font-mono focus:border-[#C99A18] focus:ring-1 focus:ring-[#C99A18] focus:outline-none shadow-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-stone-700 font-bold block mb-1">
                    Stock ({unit === 'KG' ? 'in KG' : 'in Pieces'}) *
                  </label>
                  <input
                    type="number"
                    step={unit === 'KG' ? '0.25' : '1'}
                    required
                    value={stock}
                    onChange={(e) => setStock(Number(e.target.value))}
                    className="w-full text-xs py-2 px-3 bg-white border border-[#E8DEC8] rounded-xl text-stone-900 font-mono focus:border-[#C99A18] focus:ring-1 focus:ring-[#C99A18] focus:outline-none shadow-sm"
                  />
                </div>

                <div>
                  <label className="text-xs text-stone-700 font-bold block mb-1">
                    Min Stock Alert
                  </label>
                  <input
                    type="number"
                    value={minStock}
                    onChange={(e) => setMinStock(Number(e.target.value))}
                    className="w-full text-xs py-2 px-3 bg-white border border-[#E8DEC8] rounded-xl text-stone-900 font-mono focus:border-[#C99A18] focus:ring-1 focus:ring-[#C99A18] focus:outline-none shadow-sm"
                  />
                </div>

                <div>
                  <label className="text-xs text-stone-700 font-bold block mb-1">
                    GST Rate (%)
                  </label>
                  <input
                    type="number"
                    value={taxRate}
                    onChange={(e) => setTaxRate(Number(e.target.value))}
                    className="w-full text-xs py-2 px-3 bg-white border border-[#E8DEC8] rounded-xl text-stone-900 font-mono focus:border-[#C99A18] focus:ring-1 focus:ring-[#C99A18] focus:outline-none shadow-sm"
                  />
                </div>
              </div>

              {/* Quantity-Based Bulk Pricing Tiers */}
              <div className="p-3.5 bg-[#FAF8F5] border border-[#E8DEC8] rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-[#A67D0C] block">
                      Quantity-Based Pricing Tiers (Bulk Discounts)
                    </span>
                    <span className="text-[10px] text-stone-500">
                      Configure dynamic unit prices when customers buy in larger quantities ({unit === 'KG' ? 'e.g. 2 kg or more' : 'e.g. 5 pcs or more'}).
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setPriceTiers((prev) => [
                        ...prev,
                        {
                          minQuantity: unit === 'KG' ? 2 : 5,
                          price: sellingPrice > 10 ? Math.round(sellingPrice * 0.9) : sellingPrice,
                        },
                      ])
                    }
                    className="text-[11px] px-2.5 py-1 bg-[#FBF7EE] hover:bg-[#F5F2EB] text-[#A67D0C] border border-[#C99A18]/40 rounded-lg flex items-center gap-1 font-bold transition-all cursor-pointer shadow-sm"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Tier</span>
                  </button>
                </div>

                {priceTiers.length === 0 ? (
                  <p className="text-[11px] text-stone-400 italic py-1">
                    No quantity tiers configured. Standard price (Rs. {sellingPrice} {unit === 'KG' ? '/kg' : '/pc'}) applies for all quantities.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {priceTiers.map((tier, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 bg-white p-2 rounded-lg border border-[#E8DEC8] shadow-sm"
                      >
                        <span className="text-[11px] text-stone-600 font-bold shrink-0">
                          Qty ≥
                        </span>
                        <input
                          type="number"
                          step={unit === 'KG' ? '0.25' : '1'}
                          min="0.1"
                          placeholder={unit === 'KG' ? 'Min kg' : 'Min pcs'}
                          value={tier.minQuantity || ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setPriceTiers((prev) =>
                              prev.map((t, i) => (i === idx ? { ...t, minQuantity: val } : t))
                            );
                          }}
                          className="w-20 text-xs py-1 px-2 bg-white border border-[#E8DEC8] rounded text-stone-900 font-mono focus:border-[#C99A18] focus:outline-none"
                        />
                        <span className="text-[11px] text-stone-600 shrink-0">
                          {unit === 'KG' ? 'kg' : 'pcs'} → Price: Rs. </span>
                        <input
                          type="number"
                          step={unit === 'KG' ? '10' : '1'}
                          min="0"
                          placeholder="Special Price"
                          value={tier.price || ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setPriceTiers((prev) =>
                              prev.map((t, i) => (i === idx ? { ...t, price: val } : t))
                            );
                          }}
                          className="w-24 text-xs py-1 px-2 bg-white border border-[#C99A18]/50 rounded text-[#A67D0C] font-mono font-bold focus:border-[#C99A18] focus:outline-none"
                        />
                        <span className="text-[10px] text-stone-500 shrink-0">
                          {unit === 'KG' ? '/kg' : '/pc'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPriceTiers((prev) => prev.filter((_, i) => i !== idx))}
                          className="p-1 text-stone-400 hover:text-rose-600 ml-auto transition-colors cursor-pointer"
                          title="Remove Tier"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-[#E8DEC8] flex items-center justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-gold text-xs py-2 px-4 font-bold shadow-md"
                >
                  {editingProduct ? 'Save Changes' : 'Create Product'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
