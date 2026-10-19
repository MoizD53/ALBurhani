import { Product, CartItem } from '../types';

/**
 * Checks if product is weight-based (sold by KG/G) or count-based (sold by PCS/packs)
 */
export function isWeightBasedProduct(product: { unit?: string } | null | undefined): boolean {
  if (!product || !product.unit) return false;
  const u = product.unit.trim().toUpperCase();
  return u === 'KG' || u === 'G' || u === 'KILOGRAM' || u === 'KILOGRAMS' || u === 'GRAM' || u === 'GRAMS';
}

/**
 * Returns the price basis label: '₹/kg' or '₹/pc'
 */
export function getPriceBasis(product: { unit?: string } | null | undefined): string {
  return isWeightBasedProduct(product) ? '₹/kg' : '₹/pc';
}

/**
 * Formats price with basis label, e.g. '₹800/kg' or '₹20/pc'
 */
export function formatPriceWithBasis(price: number, unit?: string): string {
  const isWeight = unit ? (unit.toUpperCase() === 'KG' || unit.toUpperCase() === 'G') : false;
  return isWeight ? `₹${price}/kg` : `₹${price}/pc`;
}

/**
 * Formats quantity for display:
 * - 0.25 kg -> '250 g'
 * - 0.375 kg -> '375 g'
 * - 1.25 kg -> '1.250 kg'
 * - 5 pcs -> '5 pcs'
 */
export function formatQuantity(quantity: number, unit?: string, weightInGrams?: number): string {
  const isWeight = unit ? (unit.toUpperCase() === 'KG' || unit.toUpperCase() === 'G') : false;

  if (isWeight) {
    const grams = weightInGrams !== undefined ? weightInGrams : Math.round(quantity * 1000);
    if (grams < 1000) {
      return `${grams} g`;
    }
    const kg = grams / 1000;
    if (grams % 1000 === 0) {
      return `${kg} kg`;
    }
    return `${kg.toFixed(3).replace(/\.?0+$/, '')} kg`;
  }

  const u = unit ? unit.toLowerCase() : 'pcs';
  return `${quantity} ${u === 'pcs' || u === 'pc' ? 'pcs' : u}`;
}

/**
 * Formats stock for display:
 * - 25.5 kg -> '25.5 kg'
 * - 120 pcs -> '120 pcs'
 */
export function formatStock(stock: number, unit?: string): string {
  const isWeight = unit ? (unit.toUpperCase() === 'KG' || unit.toUpperCase() === 'G') : false;
  if (isWeight) {
    return `${Number(stock.toFixed(3))} kg`;
  }
  return `${Math.round(stock)} pcs`;
}

/**
 * Calculates line total accurately using integer paise to eliminate floating-point errors.
 * Examples:
 * - ₹800/kg × 250g = ₹200.00
 * - ₹800/kg × 375g = ₹300.00
 * - ₹20/pc × 5 pcs = ₹100.00
 */
export function calculateLineTotal(
  product: Product,
  input: { quantity?: number; grams?: number }
): {
  quantity: number;
  grams?: number;
  lineTotal: number;
  lineTotalPaise: number;
} {
  const isWeight = isWeightBasedProduct(product);

  if (isWeight) {
    let grams = 0;
    if (input.grams !== undefined && input.grams > 0) {
      grams = input.grams;
    } else if (input.quantity !== undefined && input.quantity > 0) {
      grams = Math.round(input.quantity * 1000);
    }

    const quantityInKg = grams / 1000;
    // (grams / 1000) * price * 100 = (grams * price) / 10 paise
    const lineTotalPaise = Math.round((grams * product.sellingPrice) / 10);
    const lineTotal = lineTotalPaise / 100;

    return {
      quantity: quantityInKg,
      grams,
      lineTotal,
      lineTotalPaise,
    };
  }

  // Piece-based calculation
  const quantity = Math.max(0, Math.floor(input.quantity || 0));
  const lineTotalPaise = Math.round(quantity * product.sellingPrice * 100);
  const lineTotal = lineTotalPaise / 100;

  return {
    quantity,
    lineTotal,
    lineTotalPaise,
  };
}

/**
 * Validates a proposed quantity against product constraints and current stock.
 */
