import { Product, CartItem, TransactionType } from '../types';

/**
 * Checks if product is weight-based (sold by KG/G) or count-based (sold by PCS/packs)
 */
export function isWeightBasedProduct(product: { unit?: string } | null | undefined): boolean {
  if (!product || !product.unit) return false;
  const u = product.unit.trim().toUpperCase();
  return u === 'KG' || u === 'G' || u === 'KILOGRAM' || u === 'KILOGRAMS' || u === 'GRAM' || u === 'GRAMS';
}

/**
 * Returns the price basis label: 'Rs./kg' or 'Rs./pc'
 */
export function getPriceBasis(product: { unit?: string } | null | undefined): string {
  return isWeightBasedProduct(product) ? 'Rs./kg' : 'Rs./pc';
}

/**
 * Formats price with basis label, e.g. 'Rs. 800/kg' or 'Rs. 20/pc'
 */
export function formatPriceWithBasis(price: number, unit?: string): string {
  const isWeight = unit ? (unit.toUpperCase() === 'KG' || unit.toUpperCase() === 'G') : false;
  return isWeight ? `Rs. ${price}/kg` : `Rs. ${price}/pc`;
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
 * - Rs. 800/kg × 250g = Rs. 200.00
 * - Rs. 800/kg × 375g = Rs. 300.00
 * - Rs. 20/pc × 5 pcs = Rs. 100.00
 */
/**
 * Resolves the effective unit price considering quantity-based pricing tiers.
 * If priceTiers are configured on the product, matches the highest qualifying minQuantity tier.
 * Otherwise returns the base product.sellingPrice.
 */
export function getEffectiveUnitPrice(
  product: Product,
  quantityOrKg: number,
  grams?: number
): number {
  if (!product.priceTiers || product.priceTiers.length === 0) {
    return product.sellingPrice;
  }

  const isWeight = isWeightBasedProduct(product);
  const effectiveQty = isWeight && grams !== undefined ? grams / 1000 : quantityOrKg;

  // Sort tiers descending by minQuantity
  const sortedTiers = [...product.priceTiers].sort((a, b) => b.minQuantity - a.minQuantity);
  const matchingTier = sortedTiers.find((tier) => effectiveQty >= tier.minQuantity);

  return matchingTier ? matchingTier.price : product.sellingPrice;
}

/**
 * Calculates line total accurately using integer paise to eliminate floating-point errors.
 * Respects configured quantity-based pricing tiers automatically.
 * Examples:
 * - Rs. 800/kg × 250g = Rs. 200.00
 * - Rs. 800/kg × 375g = Rs. 300.00
 * - Rs. 20/pc × 5 pcs = Rs. 100.00
 */
export function calculateLineTotal(
  product: Product,
  input: { quantity?: number; grams?: number }
): {
  quantity: number;
  grams?: number;
  unitPrice: number;
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
    const effectiveUnitPrice = getEffectiveUnitPrice(product, quantityInKg, grams);
    // (grams / 1000) * price * 100 = (grams * price) / 10 paise
    const lineTotalPaise = Math.round((grams * effectiveUnitPrice) / 10);
    const lineTotal = lineTotalPaise / 100;

    return {
      quantity: quantityInKg,
      grams,
      unitPrice: effectiveUnitPrice,
      lineTotal,
      lineTotalPaise,
    };
  }

  // Piece-based calculation
  const quantity = Math.max(0, Math.floor(input.quantity || 0));
  const effectiveUnitPrice = getEffectiveUnitPrice(product, quantity);
  const lineTotalPaise = Math.round(quantity * effectiveUnitPrice * 100);
  const lineTotal = lineTotalPaise / 100;

  return {
    quantity,
    grams: undefined,
    unitPrice: effectiveUnitPrice,
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

  return {
    isValid: true,
    quantity: quantityInput,
  };
}

/**
 * Parses user input for product quantities like:
 * - "300", "300g", "300gm", "300 gm", "300 grams" -> grams: 300, quantity: 0.3
 * - "0.3", "0.3kg", "0.3 kg" -> grams: 300, quantity: 0.3
 * - "1.5kg", "1.5" -> grams: 1500, quantity: 1.5
 * - "5", "5 pcs", "5pc" -> quantity: 5
 */
export function parseQuantityInput(
  rawInput: string,
  isWeight: boolean
): {
  isValid: boolean;
  quantity: number;
  grams?: number;
  error?: string;
} {
  const trimmed = rawInput.trim().toLowerCase();
  if (!trimmed) {
    return { isValid: false, quantity: 0, error: 'Quantity cannot be empty' };
  }

  if (isWeight) {
    const isKgExplicit = trimmed.includes('kg') || trimmed.includes('kilo');
    const isGramsExplicit = (trimmed.includes('g') || trimmed.includes('gm')) && !isKgExplicit;

    const cleanNumStr = trimmed
      .replace(/kg|kilo|kilograms?|grams?|gms?|gm|g/g, '')
      .trim();

    const num = parseFloat(cleanNumStr);
    if (isNaN(num) || num <= 0) {
      return { isValid: false, quantity: 0, error: 'Please enter a valid weight (e.g. 300g or 0.5kg)' };
    }

    let grams = 0;
    if (isKgExplicit) {
      grams = Math.round(num * 1000);
    } else if (isGramsExplicit) {
      grams = Math.round(num);
    } else {
      // Numbers < 10 with decimal points, or values like 0.25, 0.5, 1.5 -> KG
      // Whole numbers >= 10 like 50, 100, 250, 300, 500 -> Grams
      // Whole numbers 1..9 without unit in a mithai/farsan shop: 1 = 1kg, 2 = 2kg
      if (num < 10 && (num % 1 !== 0 || cleanNumStr.includes('.'))) {
        grams = Math.round(num * 1000);
      } else if (num >= 10) {
        grams = Math.round(num);
      } else {
        grams = Math.round(num * 1000);
      }
    }

    if (grams <= 0) {
      return { isValid: false, quantity: 0, error: 'Weight must be greater than 0 grams' };
    }

    return {
      isValid: true,
      quantity: grams / 1000,
      grams,
    };
  } else {
    const cleanNumStr = trimmed
      .replace(/pcs|pc|pieces?|packs?|nos?|no/g, '')
      .trim();
    const num = parseInt(cleanNumStr, 10);
    if (isNaN(num) || num <= 0) {
      return { isValid: false, quantity: 0, error: 'Please enter a valid piece count' };
    }
    return {
      isValid: true,
      quantity: num,
    };
  }
}

/**
 * Calculates standard EAN-13 check digit for 12 digits
 */
export function calculateEan13CheckDigit(digits12: string): number {
  if (digits12.length !== 12) return 0;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(digits12[i], 10);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const remainder = sum % 10;
  return remainder === 0 ? 0 : 10 - remainder;
}

/**
 * Generates a valid 13-digit EAN-13 barcode with Indian country prefix (890)
 * and correct checksum, readable by any smartphone, tablet, or handheld scanner.
 */
export function generateEan13Barcode(): string {
  const randomNine = Math.floor(100000000 + Math.random() * 900000000).toString();
  const base12 = `890${randomNine}`;
  const checkDigit = calculateEan13CheckDigit(base12);
  return `${base12}${checkDigit}`;
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
 * Restores stock safely when a bill is deleted or cancelled:
 * - for weight products: rounds to 3 decimal places (e.g. 4.25 kg + 0.25 kg = 4.5 kg)
 * - for piece products: integer addition
 */
export function restoreStock(currentStock: number, restoredQuantity: number, isWeight: boolean): number {
  if (isWeight) {
    return Math.round((currentStock + restoredQuantity) * 1000) / 1000;
  }
  return Math.round(currentStock + restoredQuantity);
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

  // 1. Exact barcode match (string comparison, case-insensitive, preserves leading zeros strictly)
  const exactBarcode = products.filter(
    (p) => p.barcode && p.barcode.toLowerCase() === code.toLowerCase()
  );
  if (exactBarcode.length > 0) return exactBarcode;

  // 2. Exact SKU / Product code match (string comparison, preserves leading zeros strictly)
  const exactSku = products.filter(
    (p) => p.sku && p.sku.toLowerCase() === code.toLowerCase()
  );
  if (exactSku.length > 0) return exactSku;

  // 3. Name search fallback (case-insensitive substring) - only if input is not a pure numeric barcode
  const isNumericBarcode = /^[0-9]{4,}$/.test(code);
  if (!isNumericBarcode) {
    const nameMatches = products.filter((p) =>
      p.name.toLowerCase().includes(code.toLowerCase())
    );
    return nameMatches;
  }

  return [];
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
  const { lineTotal, unitPrice } = calculateLineTotal(product, {
    quantity,
    grams: weightInGrams,
  });

  const formattedQty = formatQuantity(quantity, isWeight ? 'KG' : 'PCS', weightInGrams);
  const formattedRate = formatPriceWithBasis(unitPrice, isWeight ? 'KG' : 'PCS');

  return {
    product,
    quantity,
    weightInGrams: isWeight ? (weightInGrams ?? Math.round(quantity * 1000)) : undefined,
    unit: isWeight ? 'KG' : 'PCS',
    unitPrice,
    lineTotal,
    discountPercent,
    formattedQuantity: formattedQty,
    formattedRate,
  };
}

export interface OrderCalculation {
  subtotal: number;
  discountAmount: number;
  netAmount: number;
  taxableAmount: number;
  gstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  grandTotal: number;
}

/**
 * Shared money/tax calculation for AL-BURHANI POS.
 * 
 * Critical Requirement: GST-Inclusive Pricing.
 * For "With GST" (CUSTOMER_BILL):
 * - All catalog product prices are GST-inclusive.
 * - Customer's total for a Rs. 60 product remains Rs. 60.00, not Rs. 63.00.
 * - Taxable Value = Net Amount / 1.05 = Rs. 57.14 (approx).
 * - Included GST = Net Amount - Taxable Value = Rs. 2.86 (approx).
 * - CGST (2.5%) = Rs. 1.43, SGST (2.5%) = Rs. 1.43.
 * - Grand Total = Rs. 60.00.
 * 
 * For "Without GST" (NO_BILL):
 * - Customer pays catalog price without GST addition or calculation.
 * - gstAmount = 0, grandTotal = netAmount.
 */
export function calculateOrderTotals(
  items: CartItem[],
  discountPercent = 0,
  transactionType: TransactionType = 'CUSTOMER_BILL',
  gstRate = 0.05
): OrderCalculation {
  const subtotal = Math.round(items.reduce((sum, item) => sum + item.lineTotal, 0) * 100) / 100;
  const discountAmount = Math.round(((subtotal * discountPercent) / 100) * 100) / 100;
  const netAmount = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);

  if (transactionType === 'CUSTOMER_BILL') {
    // GST-inclusive calculation:
    const taxableAmount = Math.round((netAmount / (1 + gstRate)) * 100) / 100;
    const gstAmount = Math.round((netAmount - taxableAmount) * 100) / 100;
    const cgstAmount = Math.round((gstAmount / 2) * 100) / 100;
    const sgstAmount = Math.round((gstAmount - cgstAmount) * 100) / 100;
    const grandTotal = Math.round(netAmount);

    return {
      subtotal,
      discountAmount,
      netAmount,
      taxableAmount,
      gstAmount,
      cgstAmount,
      sgstAmount,
      grandTotal,
    };
  }

  // Without GST (NO_BILL)
  const grandTotal = Math.round(netAmount);
  return {
    subtotal,
    discountAmount,
    netAmount,
    taxableAmount: netAmount,
    gstAmount: 0,
    cgstAmount: 0,
    sgstAmount: 0,
    grandTotal,
  };
}
