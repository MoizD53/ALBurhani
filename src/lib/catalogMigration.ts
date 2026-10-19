import { Product } from '../types';

export interface TargetKgConversion {
  name: string;
  oldPrice: number;
  newPrice: number;
}

/**
 * Exactly approved 41 products to convert from per-gram to per-kilogram pricing.
 * Identified by unique product barcode / SKU and verified old per-gram price.
 */
export const TARGET_41_KG_CONVERSIONS: Record<string, TargetKgConversion> = {
  '48286475721': { name: 'BHEL MIX BM', oldPrice: 0.24, newPrice: 240 },
  '50470789537': { name: 'JINI SEV J / FIKI SEV F', oldPrice: 0.32, newPrice: 320 },
  '48698892011': { name: 'MASALA PAPDI MP', oldPrice: 0.32, newPrice: 320 },
  '22145272932': { name: 'PALAK PAPDI PP', oldPrice: 0.32, newPrice: 320 },
  '86184406981': { name: 'STAR GATHIYA SG', oldPrice: 0.32, newPrice: 320 },
  '91573959896': { name: 'DALWADA BATTER DB', oldPrice: 0.30, newPrice: 300 },
  '92322726408': { name: 'DALWADA D', oldPrice: 0.30, newPrice: 300 },
  '69178218948': { name: 'KEBABS K', oldPrice: 0.40, newPrice: 400 },
  '84060545632': { name: 'SAKKARPARA S', oldPrice: 0.28, newPrice: 280 },
  '57725551999': { name: 'METHI CHASKA PURI MCP', oldPrice: 0.35, newPrice: 350 },
  '39431352087': { name: 'GHAV CHEVDO GC', oldPrice: 0.28, newPrice: 280 },
  '24714292347': { name: 'AJMERI HALWA AH', oldPrice: 0.44, newPrice: 440 },
  '12063609221': { name: 'Akhrot ( walnut ) halwa AH', oldPrice: 0.70, newPrice: 700 },
  '46881318615': { name: 'BADAM HALWA BH', oldPrice: 0.60, newPrice: 600 },
  '59764300219': { name: 'BALUSAHI B', oldPrice: 0.18, newPrice: 180 },
  '83250893435': { name: 'BATRISO B', oldPrice: 0.70, newPrice: 700 },
  '34017896820': { name: 'BESAN LADDU. (Dal na ladva) DL', oldPrice: 0.30, newPrice: 300 },
  '94360714456': { name: 'BLUE BERRY HALWA BBH', oldPrice: 0.60, newPrice: 600 },
  '23834258760': { name: 'DAHIWADA D', oldPrice: 0.20, newPrice: 200 },
  '89255008606': { name: 'DUDH HALWA DH', oldPrice: 0.40, newPrice: 400 },
  '27150654992': { name: 'DUDHI HALWA DH', oldPrice: 0.30, newPrice: 300 },
  '71995420644': { name: 'EGG MEHSUB   ( BEDA NA MEHSUB ) EM BM', oldPrice: 0.70, newPrice: 700 },
  '88926619411': { name: 'GOL - PAPDI (GOLPAPDI) SPECIAL 900 GP 900', oldPrice: 0.90, newPrice: 900 },
  '21682081139': { name: 'GULAB JAMUN GJ', oldPrice: 0.28, newPrice: 280 },
  '27962279813': { name: 'KALI K', oldPrice: 0.18, newPrice: 180 },
  '53375240071': { name: 'KALI LADDU DRY FRUIT KLD', oldPrice: 0.24, newPrice: 240 },
  '69601260079': { name: 'KALI LADDU KL', oldPrice: 0.18, newPrice: 180 },
  '75884674264': { name: 'KESAR COCONUT PENDA KCP', oldPrice: 0.48, newPrice: 480 },
  '70280972386': { name: 'KESAR PENDA KP', oldPrice: 0.50, newPrice: 500 },
  '25482811086': { name: 'KHOPRA PAAK KP', oldPrice: 0.40, newPrice: 400 },
  '49874499772': { name: 'MALAI COCONUT PENDA MCP', oldPrice: 0.48, newPrice: 480 },
  '19304396564': { name: 'MALAI HALWA MH', oldPrice: 0.70, newPrice: 700 },
  '40181750961': { name: 'MALAI PENDA MP', oldPrice: 0.48, newPrice: 480 },
  '25498345723': { name: 'MATHURA PENDA MP', oldPrice: 0.48, newPrice: 480 },
  '17699828362': { name: 'MEHSUB M', oldPrice: 0.30, newPrice: 300 },
  '74263739184': { name: 'MOHAN - THAAL MT', oldPrice: 0.50, newPrice: 500 },
  '89415203820': { name: 'NARIYAL PAAK NP', oldPrice: 0.48, newPrice: 480 },
  '70849927485': { name: 'PAPDI HALWA PH', oldPrice: 0.60, newPrice: 600 },
  '72344815048': { name: 'PENDA MIX PM', oldPrice: 0.48, newPrice: 480 },
  '63576104528': { name: 'ROSE COCONUT PENDA RCP', oldPrice: 0.48, newPrice: 480 },
  '70352016819': { name: 'ROSE PENDA RP', oldPrice: 0.48, newPrice: 480 },
};

