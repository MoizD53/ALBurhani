export type ProductCategory = 
  | 'Sweets' 
  | 'Namkeen & Farsan' 
  | 'Dry Fruits' 
  | 'Snacks & Khakhra' 
  | 'Festive Gift Hampers';

export type SellingUnit = 'KG' | 'PCS' | 'Box' | 'Pouch' | 'Jar' | 'Tin' | 'Pack';

export interface Product {
  id: string;
  sku: string; // Product Code / SKU (e.g. 'SKU-001', '0042', preserves leading zeroes)
  barcode: string; // Barcode string (preserves leading zeroes)
  name: string;
  category: ProductCategory;
  unit: SellingUnit | string; // 'KG' | 'PCS' etc.
  priceBasis?: string; // '₹/kg' or '₹/pc'
  netWeight?: string;
  costPrice: number;
  sellingPrice: number; // Price per KG or price per piece
  stock: number; // in KG (decimals allowed) or pieces (integer)
  minStock: number;
  shelfLifeDays?: number;
  batchNo?: string;
  mfgDate?: string;
  expiryDate?: string;
  mrp?: number;
  taxRate?: number; // e.g. 5 for 5% GST
  isActive?: boolean;
  priceTiers?: { minQuantity: number; price: number }[]; // Quantity-based pricing tiers
}

export interface CartItem {
  product: Product;
  quantity: number; // in KG (e.g. 0.25) or in Pieces (e.g. 5)
  weightInGrams?: number; // e.g. 250, 375, 500, 1000
  unit: string; // 'KG' or 'PCS'
  unitPrice: number; // selling price basis
  lineTotal: number; // paise-safe line total in INR
  discountPercent: number;
  formattedQuantity: string; // '250 g', '1.250 kg', '5 pcs'
  formattedRate: string; // '₹800/kg', '₹20/pc'
}

export type PaymentMethod = 'CASH' | 'UPI' | 'CARD' | 'SPLIT';
export type TransactionType = 'CUSTOMER_BILL' | 'NO_BILL';

export interface OrderBill {
  id: string;
  billNumber: string;
  transactionType: TransactionType;
  items: CartItem[];
  subtotal: number;
  discountAmount: number;
  gstAmount: number;
  grandTotal: number;
  paymentMethod: PaymentMethod;
  amountReceived: number;
  changeGiven: number;
  customerName?: string;
  customerPhone?: string;
  cashierName: string;
  createdAt: string;
  timestamp?: number;
  // Bill Modification & Revision Audit Trail
  isRevised?: boolean;
  originalGrandTotal?: number;
  additionalAmountPaid?: number;
  originalPaymentMethod?: PaymentMethod;
  additionalPaymentMethod?: PaymentMethod;
  revisedAt?: string;
  revisedTimestamp?: number;
  revisionCount?: number;
}

export interface CompleteSaleResult {
  success: boolean;
  error?: string;
  order?: OrderBill;
}

export interface ExpenseItem {
  id: string;
  title: string;
  category: string;
  amount: number;
  date: string;
  paymentMode: 'Cash' | 'UPI' | 'Bank Transfer' | 'Card';
  paidTo?: string;
  notes?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  role: 'Owner' | 'Cashier';
  counter: string;
}

export interface StoreSummary {
  todaySales: number;
  todayBilledSales: number;
  todayNoBillSales: number;
  todayOrders: number;
  todayExpenses: number;
  cashCollected: number;
  upiCollected: number;
  cardCollected: number;
  lowStockCount: number;
  totalProductsCount: number;
  estimatedProfit: number;
}
