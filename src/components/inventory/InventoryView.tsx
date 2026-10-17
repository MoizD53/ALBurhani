import React, { useState } from 'react';
import { 
  Package, 
  Plus, 
  Search, 
  Tag, 
  AlertTriangle, 
  Barcode, 
  Check, 
  X,
  Edit2
} from 'lucide-react';
import { Product, ProductCategory } from '../../types';

interface InventoryViewProps {
  products: Product[];
  onAddProduct: (product: Product) => void;
  onUpdateStock: (productId: string, newStock: number) => void;
  onOpenStickerModal: (product: Product) => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  products,
  onAddProduct,
  onUpdateStock,
  onOpenStickerModal,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [quickStockEditingId, setQuickStockEditingId] = useState<string | null>(null);
  const [editStockVal, setEditStockVal] = useState<number>(0);

  // New Product Form State
  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [category, setCategory] = useState<ProductCategory>('Sweets');
  const [netWeight, setNetWeight] = useState('500g');
  const [unit, setUnit] = useState('Box');
  const [costPrice, setCostPrice] = useState(250);
  const [sellingPrice, setSellingPrice] = useState(350);
  const [stock, setStock] = useState(25);
  const [minStock, setMinStock] = useState(8);
  const [shelfLifeDays, setShelfLifeDays] = useState(15);

  const categories: string[] = ['All', 'Sweets', 'Namkeen & Farsan', 'Dry Fruits', 'Snacks & Khakhra', 'Festive Gift Hampers'];

  const filtered = products.filter((p) => {
    const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode.includes(search);
    return matchesCat && matchesSearch;
  });