export const MIGRATION_STORAGE_KEY = 'albhurani_kg_price_migration_v1';

/**
 * Checks if a product is one of the approved per-gram products needing conversion.
 * Strictly verifies against both target barcode map and per-gram price threshold.
 */
export function isApprovedPerGramProduct(product: Product): boolean {
  const target = TARGET_41_KG_CONVERSIONS[product.barcode] || (product.sku ? TARGET_41_KG_CONVERSIONS[product.sku] : undefined);
  if (!target) return false;

  // If already converted to per-kg price (>= 50), do not convert again
  if (product.sellingPrice >= 50) return false;

  // Verify it matches old per-gram price threshold
  return product.sellingPrice > 0 && product.sellingPrice < 1.5;
}

/**
 * Converts a single approved product from per-gram to per-kilogram.
 */
export function convertProductToKgPrice(product: Product): Product {
  const target = TARGET_41_KG_CONVERSIONS[product.barcode] || (product.sku ? TARGET_41_KG_CONVERSIONS[product.sku] : undefined);
  if (!target) return product;

  // Convert unit price by multiplying per-gram rate by 1000
  const newSellingPrice = target.newPrice;
  const newCostPrice = product.costPrice > 0 && product.costPrice < 1.5
    ? Math.round(product.costPrice * 1000)
    : product.costPrice;

  // Convert any quantity-tier prices that are stored per-gram
  const convertedTiers = product.priceTiers?.map((tier) => ({
    minQuantity: tier.minQuantity,
    price: tier.price > 0 && tier.price < 10 ? Math.round(tier.price * 1000) : tier.price,
  }));

  return {
    ...product,
    unit: 'KG',
    priceBasis: '₹/kg',
    netWeight: 'Per KG',
    sellingPrice: newSellingPrice,
    costPrice: newCostPrice,
    priceTiers: convertedTiers && convertedTiers.length > 0 ? convertedTiers : product.priceTiers,
  };
}

/**
 * Migrates a list of products idempotently.
 * - Converts only the approved 41 products if currently expressed per gram.
 * - Leaves all 62 existing KG products completely untouched.
 * - Leaves all other PCS products (e.g. Samosa, Bun, Kaju Katli) completely untouched.
 * - Leaves already-converted products completely untouched.
 */
export function migrateCatalogPrices(products: Product[]): {
  products: Product[];
  migratedCount: number;
} {
  let migratedCount = 0;

  const updatedProducts = products.map((p) => {
    if (isApprovedPerGramProduct(p)) {
      migratedCount++;
      return convertProductToKgPrice(p);
    }
    return p;
  });

  return {
    products: updatedProducts,
    migratedCount,
  };
}

/**
 * Applies the catalog migration and synchronizes to local storage and remote Turso.
 * Safe across device refreshes, cross-browser sessions, and cloud synchronization.
 */
export function applyCatalogMigrationWithPersistence(
  products: Product[],
  syncFn?: (product: Product) => Promise<boolean>
): { products: Product[]; migratedCount: number } {
  const { products: migratedProducts, migratedCount } = migrateCatalogPrices(products);

  if (migratedCount > 0) {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('albhurani_products', JSON.stringify(migratedProducts));
        localStorage.setItem(MIGRATION_STORAGE_KEY, 'true');
      } catch (err) {
        console.warn('Could not persist migrated products to localStorage:', err);
      }
    }

    // Sync converted products to remote Turso database in the background if sync function is provided
    if (syncFn) {
      for (const p of migratedProducts) {
        if (TARGET_41_KG_CONVERSIONS[p.barcode] || (p.sku && TARGET_41_KG_CONVERSIONS[p.sku])) {
          syncFn(p).catch((err) =>
            console.warn(`Turso price migration background sync error for ${p.name}:`, err)
          );
        }
      }
    }
  } else if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(MIGRATION_STORAGE_KEY, 'true');
    } catch {}
  }

  return {
    products: migratedProducts,
    migratedCount,
  };
}
