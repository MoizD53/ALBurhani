import React, { useState, useMemo, useEffect } from 'react';
import { Product } from '../../types';
import { 
  Tag, 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  Printer, 
  AlertTriangle, 
  Calendar, 
  Settings2, 
  RotateCcw, 
  Layers, 
  Eye, 
  Barcode as BarcodeIcon,
  CheckCircle2,
  Sliders,
  FileSpreadsheet
} from 'lucide-react';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import { BarcodeLabelItem } from './BarcodeLabelItem';
import { playBeep } from '../../lib/utils';
import { saveSettingToTurso } from '../../lib/turso';

export interface LabelBatchItem {
  product: Product;
  copies: number;
  mfgDate: string; // YYYY-MM-DD
  expDate: string; // YYYY-MM-DD
}

export interface SheetDimensions {
  sheetWidthMm: number;
  sheetHeightMm: number;
  labelWidthMm: number;
  labelHeightMm: number;
  columns: number;
  rows: number;
  gapXMm: number;
  gapYMm: number;
  marginTopMm: number;
  marginLeftMm: number;
  offsetXMm?: number;
  offsetYMm?: number;
  printScale?: number;
}

export const PRESETS: Record<string, { label: string; sheetName: string; dims: SheetDimensions }> = {
  'technova-24l-canon': {
    label: 'TECHNOVA — 24 Labels (Canon)',
    sheetName: 'TechNova NovaJet MPL 24L WR (3×8 · 24 Labels/Sheet)',
    dims: {
      sheetWidthMm: 210,
      sheetHeightMm: 297,
      labelWidthMm: 64,
      labelHeightMm: 34,
      columns: 3,
      rows: 8,
      gapXMm: 3,
      gapYMm: 0,
      marginTopMm: 12.5,
      marginLeftMm: 6,
      offsetXMm: 0,
      offsetYMm: 0,
      printScale: 100,
    },
  },
  'technova-48l-canon': {
    label: 'TECHNOVA — 48 Labels (Canon)',
    sheetName: 'TechNova NovaJet MPL 48L (4×12 · 48 Labels/Sheet)',
    dims: {
      sheetWidthMm: 210,
      sheetHeightMm: 297,
      labelWidthMm: 48,
      labelHeightMm: 24,
      columns: 4,
      rows: 12,
      gapXMm: 3,
      gapYMm: 0,
      marginTopMm: 5.0,
      marginLeftMm: 4.5,
      offsetXMm: 0,
      offsetYMm: 0,
      printScale: 100,
    },
  },
  'novajet-24l': {
    label: 'NovaJet 24L (64 × 34 mm)',
    sheetName: 'Format A — TechNova NovaJet MPL 24L WR (3×8 · 24 Labels/Sheet)',
    dims: {
      sheetWidthMm: 210,
      sheetHeightMm: 297,
      labelWidthMm: 64,
      labelHeightMm: 34,
      columns: 3,
      rows: 8,
      gapXMm: 3,
      gapYMm: 0,
      marginTopMm: 12.5,
      marginLeftMm: 6,
      offsetXMm: 0,
      offsetYMm: 0,
      printScale: 100,
    },
  },
  'novajet-48l': {
    label: 'NovaJet 48L (48 × 24 mm)',
    sheetName: 'Format B — TechNova NovaJet MPL 48L (4×12 · 48 Labels/Sheet)',
    dims: {
      sheetWidthMm: 210,
      sheetHeightMm: 297,
      labelWidthMm: 48,
      labelHeightMm: 24,
      columns: 4,
      rows: 12,
      gapXMm: 3,
      gapYMm: 0,
      marginTopMm: 5.0,
      marginLeftMm: 4.5,
      offsetXMm: 0,
      offsetYMm: 0,
      printScale: 100,
    },
  },
  'standard-2col': {
    label: '2-Up Sheet / Roll (50 × 30 mm)',
    sheetName: 'Standard 2-Column Roll (50 × 30 mm)',
    dims: {
      sheetWidthMm: 110,
      sheetHeightMm: 310,
      labelWidthMm: 50,
      labelHeightMm: 30,
      columns: 2,
      rows: 10,
      gapXMm: 3,
      gapYMm: 3,
      marginTopMm: 5,
      marginLeftMm: 5,
      offsetXMm: 0,
      offsetYMm: 0,
      printScale: 100,
    },
  },
  'single-roll': {
    label: 'Single Thermal Roll (50 × 30 mm)',
    sheetName: 'Single Thermal Roll (50 × 30 mm, 1 Column)',
    dims: {
      sheetWidthMm: 54,
      sheetHeightMm: 34,
      labelWidthMm: 50,
      labelHeightMm: 30,
      columns: 1,
      rows: 1,
      gapXMm: 0,
      gapYMm: 2,
      marginTopMm: 2,
      marginLeftMm: 2,
      offsetXMm: 0,
      offsetYMm: 0,
      printScale: 100,
    },
  },
};

export const DEFAULT_DIMENSIONS: SheetDimensions = PRESETS['technova-24l-canon'].dims;

/**
 * Validates MFG and EXP dates. Returns error message if invalid.
 */
export function validateBatchDates(mfg?: string, exp?: string): string | null {
  if (!mfg || !exp) return null;
  const mfgTime = new Date(mfg).getTime();
  const expTime = new Date(exp).getTime();
  if (!isNaN(mfgTime) && !isNaN(expTime) && expTime < mfgTime) {
    return 'Expiry date (EXP) cannot be earlier than Manufacturing date (MFG).';
  }
  return null;
}

interface LabelStudioViewProps {
  products: Product[];
}

