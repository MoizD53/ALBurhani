import React, { useState, useMemo } from 'react';
import { 
  Layers, 
  Package, 
  Plus, 
  Search, 
  Edit2, 
  Check, 
  X, 
  Tag, 
  AlertTriangle, 
  Download, 
  CheckCircle2, 
  Filter,
  BarChart3,
  ToggleLeft,
  ToggleRight,
  FolderPlus,
  Boxes
} from 'lucide-react';
import { Product, ProductCategory, SellingUnit, CategoryItem } from '../../types';
import { 
  formatPriceWithBasis, 
  isWeightBasedProduct 
} from '../../lib/pricing';
import { 
  validateCategoryName, 
  sanitizeCategoryName 
} from '../../lib/categories';

interface ProductManagementViewProps {
  products: Product[];
  categories: CategoryItem[];
  onAddProduct: (product: Product) => void;
  onUpdateProduct: (product: Product) => void;
  onOpenStickerModal?: (product: Product) => void;
  onAddCategory: (category: CategoryItem) => Promise<boolean>;
  onUpdateCategory: (category: CategoryItem, oldName?: string) => Promise<boolean>;
  onToggleCategoryActive?: (categoryId: string) => Promise<boolean>;
}

export const ProductManagementView: React.FC<ProductManagementViewProps> = ({
  products,
  categories,
  onAddProduct,
  onUpdateProduct,
  onOpenStickerModal,
  onAddCategory,
  onUpdateCategory,
  onToggleCategoryActive,
}) => {
  // Main view active tab: 'items' or 'categories' (Default to 'items')
  const [activeSubTab, setActiveSubTab] = useState<'items' | 'categories'>('items');

  // Search & Filters
  const [productSearch, setProductSearch] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('All');
  const [categorySearch, setCategorySearch] = useState('');

  // Product Add / Edit Modal State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Product Form Fields
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [productCategory, setProductCategory] = useState<string>('SWEETS');
  const [unit, setUnit] = useState<SellingUnit>('KG');
  const [sellingPrice, setSellingPrice] = useState<number>(100);
  const [mrp, setMrp] = useState<number>(100);
  const [priceTiers, setPriceTiers] = useState<{ minQuantity: number; price: number }[]>([]);

  // Category Quick Add Modal (inside Product form)
  const [isQuickCategoryModalOpen, setIsQuickCategoryModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [quickCatError, setQuickCatError] = useState<string | null>(null);
  const [isQuickCatSubmitting, setIsQuickCatSubmitting] = useState(false);

  // Category Edit / Create Modal (in Categories tab)
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [catFormName, setCatFormName] = useState('');
  const [catFormDesc, setCatFormDesc] = useState('');
  const [catFormIsActive, setCatFormIsActive] = useState(true);
  const [catFormError, setCatFormError] = useState<string | null>(null);
  const [isCatSubmitting, setIsCatSubmitting] = useState(false);

  // Active Category List (names only for dropdown)
  const activeCategoryList = useMemo(() => {
    return categories
      .filter((c) => c.isActive)
      .map((c) => c.name);
  }, [categories]);

  // Open Add Product Modal
  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setName('');
    const randomSkuNum = Math.floor(100 + Math.random() * 900);
    setSku(`00${randomSkuNum}`);
    const randomBarcode = Math.floor(100000 + Math.random() * 900000);
    setBarcode(`890100${randomBarcode}`);
    setProductCategory(activeCategoryList[0] || 'SWEETS');
    setUnit('KG');
    setSellingPrice(100);
    setMrp(100);
    setPriceTiers([]);
    setIsProductModalOpen(true);
  };

  // Open Edit Product Modal
  const handleOpenEditProduct = (product: Product) => {
    setEditingProduct(product);
    setName(product.name);
    setSku(product.sku);
    setBarcode(product.barcode);
    setProductCategory(product.category);
    setUnit(product.unit as SellingUnit);
    setSellingPrice(product.sellingPrice);
    setMrp(product.mrp || product.sellingPrice);
    setPriceTiers(product.priceTiers || []);
    setIsProductModalOpen(true);
  };

  // Save Product
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
      category: productCategory,
      unit,
      priceBasis,
      costPrice: editingProduct?.costPrice ?? 0,
      sellingPrice: Number(sellingPrice) || 0,
      mrp: Number(mrp) || Number(sellingPrice),
      taxRate: editingProduct?.taxRate ?? 5,
      isActive: editingProduct ? (editingProduct.isActive ?? true) : true,
      priceTiers: priceTiers.filter((t) => t.minQuantity > 0 && t.price > 0),
    };

    if (editingProduct) {
      onUpdateProduct(productPayload);
    } else {
      onAddProduct(productPayload);
    }
    setIsProductModalOpen(false);
  };

  // Quick Category Save (Inside Product Form Modal)
  const handleSaveQuickCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setQuickCatError(null);

    const validation = validateCategoryName(newCatName, categories);
    if (!validation.valid) {
      setQuickCatError(validation.error || 'Invalid category name');
      return;
    }

    setIsQuickCatSubmitting(true);
    const cleanName = sanitizeCategoryName(newCatName);
    const newCategoryItem: CategoryItem = {
      id: `cat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: cleanName,
      description: newCatDesc.trim() || undefined,
      isActive: true,
      displayOrder: categories.length + 1,
    };

    try {
      const ok = await onAddCategory(newCategoryItem);
      if (ok) {
        // Automatically select the newly created category in the product form!
        setProductCategory(cleanName);
        setIsQuickCategoryModalOpen(false);
        setNewCatName('');
        setNewCatDesc('');
      } else {
        setQuickCatError('Failed to save category. Please try again.');
      }
    } catch (err: any) {
      setQuickCatError(err?.message || 'Error saving category');
    } finally {
      setIsQuickCatSubmitting(false);
    }
  };

  // Open Category Form in Categories Tab
  const handleOpenAddCategory = () => {
    setEditingCategory(null);
    setCatFormName('');
    setCatFormDesc('');
    setCatFormIsActive(true);
    setCatFormError(null);
    setIsCategoryModalOpen(true);
  };

  const handleOpenEditCategory = (cat: CategoryItem) => {
    setEditingCategory(cat);
    setCatFormName(cat.name);
    setCatFormDesc(cat.description || '');
    setCatFormIsActive(cat.isActive);
    setCatFormError(null);
    setIsCategoryModalOpen(true);
  };

  // Save Category from Categories Tab
  const handleSaveCategoryTab = async (e: React.FormEvent) => {
    e.preventDefault();
    setCatFormError(null);

    const validation = validateCategoryName(catFormName, categories, editingCategory?.id);
    if (!validation.valid) {
      setCatFormError(validation.error || 'Invalid category name');
      return;
    }

    setIsCatSubmitting(true);
    const cleanName = sanitizeCategoryName(catFormName);

    try {
      if (editingCategory) {
        const updatedCat: CategoryItem = {
          ...editingCategory,
          name: cleanName,
          description: catFormDesc.trim() || undefined,
          isActive: catFormIsActive,
        };
        const ok = await onUpdateCategory(updatedCat, editingCategory.name);
        if (ok) {
          setIsCategoryModalOpen(false);
        } else {
          setCatFormError('Failed to update category');
        }
      } else {
        const newCat: CategoryItem = {
          id: `cat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          name: cleanName,
          description: catFormDesc.trim() || undefined,
          isActive: catFormIsActive,
          displayOrder: categories.length + 1,
        };
        const ok = await onAddCategory(newCat);
        if (ok) {
          setIsCategoryModalOpen(false);
        } else {
          setCatFormError('Failed to add category');
        }
      }
    } catch (err: any) {
      setCatFormError(err?.message || 'Error saving category');
    } finally {
      setIsCatSubmitting(false);
    }
  };

  // Filtered Products for Items Tab
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCat = selectedCategoryFilter === 'All' || p.category === selectedCategoryFilter;
      const q = productSearch.trim().toLowerCase();
      if (!q) return matchesCat;

      const matchesSearch =
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        p.category.toLowerCase().includes(q);

      return matchesCat && matchesSearch;
    });
  }, [products, selectedCategoryFilter, productSearch]);

  // Filtered Categories for Categories Tab
  const filteredCategories = useMemo(() => {
    const q = categorySearch.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.description && c.description.toLowerCase().includes(q))
    );
  }, [categories, categorySearch]);

  return (
    <div className="space-y-4 select-none max-w-7xl mx-auto pb-16">
      
      {/* 1. Header & Navigation Sub-Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 flex items-center gap-2.5 font-serif">
            <Layers className="w-6 h-6 text-[#B8860B]" />
            <span>Product & Category Management</span>
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Configure product catalog, master item specifications, prices, barcodes and categories
          </p>
        </div>

        {/* Sub-Tab Selector: Items / Products vs Categories */}
        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-[#E8DEC8] shadow-sm shrink-0">
          <button
            onClick={() => setActiveSubTab('items')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              activeSubTab === 'items'
                ? 'bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-white shadow-sm'
                : 'text-stone-600 hover:text-stone-900 hover:bg-[#FAF8F5]'
            }`}
          >
            <Boxes className="w-3.5 h-3.5" />
            <span>Items / Products ({products.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('categories')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              activeSubTab === 'categories'
                ? 'bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-white shadow-sm'
                : 'text-stone-600 hover:text-stone-900 hover:bg-[#FAF8F5]'
            }`}
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>Categories ({categories.length})</span>
          </button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: ITEMS / PRODUCTS (DEFAULT)                                    */}
      {/* ==================================================================== */}
      {activeSubTab === 'items' && (
        <div className="space-y-4">
          
          {/* Action Row */}
          <div className="p-3.5 bg-white border border-[#E8DEC8] rounded-2xl shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            
            {/* Category Filter Pills */}
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar flex-nowrap shrink-0 max-w-full sm:max-w-xl">
              <button
                onClick={() => setSelectedCategoryFilter('All')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
                  selectedCategoryFilter === 'All'
                    ? 'bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-white shadow-sm'
                    : 'bg-[#FAF8F5] text-stone-600 hover:text-stone-900 border border-[#E8DEC8]'
                }`}
              >
                All ({products.length})
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCategoryFilter(c.name)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
                    selectedCategoryFilter === c.name
                      ? 'bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-white shadow-sm'
                      : 'bg-[#FAF8F5] text-stone-600 hover:text-stone-900 border border-[#E8DEC8]'
                  }`}
                >
                  {c.name} {c.productCount !== undefined && `(${c.productCount})`}
                </button>
              ))}
            </div>

            {/* Search & Add Product */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="relative w-full sm:w-56 shrink-0">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search item, SKU, barcode..."
                  style={{ paddingLeft: '34px' }}
                  className="w-full pr-8 py-2 text-xs bg-[#FAF8F5] border border-[#E8DEC8] rounded-xl text-stone-900 placeholder:text-stone-400 focus:bg-white focus:border-[#C99A18] focus:ring-1 focus:ring-[#C99A18] focus:outline-none shadow-xs"
                />
                {productSearch && (
                  <button
                    type="button"
                    onClick={() => setProductSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <button
                onClick={handleOpenAddProduct}
                className="btn-gold py-2 px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shrink-0 whitespace-nowrap"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>+ Add Item</span>
              </button>
            </div>

          </div>

          {/* Mobile Product Cards (< 640px) */}
          <div className="sm:hidden space-y-2.5">
            {filteredProducts.map((p) => {
              const isActive = p.isActive !== false;
              return (
                <div
                  key={p.id}
                  className="p-3.5 rounded-2xl bg-white border border-[#E8DEC8] shadow-sm space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="font-bold text-stone-900 text-sm leading-tight">{p.name}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-mono text-[10px] text-[#A67D0C] font-bold">{p.sku}</span>
                        {p.barcode && (
                          <>
                            <span className="text-stone-300">·</span>
                            <span className="font-mono text-[10px] text-stone-500">{p.barcode}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#FAF8F5] text-[#A67D0C] border border-[#E8DEC8] font-semibold shrink-0 uppercase">
                      {p.category}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#F5F2EB]">
                    <div>
                      <div className="font-mono font-bold text-stone-900 text-base">
                        Rs. {p.sellingPrice.toFixed(2)}
                        <span className="text-xs font-normal text-stone-500 ml-1">/{p.unit}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onUpdateProduct({ ...p, isActive: !isActive })}
                        className={`px-2.5 py-1 rounded-full text-[9px] font-bold border transition-colors ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-stone-100 text-stone-600 border-stone-300'
                        }`}
                      >
                        {isActive ? 'Active' : 'Inactive'}
                      </button>

                      <button
                        onClick={() => handleOpenEditProduct(p)}
                        className="p-1.5 rounded-lg text-stone-500 hover:text-amber-700 bg-[#FAF8F5] border border-[#E8DEC8]"
                        title="Edit product"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {onOpenStickerModal && (
                        <button
                          onClick={() => onOpenStickerModal(p)}
                          className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 bg-[#FAF8F5] border border-[#E8DEC8]"
                          title="Print Barcode"
                        >
                          <Tag className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop / Tablet Products List Table (>= 640px) */}
          <div className="hidden sm:block bg-white border border-[#E8DEC8] rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-[#FAF8F5] text-[10px] font-bold text-stone-500 uppercase tracking-wider border-b border-[#E8DEC8]">
                  <tr>
                    <th className="py-3 px-4">Product Name & Category</th>
                    <th className="py-3 px-4">SKU / Code</th>
                    <th className="py-3 px-4">Barcode</th>
                    <th className="py-3 px-4 text-center">Unit Basis</th>
                    <th className="py-3 px-4 text-right">Selling Price</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0EBE0]">
                  {filteredProducts.map((p) => {
                    const isActive = p.isActive !== false;

                    return (
                      <tr key={p.id} className="hover:bg-[#FAF8F5]/80 transition-colors">
                        
                        {/* Name & Category */}
                        <td className="py-3 px-4">
                          <div className="font-bold text-stone-900">{p.name}</div>
                          <span className="inline-block mt-0.5 px-2 py-0.2 rounded-md bg-[#FAF8F5] border border-[#E8DEC8] text-[9px] font-bold text-[#A67D0C] uppercase">
                            {p.category}
                          </span>
                        </td>

                        {/* SKU */}
                        <td className="py-3 px-4 font-mono text-stone-600 font-semibold">
                          {p.sku}
                        </td>

                        {/* Barcode */}
                        <td className="py-3 px-4 font-mono text-stone-500 text-[11px]">
                          {p.barcode}
                        </td>

                        {/* Unit */}
                        <td className="py-3 px-4 text-center font-bold text-stone-700">
                          {p.unit}
                        </td>

                        {/* Selling Price */}
                        <td className="py-3 px-4 text-right font-mono font-bold text-[#B8860B]">
                          Rs. {p.sellingPrice.toFixed(2)}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => onUpdateProduct({ ...p, isActive: !isActive })}
                            className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold border transition-colors ${
                              isActive
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-stone-100 text-stone-600 border-stone-300 hover:bg-stone-200'
                            }`}
                            title="Click to toggle active status"
                          >
                            {isActive ? 'Active' : 'Inactive'}
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleOpenEditProduct(p)}
                              className="p-1.5 rounded-lg text-stone-500 hover:text-amber-700 hover:bg-amber-50/50 border border-transparent hover:border-amber-200 transition-colors"
                              title="Edit product item"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            {onOpenStickerModal && (
                              <button
                                onClick={() => onOpenStickerModal(p)}
                                className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 hover:bg-[#FAF8F5] border border-transparent hover:border-[#E8DEC8] transition-colors"
                                title="Print Barcode Label"
                              >
                                <Tag className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: CATEGORIES MANAGEMENT                                         */}
      {/* ==================================================================== */}
      {activeSubTab === 'categories' && (
        <div className="space-y-4">
          
          {/* Header Action Row */}
          <div className="p-3.5 bg-white border border-[#E8DEC8] rounded-2xl shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="relative w-full sm:w-72 shrink-0">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
              <input
                type="text"
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                placeholder="Search categories..."
                style={{ paddingLeft: '34px' }}
                className="w-full pr-8 py-2 text-xs bg-[#FAF8F5] border border-[#E8DEC8] rounded-xl text-stone-900 placeholder:text-stone-400 focus:bg-white focus:border-[#C99A18] focus:ring-1 focus:ring-[#C99A18] focus:outline-none shadow-xs"
              />
              {categorySearch && (
                <button
                  type="button"
                  onClick={() => setCategorySearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              onClick={handleOpenAddCategory}
              className="btn-gold py-2 px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>+ Add Category</span>
            </button>
          </div>

          {/* Categories Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredCategories.map((cat) => (
              <div 
                key={cat.id} 
                className={`p-4 rounded-2xl bg-white border shadow-sm transition-all hover:shadow-md flex flex-col justify-between ${
                  cat.isActive ? 'border-[#E8DEC8]' : 'border-stone-200 bg-stone-50/50 opacity-75'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-[#FAF8F5] border border-[#E8DEC8] text-[#B8860B] flex items-center justify-center font-bold text-xs">
                        {cat.name.slice(0, 2)}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-stone-900">{cat.name}</h4>
                        <span className={`inline-block px-2 py-0.2 rounded-full text-[9px] font-bold mt-0.5 border ${
                          cat.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-stone-100 text-stone-500 border-stone-200'
                        }`}>
                          {cat.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleOpenEditCategory(cat)}
                      className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-[#FAF8F5]"
                      title="Edit Category Name"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {cat.description && (
                    <p className="text-xs text-stone-500 mt-2 line-clamp-2">
                      {cat.description}
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-[#F0EBE0] flex items-center justify-between text-xs">
                  <span className="font-bold text-stone-700 font-mono">
                    {cat.productCount ?? 0} Products
                  </span>

                  <button
                    onClick={async () => {
                      if (onToggleCategoryActive) {
                        await onToggleCategoryActive(cat.id);
                      } else {
                        await onUpdateCategory({ ...cat, isActive: !cat.isActive }, cat.name);
                      }
                    }}
                    className={`text-[11px] font-bold ${
                      cat.isActive ? 'text-amber-700 hover:underline' : 'text-emerald-700 hover:underline'
                    }`}
                  >
                    {cat.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            ))}
          </div>

        </div>
      )}

      {/* ==================================================================== */}
      {/* 3. ADD / EDIT PRODUCT MODAL (WITH EMBEDDED QUICK ADD CATEGORY)        */}
      {/* ==================================================================== */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-[#E8DEC8] rounded-2xl shadow-xl w-full max-w-xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
            
            {/* Header */}
            <div className="px-5 py-4 border-b border-[#E8DEC8] bg-[#FAF8F5] flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-stone-900 font-serif">
                  {editingProduct ? `Edit Item — ${editingProduct.name}` : 'Add New Sweets / Namkeen Product'}
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Set prices, barcode, category and tax rate
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsProductModalOpen(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveProduct} className="p-5 space-y-3.5 max-h-[80vh] overflow-y-auto custom-scrollbar">
              
              {/* Product Name */}
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  Product Name <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Kaju Katli Special, Ratlami Sev, Dry Fruit Halwa"
                  className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E8DEC8] rounded-xl text-stone-900 focus:bg-white focus:border-[#C99A18] focus:ring-1 focus:ring-[#C99A18] focus:outline-none"
                />
              </div>

              {/* SKU & Barcode Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-stone-700">Product SKU / Code <span className="text-rose-600">*</span></label>
                    <button
                      type="button"
                      onClick={() => setSku(`00${Math.floor(100 + Math.random() * 900)}`)}
                      className="text-[10px] text-[#A67D0C] hover:underline font-bold"
                    >
                      Regenerate
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E8DEC8] rounded-xl text-stone-900 font-mono font-bold focus:bg-white focus:border-[#C99A18] focus:outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-stone-700">Barcode Number <span className="text-rose-600">*</span></label>
                    <button
                      type="button"
                      onClick={() => setBarcode(`890100${Math.floor(100000 + Math.random() * 900000)}`)}
                      className="text-[10px] text-[#A67D0C] hover:underline font-bold"
                    >
                      Regenerate
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E8DEC8] rounded-xl text-stone-900 font-mono font-bold focus:bg-white focus:border-[#C99A18] focus:outline-none"
                  />
                </div>
              </div>

              {/* Category Dropdown + + Add New Category Action */}
              <div className="p-3 rounded-xl bg-[#FAF8F5] border border-[#E8DEC8] space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-stone-700">
                    Category Selection <span className="text-rose-600">*</span>
                  </label>

                  {/* + Add New Category Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setNewCatName('');
                      setNewCatDesc('');
                      setQuickCatError(null);
                      setIsQuickCategoryModalOpen(true);
                    }}
                    className="text-xs font-bold text-[#A67D0C] hover:text-[#8C6B14] hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add New Category</span>
                  </button>
                </div>

                <select
                  value={productCategory}
                  onChange={(e) => setProductCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#E8DEC8] rounded-xl text-stone-900 font-bold focus:border-[#C99A18] focus:outline-none"
                >
                  {activeCategoryList.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-stone-500">
                  Select an existing category or click "+ Add New Category" to create a new one without losing your entered product details.
                </p>
              </div>

              {/* Unit, Selling Price, MRP Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Selling Unit
                  </label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as SellingUnit)}
                    className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E8DEC8] rounded-xl text-stone-900 focus:bg-white focus:border-[#C99A18] focus:outline-none font-bold"
                  >
                    <option value="KG">KG (Kilograms)</option>
                    <option value="PCS">PCS (Pieces)</option>
                    <option value="Box">Box</option>
                    <option value="Pouch">Pouch</option>
                    <option value="Jar">Jar</option>
                    <option value="Tin">Tin</option>
                    <option value="Pack">Pack</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    Selling Price (₹) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E8DEC8] rounded-xl text-stone-900 font-mono font-bold focus:bg-white focus:border-[#C99A18] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">
                    MRP (Optional ₹)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={mrp}
                    onChange={(e) => setMrp(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E8DEC8] rounded-xl text-stone-900 font-mono focus:bg-white focus:border-[#C99A18] focus:outline-none"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E8DEC8]">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:text-stone-900 hover:bg-[#FAF8F5] border border-[#E8DEC8]"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn-gold py-2 px-5 rounded-xl text-xs font-bold shadow-md"
                >
                  {editingProduct ? 'Update Product' : 'Create Product'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 4. QUICK ADD CATEGORY MODAL (OPENS OVER PRODUCT MODAL)              */}
      {/* ==================================================================== */}
      {isQuickCategoryModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white border border-[#E8DEC8] rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            <div className="px-4 py-3 border-b border-[#E8DEC8] bg-[#FAF8F5] flex items-center justify-between">
              <h4 className="text-sm font-bold text-stone-900 font-serif flex items-center gap-1.5">
                <FolderPlus className="w-4 h-4 text-[#B8860B]" />
                <span>Add New Category</span>
              </h4>
              <button
                type="button"
                onClick={() => setIsQuickCategoryModalOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickCategory} className="p-4 space-y-3">
              {quickCatError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{quickCatError}</span>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  Category Name <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="e.g. DRY FRUIT HALWA, KHAKHRA, CHOCOLATES"
                  className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E8DEC8] rounded-xl text-stone-900 focus:bg-white focus:border-[#C99A18] focus:outline-none uppercase font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                  placeholder="e.g. Roasted Gujarati specialities"
                  className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E8DEC8] rounded-xl text-stone-900 focus:bg-white focus:border-[#C99A18] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E8DEC8]">
                <button
                  type="button"
                  onClick={() => setIsQuickCategoryModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-stone-600 hover:bg-[#FAF8F5] border border-[#E8DEC8]"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isQuickCatSubmitting}
                  className="btn-gold py-1.5 px-4 rounded-lg text-xs font-bold shadow-xs disabled:opacity-50"
                >
                  {isQuickCatSubmitting ? 'Saving...' : 'Save & Select'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 5. CATEGORIES TAB ADD / EDIT MODAL                                   */}
      {/* ==================================================================== */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white border border-[#E8DEC8] rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            
            <div className="px-5 py-4 border-b border-[#E8DEC8] bg-[#FAF8F5] flex items-center justify-between">
              <h3 className="text-base font-bold text-stone-900 font-serif">
                {editingCategory ? `Edit Category — ${editingCategory.name}` : 'Create New Category'}
              </h3>
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCategoryTab} className="p-5 space-y-3.5">
              {catFormError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{catFormError}</span>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  Category Name <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={catFormName}
                  onChange={(e) => setCatFormName(e.target.value)}
                  placeholder="e.g. SWEETS, FARSAAN, DRY FRUITS"
                  className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E8DEC8] rounded-xl text-stone-900 focus:bg-white focus:border-[#C99A18] focus:outline-none uppercase font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  value={catFormDesc}
                  onChange={(e) => setCatFormDesc(e.target.value)}
                  placeholder="Category notes or product range description"
                  className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-[#E8DEC8] rounded-xl text-stone-900 focus:bg-white focus:border-[#C99A18] focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="catIsActive"
                  checked={catFormIsActive}
                  onChange={(e) => setCatFormIsActive(e.target.checked)}
                  className="rounded border-[#E8DEC8] text-[#C99A18] focus:ring-[#C99A18]"
                />
                <label htmlFor="catIsActive" className="text-xs font-semibold text-stone-800">
                  Active Category (Visible in POS & Inventory)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#E8DEC8]">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:text-stone-900 hover:bg-[#FAF8F5] border border-[#E8DEC8]"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isCatSubmitting}
                  className="btn-gold py-2 px-5 rounded-xl text-xs font-bold shadow-md disabled:opacity-50"
                >
                  {isCatSubmitting ? 'Saving...' : editingCategory ? 'Save Changes' : 'Create Category'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};