  const handleGenerateBarcode = () => {
    // Generate standard EAN-13 style barcode for Indian retail
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    setBarcode(`890100${randomSuffix}`);
  };

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !barcode) return;

    const mfg = new Date().toISOString().split('T')[0];
    const exp = new Date(Date.now() + shelfLifeDays * 86400000).toISOString().split('T')[0];

    const newProd: Product = {
      id: `prod-${Date.now()}`,
      barcode,
      name,
      category,
      unit,
      netWeight,
      costPrice: Number(costPrice),
      sellingPrice: Number(sellingPrice),
      stock: Number(stock),
      minStock: Number(minStock),
      shelfLifeDays: Number(shelfLifeDays),
      batchNo: `B-${category.slice(0, 2).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`,
      mfgDate: mfg,
      expiryDate: exp,
    };

    onAddProduct(newProd);
    setIsAddModalOpen(false);
    // Reset form
    setName('');
    setBarcode('');
  };

  return (
    <div className="space-y-5">
      
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2 font-serif">
            <Package className="w-5 h-5 text-[#D4AF37]" />
            Stock & Inventory Catalog
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Real-time stock tracking with barcode integration & expiry monitoring
          </p>
        </div>

        <button
          onClick={() => {
            handleGenerateBarcode();
            setIsAddModalOpen(true);
          }}
          className="btn-gold text-xs py-2.5 px-4 flex items-center gap-2 shrink-0 font-bold"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Add New Product & Barcode</span>
        </button>
      </div>

      {/* Filter and Stats Row (Responsive grid: 1 col on mobile, 2 on tablet, 4 on desktop) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        <div className="p-4 rounded-2xl liquid-glass border border-white/10">
          <span className="text-[11px] uppercase tracking-wider text-gray-400 block font-semibold">Total Items</span>
          <span className="text-xl sm:text-2xl font-bold text-white mt-1 block font-mono">{products.length} Products</span>
        </div>

        <div className="p-4 rounded-2xl liquid-glass border border-white/10">
          <span className="text-[11px] uppercase tracking-wider text-gray-400 block font-semibold">Total Units in Stock</span>
          <span className="text-xl sm:text-2xl font-bold text-white mt-1 block font-mono">
            {products.reduce((acc, p) => acc + p.stock, 0)} Units
          </span>
        </div>

        <div className="p-4 rounded-2xl liquid-glass border border-amber-500/25 bg-amber-500/5">
          <span className="text-[11px] uppercase tracking-wider text-amber-400 block flex items-center gap-1 font-semibold">
            <AlertTriangle className="w-3.5 h-3.5" /> Low Stock Alerts
          </span>
          <span className="text-xl sm:text-2xl font-bold text-amber-300 mt-1 block font-mono">
            {products.filter((p) => p.stock <= p.minStock).length} Items Low
          </span>
        </div>

        <div className="p-4 rounded-2xl liquid-glass border border-[#D4AF37]/25 bg-[#D4AF37]/5">
          <span className="text-[11px] uppercase tracking-wider text-[#D4AF37] block font-semibold">Inventory Valuation</span>
          <span className="text-xl sm:text-2xl font-bold text-[#E5C158] mt-1 block font-mono">
            ₹{products.reduce((acc, p) => acc + p.stock * p.sellingPrice, 0).toLocaleString('en-IN')}
          </span>
        </div>

      </div>

      {/* Controls: Search and Categories */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        
        {/* Category Pills Slider */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 custom-scrollbar flex-nowrap">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setSelectedCategory(c)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                selectedCategory === c
                  ? 'bg-[#D4AF37] text-black shadow-[0_0_10px_rgba(212,175,55,0.3)]'
                  : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-72 shrink-0">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or barcode..."
            className="pl-9 pr-4 py-2 text-xs bg-black/40 border border-white/10 rounded-xl text-white w-full"
          />
        </div>

      </div>

      {/* 1. Desktop & Laptop Table View (hidden on mobile < 768px) */}
      <div className="hidden md:block rounded-2xl liquid-glass border border-[#D4AF37]/20 overflow-hidden shadow-xl">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#D4AF37]/20 bg-[#D4AF37]/5 text-gray-300 uppercase tracking-wider font-semibold text-[10px]">
                <th className="py-3.5 px-4 whitespace-nowrap">Barcode / SKU</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Item Name & Pack</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Category</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">Cost</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">MRP / Selling</th>
                <th className="py-3.5 px-4 text-center whitespace-nowrap">Stock Units</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Batch & Expiry</th>
                <th className="py-3.5 px-4 text-center whitespace-nowrap">Sticker Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((p) => {
                const isLow = p.stock <= p.minStock;
                const isEditingStock = quickStockEditingId === p.id;

                return (
                  <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                    {/* Barcode */}
                    <td className="py-3 px-4 font-mono text-[#D4AF37] font-semibold whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Barcode className="w-4 h-4 text-gray-500 shrink-0" />
                        <span>{p.barcode}</span>
                      </div>
                    </td>

                    {/* Item Name */}
                    <td className="py-3 px-4 min-w-[200px]">
                      <div className="font-semibold text-white text-sm leading-snug">{p.name}</div>
                      <div className="text-[11px] text-gray-400 font-medium">
                        Net Wt: {p.netWeight} ({p.unit})
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/5 text-gray-300 border border-white/10 font-medium">
                        {p.category}
                      </span>
                    </td>

                    {/* Cost */}
                    <td className="py-3 px-4 text-right font-mono text-gray-400 whitespace-nowrap">
                      ₹{p.costPrice}
                    </td>

                    {/* MRP */}
                    <td className="py-3 px-4 text-right font-mono font-bold text-white text-sm whitespace-nowrap">
                      ₹{p.sellingPrice}
                    </td>

                    {/* Stock Units (with quick edit) */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {isEditingStock ? (
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type="number"
                            value={editStockVal}
                            onChange={(e) => setEditStockVal(Number(e.target.value))}
                            className="w-16 py-1 px-1.5 text-center text-xs bg-black border border-[#D4AF37] rounded font-mono text-white"
                            autoFocus
                          />
                          <button
                            onClick={() => {
                              onUpdateStock(p.id, editStockVal);
                              setQuickStockEditingId(null);
                            }}
                            className="p-1 rounded bg-[#D4AF37] text-black"
                            title="Save stock"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          </button>
                        </div>
                      ) : (
                        <div 
                          onClick={() => {
                            setQuickStockEditingId(p.id);
                            setEditStockVal(p.stock);
                          }}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg cursor-pointer border transition-colors ${
                            isLow 
                              ? 'bg-red-950/60 border-red-500/40 text-red-300 hover:border-red-400' 
                              : 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400 hover:border-emerald-400'
                          }`}
                          title="Click to quickly edit stock count"
                        >
                          <span className="font-bold font-mono text-xs">{p.stock}</span>
                          <span className="text-[10px] text-gray-400">units</span>
                          <Edit2 className="w-3 h-3 text-gray-400 hover:text-white" />
                        </div>
                      )}
                    </td>

                    {/* Batch & Expiry */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-mono text-gray-300 text-[11px]">{p.batchNo}</div>
                      <div className="text-[10px] text-gray-400">Exp: {p.expiryDate}</div>
                    </td>

                    {/* Action: Print Sticker */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <button
                        onClick={() => onOpenStickerModal(p)}
                        className="btn-gold text-[11px] py-1 px-2.5 inline-flex items-center gap-1 font-semibold"
                        title="Generate & print 50mm thermal sticker"
                      >
                        <Tag className="w-3.5 h-3.5" />
                        <span>Print Sticker</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Mobile Responsive Card List (visible on phones < 768px) */}
      <div className="md:hidden space-y-3">
        {filtered.map((p) => {
          const isLow = p.stock <= p.minStock;
          const isEditingStock = quickStockEditingId === p.id;

          return (
            <div
              key={p.id}
              className="p-4 rounded-2xl liquid-glass border border-white/10 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="font-semibold text-white text-sm leading-snug">{p.name}</h4>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                    <span>{p.netWeight} ({p.unit})</span>
                    <span>•</span>
                    <span className="text-[#D4AF37] font-mono font-semibold">{p.barcode}</span>
                  </div>
                </div>

                <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/5 text-gray-300 border border-white/10 shrink-0 font-medium">
                  {p.category.split(' ')[0]}
                </span>
              </div>

              {/* Pricing & Stock row */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5 text-xs">
                <div>
                  <span className="text-[10px] text-gray-400 block uppercase">Selling MRP</span>
                  <span className="text-base font-bold text-white font-mono">₹{p.sellingPrice}</span>
                </div>

                <div>
                  <span className="text-[10px] text-gray-400 block uppercase">Stock Units</span>
                  {isEditingStock ? (
                    <div className="flex items-center gap-1 mt-0.5">
                      <input
                        type="number"
                        value={editStockVal}
                        onChange={(e) => setEditStockVal(Number(e.target.value))}
                        className="w-16 py-0.5 px-1.5 text-xs bg-black border border-[#D4AF37] rounded font-mono text-white"
                        autoFocus
                      />
                      <button
                        onClick={() => {
                          onUpdateStock(p.id, editStockVal);
                          setQuickStockEditingId(null);
                        }}
                        className="p-1 rounded bg-[#D4AF37] text-black"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>
                    </div>
                  ) : (
                    <div 
                      onClick={() => {
                        setQuickStockEditingId(p.id);
                        setEditStockVal(p.stock);
                      }}
                      className="flex items-center gap-1 mt-0.5 cursor-pointer"
                    >
                      <span className={`font-mono font-bold ${isLow ? 'text-red-400' : 'text-emerald-400'}`}>
                        {p.stock} units
                      </span>
                      <Edit2 className="w-3 h-3 text-gray-400" />
                    </div>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                <span className="text-[10px] text-gray-500 font-mono">
                  Exp: {p.expiryDate}
                </span>

                <button
                  onClick={() => onOpenStickerModal(p)}
                  className="btn-gold text-xs py-1.5 px-3 flex items-center gap-1.5 font-semibold"
                >
                  <Tag className="w-3.5 h-3.5" />
                  <span>Thermal Sticker</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Add New Product (TENS11 Glass & Safe Viewport) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-lg rounded-2xl bg-[#0E0E0E] border border-[#D4AF37]/35 shadow-[0_20px_60px_rgba(0,0,0,0.9)] max-h-[90vh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="px-5 sm:px-6 py-4 border-b border-[#D4AF37]/20 bg-gradient-to-r from-black via-[#161616] to-black flex items-center justify-between shrink-0">
              <h3 className="font-bold text-white text-sm sm:text-base font-serif flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#D4AF37] stroke-[2.5]" />
                Add New Sweet or Namkeen Item
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleCreateProduct} className="p-5 sm:p-6 overflow-y-auto space-y-4 custom-scrollbar flex-1">
              
              <div>
                <label className="text-xs text-gray-300 font-semibold block mb-1">
                  Product Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Royal Pista Roll, Dry Fruit Halwa"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="text-xs sm:text-sm bg-black/50 border-[#D4AF37]/30 text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-300 font-semibold block mb-1">
                    Barcode (EAN-13 / CODE128)
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      required
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                      className="text-xs sm:text-sm font-mono bg-black/50 border-[#D4AF37]/30 text-white"
                    />
                    <button
                      type="button"
                      onClick={handleGenerateBarcode}
                      className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-xs text-[#D4AF37] hover:bg-white/10 font-bold shrink-0"
                      title="Auto-Generate Barcode"
                    >
                      Gen
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-300 font-semibold block mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ProductCategory)}
                    className="text-xs sm:text-sm bg-black/50 border-[#D4AF37]/30 text-white"
                  >
                    <option value="Sweets">Sweets (Mithai)</option>
                    <option value="Namkeen & Farsan">Namkeen & Farsan</option>
                    <option value="Dry Fruits">Dry Fruits</option>
                    <option value="Snacks & Khakhra">Snacks & Khakhra</option>
                    <option value="Festive Gift Hampers">Festive Gift Hampers</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-300 font-semibold block mb-1">
                    Net Weight
                  </label>
                  <input
                    type="text"
                    value={netWeight}
                    onChange={(e) => setNetWeight(e.target.value)}
                    placeholder="e.g. 250g, 500g, 1kg"
                    className="text-xs sm:text-sm bg-black/50 border-[#D4AF37]/30 text-white"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-300 font-semibold block mb-1">
                    Packaging Unit
                  </label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="text-xs sm:text-sm bg-black/50 border-[#D4AF37]/30 text-white"
                  >
                    <option value="Box">Box</option>
                    <option value="Pouch">Pouch</option>
                    <option value="Jar">Jar</option>
                    <option value="Tin">Tin</option>
                    <option value="Pack">Pack</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-300 font-semibold block mb-1">
                    Cost Price (₹)
                  </label>
                  <input
                    type="number"
                    value={costPrice}
                    onChange={(e) => setCostPrice(Number(e.target.value))}
                    className="text-xs sm:text-sm bg-black/50 border-[#D4AF37]/30 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-300 font-semibold block mb-1">
                    Selling Price / MRP (₹)
                  </label>
                  <input
                    type="number"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(Number(e.target.value))}
                    className="text-xs sm:text-sm bg-black/50 border-[#D4AF37]/30 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-300 font-semibold block mb-1">
                    Initial Stock
                  </label>
                  <input
                    type="number"
                    value={stock}
                    onChange={(e) => setStock(Number(e.target.value))}
                    className="text-xs sm:text-sm bg-black/50 border-[#D4AF37]/30 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-300 font-semibold block mb-1">
                    Min Stock Alert
                  </label>
                  <input
                    type="number"
                    value={minStock}
                    onChange={(e) => setMinStock(Number(e.target.value))}
                    className="text-xs sm:text-sm bg-black/50 border-[#D4AF37]/30 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-300 font-semibold block mb-1">
                    Shelf Life (Days)
                  </label>
                  <input
                    type="number"
                    value={shelfLifeDays}
                    onChange={(e) => setShelfLifeDays(Number(e.target.value))}
                    className="text-xs sm:text-sm bg-black/50 border-[#D4AF37]/30 text-white font-mono"
                  />
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-gold text-xs py-2 px-4 font-bold">
                  Save Product & Ready Barcode
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
