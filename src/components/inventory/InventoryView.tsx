import React, { useState } from 'react';
import { 
  Package, 
  Plus, 
  Search, 
  Tag, 
  AlertTriangle, 
  Calendar, 
  ArrowUpDown, 
  Barcode, 
  Filter,
  Check,
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
    <div className="space-y-6">
      
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2 font-serif">
            <Package className="w-5 h-5 text-[#D4AF37]" />
            Stock & Inventory Management
          </h2>
          <p className="text-xs text-[#B8B8B8] mt-0.5">
            Real-time stock tracking with barcode integration & expiry monitoring
          </p>
        </div>

        <button
          onClick={() => {
            handleGenerateBarcode();
            setIsAddModalOpen(true);
          }}
          className="btn-gold text-xs flex items-center gap-2"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Add New Product & Barcode</span>
        </button>
      </div>

      {/* Filter and Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl liquid-glass border border-white/10">
          <span className="text-[11px] uppercase tracking-wider text-gray-400 block">Total Items</span>
          <span className="text-2xl font-bold text-white mt-1 block font-mono">{products.length} Products</span>
        </div>
        <div className="p-4 rounded-xl liquid-glass border border-white/10">
          <span className="text-[11px] uppercase tracking-wider text-gray-400 block">Total Units in Stock</span>
          <span className="text-2xl font-bold text-white mt-1 block font-mono">
            {products.reduce((acc, p) => acc + p.stock, 0)} Units
          </span>
        </div>
        <div className="p-4 rounded-xl liquid-glass border border-amber-500/20 bg-amber-500/5">
          <span className="text-[11px] uppercase tracking-wider text-amber-400 block flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Low Stock Alerts
          </span>
          <span className="text-2xl font-bold text-amber-300 mt-1 block font-mono">
            {products.filter((p) => p.stock <= p.minStock).length} Items Low
          </span>
        </div>
        <div className="p-4 rounded-xl liquid-glass border border-[#D4AF37]/20 bg-[#D4AF37]/5">
          <span className="text-[11px] uppercase tracking-wider text-[#D4AF37] block">Inventory Valuation</span>
          <span className="text-2xl font-bold text-[#E5C158] mt-1 block font-mono">
            ₹{products.reduce((acc, p) => acc + p.stock * p.sellingPrice, 0).toLocaleString('en-IN')}
          </span>
        </div>
      </div>

      {/* Controls: Search and Categories */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex gap-2 overflow-x-auto w-full sm:w-auto pb-1 no-scrollbar">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setSelectedCategory(c)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                selectedCategory === c
                  ? 'bg-[#D4AF37] text-black font-semibold'
                  : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or barcode..."
            className="pl-9 pr-4 py-2 text-xs bg-black/40 border border-white/10 rounded-xl"
          />
        </div>
      </div>

      {/* Inventory Table (TENS11 Glass Table Styling) */}
      <div className="rounded-2xl liquid-glass border border-[#D4AF37]/15 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#D4AF37]/20 bg-[#D4AF37]/5 text-gray-300 uppercase tracking-wider font-semibold text-[10px]">
                <th className="py-3.5 px-4">Barcode / SKU</th>
                <th className="py-3.5 px-4">Item Name & Pack</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4 text-right">Cost</th>
                <th className="py-3.5 px-4 text-right">MRP / Selling</th>
                <th className="py-3.5 px-4 text-center">Stock Units</th>
                <th className="py-3.5 px-4">Batch & Expiry</th>
                <th className="py-3.5 px-4 text-center">Barcode Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((p) => {
                const isLow = p.stock <= p.minStock;
                const isEditingStock = quickStockEditingId === p.id;

                return (
                  <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                    {/* Barcode */}
                    <td className="py-3 px-4 font-mono text-[#D4AF37] font-semibold flex items-center gap-1.5">
                      <Barcode className="w-4 h-4 text-gray-500" />
                      <span>{p.barcode}</span>
                    </td>

                    {/* Item Name */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white text-sm">{p.name}</div>
                      <div className="text-[11px] text-gray-400 font-medium">
                        Net Wt: {p.netWeight} ({p.unit})
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/5 text-gray-300 border border-white/10">
                        {p.category}
                      </span>
                    </td>

                    {/* Cost */}
                    <td className="py-3 px-4 text-right font-mono text-gray-400">
                      ₹{p.costPrice}
                    </td>

                    {/* MRP */}
                    <td className="py-3 px-4 text-right font-mono font-bold text-white text-sm">
                      ₹{p.sellingPrice}
                    </td>

                    {/* Stock Units (with quick edit) */}
                    <td className="py-3 px-4 text-center">
                      {isEditingStock ? (
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type="number"
                            value={editStockVal}
                            onChange={(e) => setEditStockVal(Number(e.target.value))}
                            className="w-16 py-1 px-1.5 text-center text-xs bg-black border border-[#D4AF37] rounded"
                            autoFocus
                          />
                          <button
                            onClick={() => {
                              onUpdateStock(p.id, editStockVal);
                              setQuickStockEditingId(null);
                            }}
                            className="p-1 rounded bg-[#D4AF37] text-black"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div 
                          onClick={() => {
                            setQuickStockEditingId(p.id);
                            setEditStockVal(p.stock);
                          }}
                          className="inline-flex items-center gap-1 cursor-pointer group"
                        >
                          <span
                            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold ${
                              isLow
                                ? 'bg-red-950/80 text-red-300 border border-red-500/30'
                                : 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/20'
                            }`}
                          >
                            {p.stock} units
                          </span>
                          <Edit2 className="w-3 h-3 text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      )}
                    </td>

                    {/* Batch & Expiry */}
                    <td className="py-3 px-4">
                      <div className="text-[11px] text-gray-300">{p.batchNo}</div>
                      <div className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3 text-[#D4AF37]" />
                        <span>Exp: {p.expiryDate}</span>
                      </div>
                    </td>

                    {/* Action: Print Label */}
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => onOpenStickerModal(p)}
                        className="btn-dark text-xs py-1.5 px-3 hover:border-[#D4AF37] hover:text-[#D4AF37] flex items-center gap-1.5 mx-auto"
                        title="Print Barcode Label"
                      >
                        <Tag className="w-3.5 h-3.5 text-[#D4AF37]" />
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

      {/* Modal: Add New Product */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl bg-[#121212] border border-[#D4AF37]/30 shadow-2xl p-6">
            
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#D4AF37]" />
                Add New Sweet or Dry Snack
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="mt-4 space-y-4">
              
              <div>
                <label className="text-xs text-gray-300 font-medium block mb-1">
                  Product Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Royal Pista Roll, Dry Fruit Halwa"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-300 font-medium block mb-1">
                    Barcode (EAN-13 / UPC)
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      required
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                      className="text-sm font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleGenerateBarcode}
                      className="px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-xs text-gray-300 hover:text-white"
                      title="Auto-Generate Barcode"
                    >
                      Gen
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-300 font-medium block mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ProductCategory)}
                    className="text-sm"
                  >
                    <option value="Sweets">Sweets (Mithai)</option>
                    <option value="Namkeen & Farsan">Namkeen & Farsan</option>
                    <option value="Dry Fruits">Dry Fruits</option>
                    <option value="Snacks & Khakhra">Snacks & Khakhra</option>
                    <option value="Festive Gift Hampers">Festive Gift Hampers</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-300 font-medium block mb-1">
                    Net Weight
                  </label>
                  <input
                    type="text"
                    value={netWeight}
                    onChange={(e) => setNetWeight(e.target.value)}
                    placeholder="e.g. 250g, 500g, 1kg"
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-300 font-medium block mb-1">
                    Packaging Unit
                  </label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="text-sm"
                  >
                    <option value="Box">Box</option>
                    <option value="Pouch">Pouch</option>
                    <option value="Jar">Jar</option>
                    <option value="Tin">Tin</option>
                    <option value="Pack">Pack</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-300 font-medium block mb-1">
                    Cost Price (₹)
                  </label>
                  <input
                    type="number"
                    value={costPrice}
                    onChange={(e) => setCostPrice(Number(e.target.value))}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-300 font-medium block mb-1">
                    Selling Price / MRP (₹)
                  </label>
                  <input
                    type="number"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(Number(e.target.value))}
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-300 font-medium block mb-1">
                    Initial Stock
                  </label>
                  <input
                    type="number"
                    value={stock}
                    onChange={(e) => setStock(Number(e.target.value))}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-300 font-medium block mb-1">
                    Min Stock Alert
                  </label>
                  <input
                    type="number"
                    value={minStock}
                    onChange={(e) => setMinStock(Number(e.target.value))}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-300 font-medium block mb-1">
                    Shelf Life (Days)
                  </label>
                  <input
                    type="number"
                    value={shelfLifeDays}
                    onChange={(e) => setShelfLifeDays(Number(e.target.value))}
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-white/10 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-gold text-xs">
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
