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

  const categories: string[] = [
    'All', 
    'Sweets', 
    'Namkeen & Farsan', 
    'Dry Fruits', 
    'Snacks & Khakhra', 
    'Festive Gift Hampers'
  ];

  // Open modal for Adding
  const handleOpenAdd = () => {
    setEditingProduct(null);
    setName('');
    const randomSkuNum = Math.floor(100 + Math.random() * 900);
    setSku(`00${randomSkuNum}`);
    const randomBarcode = Math.floor(100000 + Math.random() * 900000);
    setBarcode(`890100${randomBarcode}`);
    setCategory('Sweets');
    setUnit('KG');
    setCostPrice(0);
    setSellingPrice(100);
    setStock(0);
    setMinStock(0);
    setMrp(100);
    setTaxRate(0);
    setShelfLifeDays(30);
    setIsModalOpen(true);
  };

  // Open modal for Editing
  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setName(p.name);
    setSku(p.sku || '');
    setBarcode(p.barcode || '');
    setCategory(p.category);
    setUnit((p.unit as SellingUnit) || (isWeightBasedProduct(p) ? 'KG' : 'PCS'));
    setCostPrice(p.costPrice);
    setSellingPrice(p.sellingPrice);
    setStock(p.stock);
    setMinStock(p.minStock);
    setMrp(p.mrp || p.sellingPrice);
    setTaxRate(p.taxRate || 5);
    setShelfLifeDays(p.shelfLifeDays || 14);
    setIsModalOpen(true);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !barcode.trim()) return;

    const isWeight = unit === 'KG';

    if (editingProduct) {
      // Update existing
      const updated: Product = {
        ...editingProduct,
        name: name.trim(),
        sku: sku.trim(),
        barcode: barcode.trim(),
        category,
        unit,
        priceBasis: isWeight ? '₹/kg' : '₹/pc',
        costPrice: Number(costPrice),
        sellingPrice: Number(sellingPrice),
        stock: Number(stock),
        minStock: Number(minStock),
        mrp: Number(mrp),
        taxRate: Number(taxRate),
        shelfLifeDays: Number(shelfLifeDays),
      };
      onUpdateProduct(updated);
    } else {
      // Create new
      const mfg = new Date().toISOString().split('T')[0];
      const exp = new Date(Date.now() + shelfLifeDays * 86400000).toISOString().split('T')[0];
      const newProd: Product = {
        id: `prod-${Date.now()}`,
        name: name.trim(),
        sku: sku.trim() || `SKU-${Date.now().toString().slice(-4)}`,
        barcode: barcode.trim(),
        category,
        unit,
        priceBasis: isWeight ? '₹/kg' : '₹/pc',
        netWeight: isWeight ? 'Per KG' : 'Per Piece',
        costPrice: Number(costPrice),
        sellingPrice: Number(sellingPrice),
        stock: Number(stock),
        minStock: Number(minStock),
        mrp: Number(mrp),
        taxRate: Number(taxRate),
        shelfLifeDays: Number(shelfLifeDays),
        batchNo: `B-${category.slice(0, 2).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`,
        mfgDate: mfg,
        expiryDate: exp,
        isActive: true,
      };
      onAddProduct(newProd);
    }

    setIsModalOpen(false);
  };

  // Filter products
  const filtered = products.filter((p) => {
    const matchesCat = selectedCategory === 'All' || p.category === selectedCategory;
    const q = search.toLowerCase().trim();
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      (p.sku && p.sku.toLowerCase().includes(q)) ||
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
      p.priceBasis || (isWeightBasedProduct(p) ? '₹/kg' : '₹/pc'),
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
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2 font-serif">
            <Package className="w-5 h-5 text-[#D4AF37]" />
            <span>Inventory & Price Catalogue</span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Manage product units (KG / PCS), prices, barcodes, and stock levels
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3 py-2 text-xs font-semibold rounded-xl bg-white/[0.04] text-zinc-300 hover:text-white hover:bg-white/[0.08] border border-white/[0.08] flex items-center gap-1.5 transition-colors"
            title="Export full catalogue to CSV / Excel"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="btn-gold text-xs py-2 px-3.5 flex items-center gap-1.5 font-bold"
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
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                selectedCategory === c
                  ? 'bg-[#D4AF37] text-black shadow-sm'
                  : 'bg-white/[0.03] text-zinc-400 hover:text-white hover:bg-white/[0.06] border border-white/[0.06]'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-72 shrink-0">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, SKU, or barcode..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-black/40 border border-white/[0.08] rounded-xl text-white placeholder:text-zinc-500 focus:border-[#D4AF37]/50 focus:outline-none"
          />
        </div>

      </div>

      {/* Inventory Table */}
      <div className="rounded-2xl bg-[#121214] border border-white/[0.08] overflow-hidden shadow-xl">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/[0.08] bg-[#161619] text-zinc-400 uppercase tracking-wider font-semibold text-[10px]">
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
            <tbody className="divide-y divide-white/5">
              {filtered.map((p) => {
                const isLow = p.stock <= p.minStock && p.stock > 0;
                const isOut = p.stock <= 0;
                const isEditingStock = quickStockEditingId === p.id;

                return (
                  <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                    {/* SKU / Code */}
                    <td className="py-3 px-4 font-mono font-bold text-[#D4AF37] whitespace-nowrap">
                      {p.sku}
                    </td>

                    {/* Barcode */}
                    <td className="py-3 px-4 font-mono text-zinc-300 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Barcode className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                        <span>{p.barcode}</span>
                      </div>
                    </td>

                    {/* Name */}
                    <td className="py-3 px-4 min-w-[180px]">
                      <div className="font-semibold text-white">{p.name}</div>
                      <div className="text-[10px] text-zinc-500">Exp: {p.expiryDate || 'N/A'}</div>
                    </td>

                    {/* Category */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/5 text-zinc-300 border border-white/10 font-medium">
                        {p.category}
                      </span>
                    </td>

                    {/* Unit Basis */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        isWeightBasedProduct(p)
                          ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                          : 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                      }`}>
                        {isWeightBasedProduct(p) ? 'KG (Weight)' : 'PCS (Count)'}
                      </span>
                    </td>

                    {/* Cost */}
                    <td className="py-3 px-4 text-right font-mono text-zinc-400 whitespace-nowrap">
                      ₹{p.costPrice}
                    </td>

                    {/* Selling Price */}
                    <td className="py-3 px-4 text-right font-mono font-bold text-white text-sm whitespace-nowrap">
                      {formatPriceWithBasis(p.sellingPrice, p.unit)}
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
                            className="w-16 py-0.5 px-1.5 text-center text-xs bg-black border border-[#D4AF37] rounded font-mono text-white"
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
                            <Check className="w-3 h-3 stroke-[2.5]" />
                          </button>
                        </div>
                      ) : (
                        <div 
                          onClick={() => {
                            setQuickStockEditingId(p.id);
                            setEditStockVal(p.stock);
                          }}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg cursor-pointer border transition-colors ${
                            isOut
                              ? 'bg-red-950/60 border-red-500/40 text-red-300'
                              : isLow 
                              ? 'bg-amber-950/60 border-amber-500/40 text-amber-300' 
                              : 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400'
                          }`}
                          title="Click to quickly edit stock count"
                        >
                          <span className="font-bold font-mono text-xs">
                            {formatStock(p.stock, p.unit)}
                          </span>
                          <Edit2 className="w-3 h-3 text-zinc-500 hover:text-white" />
                        </div>
                      )}
                    </td>

                    {/* Actions: Edit & Sticker */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleOpenEdit(p)}
                          className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-colors"
                          title="Edit Product Details"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => onOpenStickerModal(p)}
                          className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-[#D4AF37]/15 text-zinc-400 hover:text-[#D4AF37] transition-colors"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
          <div className="relative w-full max-w-lg rounded-2xl bg-[#121214] border border-[#D4AF37]/35 shadow-[0_24px_70px_rgba(0,0,0,0.95)] overflow-hidden flex flex-col max-h-[92vh]">
            
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-white/[0.08] bg-[#161619] flex items-center justify-between shrink-0">
              <h3 className="font-bold text-white text-sm sm:text-base font-serif flex items-center gap-2">
                <Package className="w-4 h-4 text-[#D4AF37]" />
                <span>{editingProduct ? 'Edit Product Setup' : 'Add New Sweets / Namkeen Product'}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveProduct} className="p-5 overflow-y-auto space-y-4 custom-scrollbar flex-1">
              
              <div>
                <label className="text-xs text-zinc-300 font-semibold block mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Kaju Katli Special, Gulab Jamun"
                  className="w-full text-xs py-2 px-3 bg-black/50 border border-white/[0.1] rounded-xl text-white focus:border-[#D4AF37]/60 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-300 font-semibold block mb-1">
                    Product Code / SKU *
                  </label>
                  <input
                    type="text"
                    required
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="e.g. 00101"
                    className="w-full text-xs py-2 px-3 bg-black/50 border border-white/[0.1] rounded-xl text-white font-mono focus:border-[#D4AF37]/60 focus:outline-none"
                  />
                  <span className="text-[10px] text-zinc-500 mt-0.5 block">Preserves leading zeroes</span>
                </div>

                <div>
                  <label className="text-xs text-zinc-300 font-semibold block mb-1">
                    Barcode Number *
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      required
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                      placeholder="e.g. 890100100101"
                      className="w-full text-xs py-2 px-3 bg-black/50 border border-white/[0.1] rounded-xl text-white font-mono focus:border-[#D4AF37]/60 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const random = Math.floor(100000 + Math.random() * 900000);
                        setBarcode(`890100${random}`);
                      }}
                      className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-xl text-xs text-[#D4AF37] hover:bg-white/10 font-bold shrink-0"
                      title="Auto-Generate Barcode"
                    >
                      Gen
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-300 font-semibold block mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ProductCategory)}
                    className="w-full text-xs py-2 px-3 bg-black/50 border border-white/[0.1] rounded-xl text-white focus:border-[#D4AF37]/60 focus:outline-none"
                  >
                    <option value="Sweets">Sweets</option>
                    <option value="Namkeen & Farsan">Namkeen & Farsan</option>
                    <option value="Dry Fruits">Dry Fruits</option>
                    <option value="Snacks & Khakhra">Snacks & Khakhra</option>
                    <option value="Festive Gift Hampers">Festive Gift Hampers</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-zinc-300 font-semibold block mb-1">
                    Selling Unit *
                  </label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as SellingUnit)}
                    className="w-full text-xs py-2 px-3 bg-black/50 border border-white/[0.1] rounded-xl text-white font-bold focus:border-[#D4AF37]/60 focus:outline-none"
                  >
                    <option value="KG">KG — Sold by Weight (e.g. ₹800/kg)</option>
                    <option value="PCS">PCS — Sold by Count (e.g. ₹20/pc)</option>
                    <option value="Box">Box (Count)</option>
                    <option value="Pack">Pack (Count)</option>
                    <option value="Tin">Tin (Count)</option>
                    <option value="Jar">Jar (Count)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-300 font-semibold block mb-1">
                    Selling Price (₹ {unit === 'KG' ? 'per KG' : 'per piece'}) *
                  </label>
                  <input
                    type="number"
                    step={unit === 'KG' ? '10' : '1'}
                    required
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(Number(e.target.value))}
                    className="w-full text-xs py-2 px-3 bg-black/50 border border-[#D4AF37]/40 rounded-xl text-white font-mono font-bold focus:border-[#D4AF37] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-300 font-semibold block mb-1">
                    Cost Price (₹ {unit === 'KG' ? 'per KG' : 'per piece'})
                  </label>
                  <input
                    type="number"
                    value={costPrice}
                    onChange={(e) => setCostPrice(Number(e.target.value))}
                    className="w-full text-xs py-2 px-3 bg-black/50 border border-white/[0.1] rounded-xl text-white font-mono focus:border-[#D4AF37]/60 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-zinc-300 font-semibold block mb-1">
                    Stock ({unit === 'KG' ? 'in KG' : 'in Pieces'}) *
                  </label>
                  <input
                    type="number"
                    step={unit === 'KG' ? '0.25' : '1'}
                    required
                    value={stock}
                    onChange={(e) => setStock(Number(e.target.value))}
                    className="w-full text-xs py-2 px-3 bg-black/50 border border-white/[0.1] rounded-xl text-white font-mono focus:border-[#D4AF37]/60 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-300 font-semibold block mb-1">
                    Min Stock Alert
                  </label>
                  <input
                    type="number"
                    value={minStock}
                    onChange={(e) => setMinStock(Number(e.target.value))}
                    className="w-full text-xs py-2 px-3 bg-black/50 border border-white/[0.1] rounded-xl text-white font-mono focus:border-[#D4AF37]/60 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-300 font-semibold block mb-1">
                    GST Rate (%)
                  </label>
                  <input
                    type="number"
                    value={taxRate}
                    onChange={(e) => setTaxRate(Number(e.target.value))}
                    className="w-full text-xs py-2 px-3 bg-black/50 border border-white/[0.1] rounded-xl text-white font-mono focus:border-[#D4AF37]/60 focus:outline-none"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-white/[0.08] flex items-center justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs text-zinc-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-gold text-xs py-2 px-4 font-bold"
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