export const LabelStudioView: React.FC<LabelStudioViewProps> = ({ products }) => {
  // Search & Filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [scanNotice, setScanNotice] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Batch Items for Printing
  const [batchItems, setBatchItems] = useState<LabelBatchItem[]>([]);

  // Batch Default Dates Toolbar
  const getTodayStr = () => new Date().toISOString().split('T')[0];
  const [batchMfgDate, setBatchMfgDate] = useState<string>(getTodayStr());
  const [batchExpDate, setBatchExpDate] = useState<string>('');

  // Independent Custom Profiles Store
  const [savedProfiles, setSavedProfiles] = useState<Record<string, SheetDimensions>>(() => {
    try {
      const raw = localStorage.getItem('albhurani_label_custom_profiles');
      if (raw) return JSON.parse(raw);
    } catch {}
    return {};
  });

  // Active preset (defaults to TECHNOVA — 24 Labels (Canon))
  const [activePreset, setActivePreset] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('albhurani_label_preset');
      if (saved && PRESETS[saved]) return saved;
      if (saved === 'novajet-24l') return 'technova-24l-canon';
      if (saved === 'novajet-48l') return 'technova-48l-canon';
    } catch {}
    return 'technova-24l-canon';
  });

  // Print Sheet Config (Independent per profile)
  const [sheetDims, setSheetDims] = useState<SheetDimensions>(() => {
    try {
      const preset = localStorage.getItem('albhurani_label_preset') || 'technova-24l-canon';
      const rawProfiles = localStorage.getItem('albhurani_label_custom_profiles');
      if (rawProfiles) {
        const parsed = JSON.parse(rawProfiles);
        if (parsed[preset]) return parsed[preset];
      }
      const savedSettings = localStorage.getItem('albhurani_label_settings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        if (parsed.labelWidthMm && parsed.labelHeightMm) {
          return {
            ...DEFAULT_DIMENSIONS,
            ...parsed,
          };
        }
      }
    } catch {}
    return DEFAULT_DIMENSIONS;
  });

  const [showSettings, setShowSettings] = useState(false);
  const [viewMode, setViewMode] = useState<'editor' | 'preview'>('editor');

  // Save dimensions to localStorage and sync to Turso cloud independently per profile
  useEffect(() => {
    try {
      localStorage.setItem('albhurani_label_settings', JSON.stringify(sheetDims));
      localStorage.setItem('albhurani_label_preset', activePreset);
      setSavedProfiles((prev) => {
        const updated = { ...prev, [activePreset]: sheetDims };
        try {
          localStorage.setItem('albhurani_label_custom_profiles', JSON.stringify(updated));
        } catch {}
        return updated;
      });
      saveSettingToTurso('label_settings', sheetDims).catch(() => {});
      saveSettingToTurso('label_preset', activePreset).catch(() => {});
    } catch {}
  }, [sheetDims, activePreset]);

  // USB Barcode Scanner Integration
  useBarcodeScanner({
    onScan: (scannedCode) => {
      const code = scannedCode.trim();
      if (!code) return;

      // Exact match preserving leading zeros
      const match = products.find(
        (p) =>
          (p.barcode && p.barcode.toLowerCase() === code.toLowerCase()) ||
          (p.sku && p.sku.toLowerCase() === code.toLowerCase())
      );

      if (match) {
        handleAddProductToBatch(match);
        playBeep('success');
        setScanNotice({
          message: `✓ Scanned & Added: ${match.name} (${match.barcode})`,
          type: 'success',
        });
      } else {
        playBeep('error');
        setScanNotice({
          message: `❌ No catalog product matched barcode: "${code}"`,
          type: 'error',
        });
      }

      setTimeout(() => setScanNotice(null), 4000);
    },
    enabled: true,
  });

  // Categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return ['All', ...Array.from(set)];
  }, [products]);

  // Filtered Products Catalog
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return products.filter((p) => {
      const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.toLowerCase().includes(q));
      return matchesCategory && matchesSearch;
    });
  }, [products, searchQuery, selectedCategory]);

  // Add Product to Batch
  const handleAddProductToBatch = (product: Product) => {
    setBatchItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, copies: item.copies + 1 } : item
        );
      }
      return [
        ...prev,
        {
          product,
          copies: 1,
          mfgDate: batchMfgDate || product.mfgDate || getTodayStr(),
          expDate: batchExpDate || product.expiryDate || '',
        },
      ];
    });
  };

  const handleUpdateCopies = (productId: string, newCopies: number) => {
    if (newCopies <= 0) {
      handleRemoveItem(productId);
      return;
    }
    setBatchItems((prev) =>
      prev.map((item) => (item.product.id === productId ? { ...item, copies: newCopies } : item))
    );
  };

  const handleUpdateItemDates = (
    productId: string,
    field: 'mfgDate' | 'expDate',
    val: string
  ) => {
    setBatchItems((prev) =>
      prev.map((item) => (item.product.id === productId ? { ...item, [field]: val } : item))
    );
  };

  const handleRemoveItem = (productId: string) => {
    setBatchItems((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const handleClearBatch = () => {
    if (batchItems.length === 0) return;
    if (confirm('Clear all products from the current label printing batch?')) {
      setBatchItems([]);
    }
  };

  // Quick Days Adder for EXP Date
  const handleAddDaysToExp = (days: number) => {
    const baseDate = batchMfgDate ? new Date(batchMfgDate) : new Date();
    baseDate.setDate(baseDate.getDate() + days);
    const dateStr = baseDate.toISOString().split('T')[0];
    setBatchExpDate(dateStr);
  };

  // Apply Batch Dates to All Selected Items
  const handleApplyBatchDatesToAll = () => {
    setBatchItems((prev) =>
      prev.map((item) => ({
        ...item,
        mfgDate: batchMfgDate || item.mfgDate,
        expDate: batchExpDate || item.expDate,
      }))
    );
    playBeep('success');
  };

  // Preset Selection with independent profile memory
  const handleSelectPreset = (presetKey: string) => {
    setActivePreset(presetKey);
    const targetDims = savedProfiles[presetKey] || PRESETS[presetKey]?.dims || DEFAULT_DIMENSIONS;
    setSheetDims(targetDims);
  };

  // Fine Calibration Offset Adjustments for Canon printer
  const handleAdjustOffset = (axis: 'X' | 'Y', delta: number) => {
    setSheetDims((prev) => {
      const field = axis === 'X' ? 'offsetXMm' : 'offsetYMm';
      const current = prev[field] || 0;
      const next = Math.round((current + delta) * 10) / 10;
      return { ...prev, [field]: next };
    });
  };

  const handleResetCalibration = () => {
    setSheetDims((prev) => ({
      ...prev,
      offsetXMm: 0,
      offsetYMm: 0,
      printScale: 100,
    }));
  };

  // Effective Margins (base margins + Canon printer calibration offset)
  const effectiveMarginTop = Math.max(0, (sheetDims.marginTopMm || 0) + (sheetDims.offsetYMm || 0));
  const effectiveMarginLeft = Math.max(0, (sheetDims.marginLeftMm || 0) + (sheetDims.offsetXMm || 0));

  // Capacity per full sheet
  const labelsPerSheet = useMemo(() => {
    const cols = sheetDims.columns || 3;
    const rows = sheetDims.rows || (sheetDims.labelHeightMm <= 26 ? 12 : 8);
    return cols * rows;
  }, [sheetDims.columns, sheetDims.rows, sheetDims.labelHeightMm]);

  // Fill 1 Full Sheet Quick Action (e.g. exactly 24 or 48 labels)
  const handleFillFullSheet = () => {
    if (batchItems.length === 0) return;
    const targetCount = labelsPerSheet;
    const count = batchItems.length;
    const baseCopies = Math.floor(targetCount / count);
    const remainder = targetCount % count;

    setBatchItems((prev) =>
      prev.map((item, idx) => ({
        ...item,
        copies: baseCopies + (idx < remainder ? 1 : 0),
      }))
    );
    playBeep('success');
  };

  // Expanded Array of Individual Labels for Printing
  const printLabels = useMemo(() => {
    const list: { product: Product; mfgDate: string; expDate: string; index: number }[] = [];
    let count = 0;
    batchItems.forEach((item) => {
      for (let i = 0; i < item.copies; i++) {
        list.push({
          product: item.product,
          mfgDate: item.mfgDate,
          expDate: item.expDate,
          index: count++,
        });
      }
    });
    return list;
  }, [batchItems]);

  const totalLabelCount = printLabels.length;

  // Chunk print labels into individual A4 pages
  const pages = useMemo(() => {
    const chunks: Array<typeof printLabels> = [];
    const size = Math.max(1, labelsPerSheet);
    for (let i = 0; i < printLabels.length; i += size) {
      chunks.push(printLabels.slice(i, i + size));
    }
    return chunks.length > 0 ? chunks : [[]];
  }, [printLabels, labelsPerSheet]);

  // Validation Checks
  const itemsWithoutBarcode = useMemo(() => {
    return batchItems.filter((item) => !item.product.barcode || !item.product.barcode.trim());
  }, [batchItems]);

  const itemsWithInvalidDates = useMemo(() => {
    return batchItems.filter((item) => validateBatchDates(item.mfgDate, item.expDate) !== null);
  }, [batchItems]);

  const canPrint =
    totalLabelCount > 0 &&
    itemsWithoutBarcode.length === 0 &&
    itemsWithInvalidDates.length === 0;

  const handlePrint = () => {
    if (!canPrint) return;
    window.print();
  };

  return (
    <div className="space-y-4">
      
      {/* ─── Top Header & Controls (Hidden when printing) ─── */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/35">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
                Label Studio
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30 uppercase font-semibold">
                  Admin Only
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                NovaJet MPL A4 sticker sheet formatting (24L & 48L) with calibrated physical margins.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Format & Action Bar */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* NovaJet 24L & 48L Quick Format Buttons */}
          <div className="flex p-0.5 rounded-xl bg-black/60 border border-white/[0.08]">
            <button
              type="button"
              onClick={() => handleSelectPreset('novajet-24l')}
              className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activePreset === 'novajet-24l'
                  ? 'bg-[#D4AF37] text-black font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="NovaJet MPL 24L WR (64 × 34 mm, 3 cols × 8 rows, 24 labels/sheet)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>NovaJet 24L (64×34)</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectPreset('novajet-48l')}
              className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                activePreset === 'novajet-48l'
                  ? 'bg-[#D4AF37] text-black font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="NovaJet MPL 48L (48 × 24 mm, 4 cols × 12 rows, 48 labels/sheet)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>NovaJet 48L (48×24)</span>
            </button>
          </div>

          {/* Fill Sheet Quick Action */}
          {batchItems.length > 0 && (
            <button
              type="button"
              onClick={handleFillFullSheet}
              className="py-1.5 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] text-[#E7C75A] text-xs font-bold transition-all"
              title={`Set copies to fill exactly 1 full A4 sheet (${labelsPerSheet} labels)`}
            >
              <span>Fill Sheet ({labelsPerSheet})</span>
            </button>
          )}

          {/* View Mode Toggle */}
          <div className="flex p-0.5 rounded-xl bg-black/60 border border-white/[0.08]">
            <button
              onClick={() => setViewMode('editor')}
              className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'editor'
                  ? 'bg-[#D4AF37] text-black font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Batch ({totalLabelCount})</span>
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={`py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'preview'
                  ? 'bg-[#D4AF37] text-black font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>A4 Preview ({pages.length} Pg)</span>
            </button>
          </div>

          {/* Sheet Settings Toggle */}
          <button
            onClick={() => setShowSettings((prev) => !prev)}
            className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
              showSettings
                ? 'bg-[#D4AF37]/15 border-[#D4AF37] text-[#D4AF37]'
                : 'bg-[#121214] border-white/[0.08] text-zinc-300 hover:text-white'
            }`}
            title="Adjust Sticker Dimensions, Offsets & Calibration Gaps"
          >
            <Settings2 className="w-4 h-4" />
          </button>

          {/* Primary Print Button */}
          <button
            onClick={handlePrint}
            disabled={!canPrint}
            className="btn-gold py-2 px-4 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            title={canPrint ? 'Print barcode labels' : 'Add products with valid barcodes to enable print'}
          >
            <Printer className="w-4 h-4" />
            <span>Print Sheet ({totalLabelCount})</span>
          </button>
        </div>
      </div>

      {/* ─── Scanner Feedback Toast (Hidden when printing) ─── */}
      {scanNotice && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center gap-2 border animate-fade-in print:hidden ${
            scanNotice.type === 'success'
              ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-200'
              : 'bg-red-950/70 border-red-500/40 text-red-200'
          }`}
        >
          {scanNotice.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          )}
          <span>{scanNotice.message}</span>
        </div>
      )}

      {/* ─── Validation Warnings (Hidden when printing) ─── */}
      {itemsWithoutBarcode.length > 0 && (
        <div className="p-3 rounded-xl bg-amber-950/60 border border-amber-500/40 text-amber-200 text-xs flex items-start gap-2.5 print:hidden">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">
              Barcode Label Printing Blocked: {itemsWithoutBarcode.length} selected product(s) have no valid barcode.
            </span>
            <span className="text-[11px] text-amber-300/80">
              {itemsWithoutBarcode.map((i) => i.product.name).join(', ')}. Please assign barcodes in Inventory or remove them from this batch.
            </span>
          </div>
        </div>
      )}

      {itemsWithInvalidDates.length > 0 && (
        <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-start gap-2.5 print:hidden">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">Date Validation Error:</span>
            <span className="text-[11px] text-red-300/80">
              Expiry date (EXP) cannot be earlier than Manufacturing date (MFG). Please correct dates before printing.
            </span>
          </div>
        </div>
      )}

      {/* ─── Configurable Sheet Settings Drawer (Hidden when printing) ─── */}
      {showSettings && (
        <div className="p-4 rounded-2xl bg-[#121214] border border-[#D4AF37]/35 shadow-xl space-y-4 print:hidden animate-fade-in">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#D4AF37]" />
              <h3 className="font-bold text-sm text-white">Canon Printer & TECHNOVA Sheet Calibration</h3>
            </div>
            <button
              onClick={() => {
                const def = PRESETS[activePreset]?.dims || DEFAULT_DIMENSIONS;
                setSheetDims(def);
              }}
              className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Selected Profile to Defaults</span>
            </button>
          </div>

          {/* Quick Presets / Profiles */}
          <div>
            <label className="text-[11px] uppercase font-bold text-zinc-400 block mb-1.5">
              TECHNOVA Paper Profiles (Canon Printer):
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {Object.entries(PRESETS).map(([key, item]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSelectPreset(key)}
                  className={`p-2.5 rounded-xl text-left border text-xs transition-all ${
                    activePreset === key
                      ? 'border-[#D4AF37] bg-[#D4AF37]/15 text-white font-semibold'
                      : 'border-white/[0.08] bg-white/[0.02] text-zinc-400 hover:text-white'
                  }`}
                >
                  <span className="block font-bold text-white text-[11px] leading-snug">{item.label}</span>
                  <span className="text-[10px] text-[#C5A85A] mt-0.5 block font-mono">
                    {item.dims.labelWidthMm}×{item.dims.labelHeightMm}mm · {item.dims.columns}×{item.dims.rows} ({item.dims.columns * item.dims.rows} labels)
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Canon Fine Printer Calibration (Offsets & Scale) */}
          <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#E7C75A] flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5" />
                Canon Hardware Alignment & Fine Calibration
              </span>
              <button
                type="button"
                onClick={handleResetCalibration}
                className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1"
                title="Reset fine alignment offsets to 0"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Offsets (0mm)</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              {/* Vertical Y Calibration */}
              <div className="p-2.5 rounded-lg bg-black/40 border border-white/[0.06] flex flex-col justify-between">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[11px] font-semibold text-zinc-300">Vertical Offset (Y)</span>
                  <span className="font-mono font-bold text-[#E7C75A] text-[11px]">
                    {(sheetDims.offsetYMm || 0) > 0 ? '+' : ''}{(sheetDims.offsetYMm || 0).toFixed(1)} mm
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleAdjustOffset('Y', -0.5)}
                    className="flex-1 py-1 px-2 rounded bg-white/[0.08] hover:bg-white/[0.15] text-white font-bold text-xs"
                    title="Move content UP by 0.5mm"
                  >
                    -0.5mm (Up)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdjustOffset('Y', 0.5)}
                    className="flex-1 py-1 px-2 rounded bg-white/[0.08] hover:bg-white/[0.15] text-white font-bold text-xs"
                    title="Move content DOWN by 0.5mm"
                  >
                    +0.5mm (Down)
                  </button>
                </div>
                <p className="text-[9px] text-zinc-500 mt-1 leading-tight">
                  If bottom of label touches the next row, click -0.5mm to shift up.
                </p>
              </div>

              {/* Horizontal X Calibration */}
              <div className="p-2.5 rounded-lg bg-black/40 border border-white/[0.06] flex flex-col justify-between">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[11px] font-semibold text-zinc-300">Horizontal Offset (X)</span>
                  <span className="font-mono font-bold text-[#E7C75A] text-[11px]">
                    {(sheetDims.offsetXMm || 0) > 0 ? '+' : ''}{(sheetDims.offsetXMm || 0).toFixed(1)} mm
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleAdjustOffset('X', -0.5)}
                    className="flex-1 py-1 px-2 rounded bg-white/[0.08] hover:bg-white/[0.15] text-white font-bold text-xs"
                    title="Move content LEFT by 0.5mm"
                  >
                    -0.5mm (Left)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdjustOffset('X', 0.5)}
                    className="flex-1 py-1 px-2 rounded bg-white/[0.08] hover:bg-white/[0.15] text-white font-bold text-xs"
                    title="Move content RIGHT by 0.5mm"
                  >
                    +0.5mm (Right)
                  </button>
                </div>
                <p className="text-[9px] text-zinc-500 mt-1 leading-tight">
                  Adjust left/right horizontal placement.
                </p>
              </div>

              {/* Print Scale (Default 100% Actual Size) */}
              <div className="p-2.5 rounded-lg bg-black/40 border border-white/[0.06] flex flex-col justify-between">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[11px] font-semibold text-zinc-300">Print Scale</span>
                  <span className="font-mono font-bold text-emerald-400 text-[11px]">
                    {sheetDims.printScale || 100}% (Actual Size)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSheetDims((prev) => ({ ...prev, printScale: Math.max(90, (prev.printScale || 100) - 1) }))}
                    className="flex-1 py-1 px-2 rounded bg-white/[0.08] hover:bg-white/[0.15] text-white font-bold text-xs"
                  >
                    -1%
                  </button>
                  <button
                    type="button"
                    onClick={() => setSheetDims((prev) => ({ ...prev, printScale: 100 }))}
                    className="py-1 px-2 rounded bg-white/[0.08] hover:bg-white/[0.15] text-white font-bold text-xs"
                  >
                    100%
                  </button>
                  <button
                    type="button"
                    onClick={() => setSheetDims((prev) => ({ ...prev, printScale: Math.min(110, (prev.printScale || 100) + 1) }))}
                    className="flex-1 py-1 px-2 rounded bg-white/[0.08] hover:bg-white/[0.15] text-white font-bold text-xs"
                  >
                    +1%
                  </button>
                </div>
                <p className="text-[9px] text-zinc-500 mt-1 leading-tight">
                  Must remain at 100% (Actual Size). Never use "Fit to Printable Area".
                </p>
              </div>
            </div>
          </div>

          {/* Granular Dimension Fields for Sheet & Sticker Profiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 pt-2 text-xs">
            <div>
              <label className="text-[10px] text-zinc-400 block mb-1">Label Width (mm)</label>
              <input
                type="number"
                min="20"
                max="120"
                value={sheetDims.labelWidthMm}
                onChange={(e) => {
                  setSheetDims((prev) => ({ ...prev, labelWidthMm: Number(e.target.value) || 64 }));
                  setActivePreset('custom');
                }}
                className="w-full bg-black/50 border border-white/[0.1] rounded-lg px-2.5 py-1 text-white font-mono"
              />
            </div>

            <div>
              <label className="text-[10px] text-zinc-400 block mb-1">Label Height (mm)</label>
              <input
                type="number"
                min="15"
                max="120"
                value={sheetDims.labelHeightMm}
                onChange={(e) => {
                  setSheetDims((prev) => ({ ...prev, labelHeightMm: Number(e.target.value) || 34 }));
                  setActivePreset('custom');
                }}
                className="w-full bg-black/50 border border-white/[0.1] rounded-lg px-2.5 py-1 text-white font-mono"
              />
            </div>

            <div>
              <label className="text-[10px] text-zinc-400 block mb-1">Columns</label>
              <input
                type="number"
                min="1"
                max="6"
                value={sheetDims.columns}
                onChange={(e) => {
                  setSheetDims((prev) => ({ ...prev, columns: Math.max(1, Number(e.target.value) || 1) }));
                  setActivePreset('custom');
                }}
                className="w-full bg-black/50 border border-white/[0.1] rounded-lg px-2.5 py-1 text-white font-mono"
              />
            </div>

            <div>
              <label className="text-[10px] text-zinc-400 block mb-1">Rows</label>
              <input
                type="number"
                min="1"
                max="20"
                value={sheetDims.rows}
                onChange={(e) => {
                  setSheetDims((prev) => ({ ...prev, rows: Math.max(1, Number(e.target.value) || 1) }));
                  setActivePreset('custom');
                }}
                className="w-full bg-black/50 border border-white/[0.1] rounded-lg px-2.5 py-1 text-white font-mono"
              />
            </div>

            <div>
              <label className="text-[10px] text-zinc-400 block mb-1">Horiz Gap (mm)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="30"
                value={sheetDims.gapXMm}
                onChange={(e) => {
                  setSheetDims((prev) => ({ ...prev, gapXMm: Number(e.target.value) || 0 }));
                  setActivePreset('custom');
                }}
                className="w-full bg-black/50 border border-white/[0.1] rounded-lg px-2.5 py-1 text-white font-mono"
              />
            </div>

            <div>
              <label className="text-[10px] text-zinc-400 block mb-1">Vert Gap (mm)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="30"
                value={sheetDims.gapYMm}
                onChange={(e) => {
                  setSheetDims((prev) => ({ ...prev, gapYMm: Number(e.target.value) || 0 }));
                  setActivePreset('custom');
                }}
                className="w-full bg-black/50 border border-white/[0.1] rounded-lg px-2.5 py-1 text-white font-mono"
              />
            </div>

            <div>
              <label className="text-[10px] text-zinc-400 block mb-1">Top Margin (mm)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="50"
                value={sheetDims.marginTopMm}
                onChange={(e) => {
                  setSheetDims((prev) => ({ ...prev, marginTopMm: Number(e.target.value) || 0 }));
                  setActivePreset('custom');
                }}
                className="w-full bg-black/50 border border-white/[0.1] rounded-lg px-2.5 py-1 text-white font-mono"
              />
            </div>

            <div>
              <label className="text-[10px] text-zinc-400 block mb-1">Left Margin (mm)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="50"
                value={sheetDims.marginLeftMm}
                onChange={(e) => {
                  setSheetDims((prev) => ({ ...prev, marginLeftMm: Number(e.target.value) || 0 }));
                  setActivePreset('custom');
                }}
                className="w-full bg-black/50 border border-white/[0.1] rounded-lg px-2.5 py-1 text-white font-mono"
              />
            </div>
          </div>

          {/* Alignment & Calibration Guidance */}
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-[11px] text-zinc-400 space-y-1">
            <span className="text-[#D4AF37] font-semibold block">Canon Alignment & Calibration Guidance:</span>
            <p>
              • <strong>Vertical Overlap Prevention:</strong> In both TECHNOVA 24L and 48L, each sticker is physically bounded with safe internal padding. MRP and MFG/EXP remain strictly within their sticker box.
            </p>
            <p>
              • <strong>Canon Paper Feeder Offset:</strong> If test prints are shifted down by 1–2mm due to the Canon printer gripper, use <em>Vertical Offset: -1.0mm (Up)</em>.
            </p>
            <p>
              • <strong>Browser Print Settings:</strong> Set <em>Paper size: A4</em>, <em>Scale: 100% (Default / Actual Size)</em>, and <em>Margins: None</em> in the print dialog.
            </p>
          </div>
        </div>
      )}

      {/* ─── Batch Dates Master Bar (Hidden when printing) ─── */}
      <div className="p-3.5 rounded-2xl bg-[#121214] border border-white/[0.08] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs print:hidden">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#D4AF37]" />
          <span className="font-bold text-white">Batch Dates Preset:</span>
          <span className="text-[11px] text-zinc-400 hidden sm:inline">
            Quickly configure MFG / EXP across all labels
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-400 text-[11px]">MFG:</span>
            <input
              type="date"
              value={batchMfgDate}
              onChange={(e) => setBatchMfgDate(e.target.value)}
              className="bg-black/60 border border-white/[0.1] rounded-lg px-2 py-1 text-white text-[11px] font-mono focus:border-[#D4AF37]"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-zinc-400 text-[11px]">EXP:</span>
            <input
              type="date"
              value={batchExpDate}
              onChange={(e) => setBatchExpDate(e.target.value)}
              className="bg-black/60 border border-white/[0.1] rounded-lg px-2 py-1 text-white text-[11px] font-mono focus:border-[#D4AF37]"
            />
          </div>

          {/* Quick Shelf-life buttons */}
          <div className="flex items-center gap-1">
            {[30, 60, 90, 180].map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => handleAddDaysToExp(days)}
                className="px-2 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-[10px] font-semibold text-zinc-300 hover:text-white transition-colors"
                title={`Set EXP to ${days} days from MFG`}
              >
                +{days}d
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleApplyBatchDatesToAll}
            disabled={batchItems.length === 0}
            className="py-1 px-3 rounded-lg bg-[#D4AF37]/20 hover:bg-[#D4AF37]/30 border border-[#D4AF37]/40 text-[#E7C75A] font-bold text-xs disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            Apply to All Selected
          </button>
        </div>
      </div>

      {/* ─── Mode 1: Batch Editor (Hidden when printing) ─── */}
      {viewMode === 'editor' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 print:hidden">
          
          {/* Left Column (5 cols): Product Catalog Picker */}
          <div className="lg:col-span-5 space-y-3">
            <div className="p-3.5 rounded-2xl bg-[#121214] border border-white/[0.08] shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
                  <BarcodeIcon className="w-4 h-4 text-[#D4AF37]" />
                  <span>Select Catalog Products</span>
                </h3>
                <span className="text-[11px] text-zinc-400 font-mono">
                  {filteredProducts.length} items
                </span>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Scan USB barcode or search name/SKU..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-black/50 border border-white/[0.1] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:border-[#D4AF37] focus:outline-none"
                />
              </div>

              {/* Categories */}
              <div className="flex gap-1 overflow-x-auto no-scrollbar pb-0.5">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`py-1 px-2.5 rounded-lg text-[10px] font-semibold whitespace-nowrap transition-colors ${
                      selectedCategory === cat
                        ? 'bg-[#D4AF37] text-black font-bold'
                        : 'bg-white/[0.04] text-zinc-400 hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Products List */}
              <div className="max-h-[500px] overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
                {filteredProducts.length === 0 ? (
                  <div className="text-center py-8 text-zinc-500 text-xs">
                    No products matched your search.
                  </div>
                ) : (
                  filteredProducts.map((p) => {
                    const isAdded = batchItems.some((i) => i.product.id === p.id);
                    const hasBarcode = Boolean(p.barcode && p.barcode.trim());
                    return (
                      <div
                        key={p.id}
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                          isAdded
                            ? 'bg-[#D4AF37]/10 border-[#D4AF37]/40'
                            : 'bg-white/[0.02] hover:bg-white/[0.04] border-white/[0.06]'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-xs text-white truncate block">
                              {p.name}
                            </span>
                            {!hasBarcode && (
                              <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-red-500/15 text-red-400 border border-red-500/30 shrink-0">
                                No Barcode
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-mono mt-0.5">
                            <span>SKU: {p.sku}</span>
                            <span>•</span>
                            <span className="text-[#C5A85A] font-bold">Rs. {p.sellingPrice.toFixed(2)}</span>
                            {hasBarcode && (
                              <>
                                <span>•</span>
                                <span className="text-zinc-500">[{p.barcode}]</span>
                              </>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleAddProductToBatch(p)}
                          className="p-1.5 rounded-lg bg-white/[0.06] hover:bg-[#D4AF37] hover:text-black text-zinc-300 transition-all shrink-0 active:scale-95"
                          title="Add to label print batch"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Right Column (7 cols): Selected Batch Table & Live Single Label Preview */}
          <div className="lg:col-span-7 space-y-3">
            <div className="p-3.5 rounded-2xl bg-[#121214] border border-white/[0.08] shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#D4AF37]" />
                  <h3 className="font-bold text-white text-sm">
                    Print Batch ({batchItems.length} Products · {totalLabelCount} Labels)
                  </h3>
                </div>

                {batchItems.length > 0 && (
                  <button
                    onClick={handleClearBatch}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {batchItems.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 text-xs space-y-2">
                  <Tag className="w-8 h-8 text-zinc-600 mx-auto" />
                  <p className="font-semibold text-zinc-400">No products added to the label batch yet.</p>
                  <p className="text-[11px] text-zinc-600 max-w-sm mx-auto">
                    Search from the catalog on the left or scan product barcodes using your USB scanner to start building your sticker sheet.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
                  {batchItems.map((item) => {
                    const hasBarcode = Boolean(item.product.barcode && item.product.barcode.trim());
                    const dateErr = validateBatchDates(item.mfgDate, item.expDate);

                    return (
                      <div
                        key={item.product.id}
                        className={`p-3 rounded-xl border space-y-2 transition-all ${
                          !hasBarcode || dateErr
                            ? 'bg-red-950/20 border-red-500/40'
                            : 'bg-white/[0.02] border-white/[0.08]'
                        }`}
                      >
                        {/* Header Row: Product Info & Copies */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-white truncate block">
                                {item.product.name}
                              </span>
                              {!hasBarcode && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/40">
                                  Missing Barcode
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-mono mt-0.5">
                              <span>SKU: {item.product.sku}</span>
                              <span>•</span>
                              <span>Barcode: {item.product.barcode || 'N/A'}</span>
                              <span>•</span>
                              <span className="text-[#D4AF37] font-bold">
                                Rs. {item.product.sellingPrice.toFixed(2)}
                              </span>
                            </div>
                          </div>

                          {/* Copies Selector */}
                          <div className="flex items-center gap-1.5 shrink-0 bg-black/60 p-1 rounded-xl border border-white/[0.08]">
                            <button
                              type="button"
                              onClick={() => handleUpdateCopies(item.product.id, item.copies - 1)}
                              className="w-6 h-6 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 flex items-center justify-center transition-colors"
                              title="Decrease copies"
                            >
                              <Minus className="w-3 h-3" />
                            </button>

                            <input
                              type="number"
                              min="1"
                              max="500"
                              value={item.copies}
                              onChange={(e) =>
                                handleUpdateCopies(
                                  item.product.id,
                                  Math.max(1, parseInt(e.target.value) || 1)
                                )
                              }
                              style={{
                                width: '42px',
                                height: '26px',
                                padding: '0',
                                margin: '0',
                                backgroundColor: '#FFFFFF',
                                color: '#1C1917',
                                border: '1.5px solid #C99A18',
                                borderRadius: '6px',
                                textAlign: 'center',
                                fontWeight: '800',
                                fontSize: '13px',
                                lineHeight: '26px',
                                WebkitAppearance: 'none',
                                MozAppearance: 'textfield',
                              }}
                              className="no-spinner font-mono shadow-inner focus:outline-none focus:ring-1 focus:ring-[#C99A18]"
                              title="Number of sticker copies"
                            />

                            <button
                              type="button"
                              onClick={() => handleUpdateCopies(item.product.id, item.copies + 1)}
                              className="w-6 h-6 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 flex items-center justify-center transition-colors"
                              title="Increase copies"
                            >
                              <Plus className="w-3 h-3" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.product.id)}
                              className="w-6 h-6 rounded-lg text-zinc-500 hover:text-red-400 flex items-center justify-center transition-colors ml-1"
                              title="Remove product from batch"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {/* Dates Row */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-white/[0.04] text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-zinc-400 w-10">MFG:</span>
                            <input
                              type="date"
                              value={item.mfgDate}
                              onChange={(e) =>
                                handleUpdateItemDates(item.product.id, 'mfgDate', e.target.value)
                              }
                              className="flex-1 bg-black/40 border border-white/[0.08] rounded-lg px-2 py-1 text-white text-[11px] font-mono focus:border-[#D4AF37]"
                            />
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-zinc-400 w-10">EXP:</span>
                            <input
                              type="date"
                              value={item.expDate}
                              onChange={(e) =>
                                handleUpdateItemDates(item.product.id, 'expDate', e.target.value)
                              }
                              className={`flex-1 bg-black/40 border rounded-lg px-2 py-1 text-white text-[11px] font-mono focus:border-[#D4AF37] ${
                                dateErr ? 'border-red-500 text-red-200' : 'border-white/[0.08]'
                              }`}
                            />
                          </div>
                        </div>

                        {dateErr && (
                          <div className="text-[10px] text-red-400 font-semibold flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            <span>{dateErr}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Mode 2: Full Sheet Preview (Visible in Preview Mode, Hidden when printing) ─── */}
      {viewMode === 'preview' && (
        <div className="p-4 rounded-2xl bg-[#121214] border border-white/[0.08] shadow-sm space-y-4 print:hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
            <div>
              <h3 className="font-bold text-white text-sm">
                A4 Sticker Sheet Preview ({pages.length} Page{pages.length > 1 ? 's' : ''} · {totalLabelCount} Labels)
              </h3>
              <p className="text-[11px] text-zinc-400">
                {PRESETS[activePreset]?.label || 'TECHNOVA Sheet'} — {sheetDims.columns} columns × {sheetDims.rows} rows ({labelsPerSheet} stickers/sheet) · Scale: {sheetDims.printScale || 100}%
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleFillFullSheet}
                disabled={batchItems.length === 0}
                className="py-1.5 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-bold text-[#E7C75A] border border-white/[0.1] transition-all disabled:opacity-40"
              >
                Fill Full Sheet ({labelsPerSheet})
              </button>
              <button
                onClick={handlePrint}
                disabled={!canPrint}
                className="btn-gold py-1.5 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow disabled:opacity-40"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Now</span>
              </button>
            </div>
          </div>

          {totalLabelCount === 0 ? (
            <div className="text-center py-12 text-zinc-500 text-xs">
              No labels to preview. Add products in the Batch Editor tab.
            </div>
          ) : (
            <div className="bg-[#1a1a1f] p-4 sm:p-6 rounded-xl overflow-x-auto flex flex-col items-center gap-8 custom-scrollbar">
              {pages.map((pageLabels, pageIdx) => (
                <div key={`preview-pg-${pageIdx}`} className="flex flex-col items-center gap-2">
                  <span className="text-xs font-mono text-zinc-400 font-semibold">
                    Page {pageIdx + 1} of {pages.length} ({pageLabels.length} of {labelsPerSheet} stickers)
                  </span>
                  
                  {/* Visual A4 Sheet Container */}
                  <div
                    style={{
                      width: `${sheetDims.sheetWidthMm || 210}mm`,
                      minHeight: `${sheetDims.sheetHeightMm || 297}mm`,
                      boxSizing: 'border-box',
                      paddingTop: `${effectiveMarginTop}mm`,
                      paddingLeft: `${effectiveMarginLeft}mm`,
                      display: 'grid',
                      gridTemplateColumns: `repeat(${sheetDims.columns}, ${sheetDims.labelWidthMm}mm)`,
                      gridTemplateRows: `repeat(${sheetDims.rows}, ${sheetDims.labelHeightMm}mm)`,
                      columnGap: `${sheetDims.gapXMm}mm`,
                      rowGap: `${sheetDims.gapYMm}mm`,
                    }}
                    className="bg-white rounded-lg shadow-2xl border border-gray-400 relative overflow-hidden"
                  >
                    {pageLabels.map((lbl, idx) => (
                      <BarcodeLabelItem
                        key={`prev-${lbl.product.id}-${lbl.index}-${idx}`}
                        product={lbl.product}
                        mfgDate={lbl.mfgDate}
                        expDate={lbl.expDate}
                        widthMm={sheetDims.labelWidthMm}
                        heightMm={sheetDims.labelHeightMm}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Hidden Printable Multi-Label Sheet (ONLY rendered during window.print) ─── */}
      <style>{`
        @media print {
          @page {
            size: ${sheetDims.sheetWidthMm || 210}mm ${sheetDims.sheetHeightMm || 297}mm;
            margin: 0mm;
          }
          #label-studio-print-sheet {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: ${sheetDims.sheetWidthMm || 210}mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #FFFFFF !important;
            z-index: 999999 !important;
          }
          .a4-label-page {
            width: ${sheetDims.sheetWidthMm || 210}mm !important;
            height: ${sheetDims.sheetHeightMm || 297}mm !important;
            max-height: ${sheetDims.sheetHeightMm || 297}mm !important;
            margin: 0 !important;
            box-sizing: border-box !important;
            background: #FFFFFF !important;
            overflow: hidden !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>
      <div id="label-studio-print-sheet">
        {pages.map((pageLabels, pageIdx) => (
          <div
            key={`print-page-${pageIdx}`}
            className="a4-label-page"
            style={{
              width: `${sheetDims.sheetWidthMm || 210}mm`,
              height: `${sheetDims.sheetHeightMm || 297}mm`,
              maxHeight: `${sheetDims.sheetHeightMm || 297}mm`,
              boxSizing: 'border-box',
              paddingTop: `${effectiveMarginTop}mm`,
              paddingLeft: `${effectiveMarginLeft}mm`,
              display: 'grid',
              gridTemplateColumns: `repeat(${sheetDims.columns}, ${sheetDims.labelWidthMm}mm)`,
              gridTemplateRows: `repeat(${sheetDims.rows}, ${sheetDims.labelHeightMm}mm)`,
              columnGap: `${sheetDims.gapXMm}mm`,
              rowGap: `${sheetDims.gapYMm}mm`,
              pageBreakAfter: pageIdx < pages.length - 1 ? 'always' : 'auto',
              breakAfter: pageIdx < pages.length - 1 ? 'page' : 'auto',
              overflow: 'hidden',
            }}
          >
            {pageLabels.map((lbl, idx) => (
              <BarcodeLabelItem
                key={`print-${lbl.product.id}-${lbl.index}-${idx}`}
                product={lbl.product}
                mfgDate={lbl.mfgDate}
                expDate={lbl.expDate}
                widthMm={sheetDims.labelWidthMm}
                heightMm={sheetDims.labelHeightMm}
              />
            ))}
          </div>
        ))}
      </div>

    </div>
  );
};