export function validateQuantity(
  product: Product,
  quantityInput: number,
  unitMode: 'g' | 'kg' | 'pcs',
  existingInCart = 0
): {
  isValid: boolean;
  error?: string;
  quantity: number;
  grams?: number;
} {
  if (isNaN(quantityInput) || quantityInput <= 0) {
    return {
      isValid: false,
      error: 'Please enter a valid positive quantity',
      quantity: 0,
    };
  }

  const isWeight = isWeightBasedProduct(product);

  if (isWeight) {
    const grams = unitMode === 'kg' ? Math.round(quantityInput * 1000) : Math.round(quantityInput);
    if (grams <= 0) {
      return {
        isValid: false,
        error: 'Weight must be greater than 0 grams',
        quantity: 0,
      };
    }

    const kg = grams / 1000;
    const totalNeededKg = kg + existingInCart;

    if (product.stock > 0 && totalNeededKg > product.stock) {
      const remainingAvailable = Math.max(0, product.stock - existingInCart);
      const remainingLabel = formatQuantity(remainingAvailable, 'KG');
      return {
        isValid: false,
        error: `Insufficient stock! Only ${remainingLabel} available${existingInCart > 0 ? ` (${formatQuantity(existingInCart, 'KG')} already in cart)` : ''}.`,
        quantity: kg,
        grams,
      };
    }

    return {
      isValid: true,
      quantity: kg,
      grams,
    };
  }

  // Count/Piece based
  if (!Number.isInteger(quantityInput) || quantityInput <= 0) {
    return {
      isValid: false,
      error: 'Piece quantity must be a whole positive number',
      quantity: 0,
    };
  }

  const totalNeededPcs = quantityInput + existingInCart;
  if (product.stock > 0 && totalNeededPcs > product.stock) {
    const remainingAvailable = Math.max(0, product.stock - existingInCart);
    return {
      isValid: false,
      error: `Insufficient stock! Only ${remainingAvailable} pcs available${existingInCart > 0 ? ` (${existingInCart} pcs already in cart)` : ''}.`,
      quantity: quantityInput,
    };
  }

  return {
    isValid: true,
    quantity: quantityInput,
  };
}

/**
 * Deducts stock safely:
 * - for weight products: rounds to 3 decimal places
 * - for piece products: integer subtraction
 */
export function deductStock(currentStock: number, soldQuantity: number, isWeight: boolean): number {
  if (isWeight) {
    return Math.max(0, Math.round((currentStock - soldQuantity) * 1000) / 1000);
  }
  return Math.max(0, Math.round(currentStock - soldQuantity));
}

/**
 * Searches product catalogue for exact match on:
 * 1. Barcode (preserves leading zeroes)
 * 2. SKU / Product Code (preserves leading zeroes)
 * 3. Case-insensitive fallback
 */
export function lookupProduct(products: Product[], rawInput: string): Product[] {
  const code = rawInput.trim();
  if (!code) return [];

  // 1. Exact barcode match (string comparison, case-insensitive)
  const exactBarcode = products.filter(
    (p) => p.barcode && p.barcode.toLowerCase() === code.toLowerCase()
  );
  if (exactBarcode.length > 0) return exactBarcode;

  // 2. Exact SKU / Product code match
  const exactSku = products.filter(
    (p) => p.sku && p.sku.toLowerCase() === code.toLowerCase()
  );
  if (exactSku.length > 0) return exactSku;

  // 3. Name search fallback (case-insensitive substring)
  const nameMatches = products.filter((p) =>
    p.name.toLowerCase().includes(code.toLowerCase())
  );

  return nameMatches;
}

/**
 * Creates a CartItem from product and quantity input
 */
export function buildCartItem(
  product: Product,
  quantity: number,
  weightInGrams?: number,
  discountPercent = 0
): CartItem {
  const isWeight = isWeightBasedProduct(product);
  const { lineTotal } = calculateLineTotal(product, {
    quantity,
    grams: weightInGrams,
  });

  const formattedQty = formatQuantity(quantity, isWeight ? 'KG' : 'PCS', weightInGrams);
  const formattedRate = formatPriceWithBasis(product.sellingPrice, isWeight ? 'KG' : 'PCS');

  return {
    product,
    quantity,
    weightInGrams: isWeight ? (weightInGrams ?? Math.round(quantity * 1000)) : undefined,
    unit: isWeight ? 'KG' : 'PCS',
    unitPrice: product.sellingPrice,
    lineTotal,
    discountPercent,
    formattedQuantity: formattedQty,
    formattedRate,
  };
}
