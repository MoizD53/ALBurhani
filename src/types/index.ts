export type ProductCategory = string;

export type SellingUnit = 'KG' | 'PCS' | 'Box' | 'Pouch' | 'Jar' | 'Tin' | 'Pack';

export interface Product {
  id: string;
  sku: string; // Product Code / SKU (e.g. 'SKU-001', '0042', preserves leading zeroes)
  barcode: string; // Barcode string (preserves leading zeroes)
  oldBarcode?: string; // Previous barcode before edit (for robust serverless lookup)
  name: string;
  category: ProductCategory;
  unit: SellingUnit | string; // 'KG' | 'PCS' etc.
  priceBasis?: string; // 'Rs./kg' or 'Rs./pc'
  netWeight?: string;
  costPrice: number;
  sellingPrice: number; // Price per KG or price per piece
  stock?: number; // Active branch's stock (for current terminal context)
  branchStock?: {
    godi_road?: number;
    mg_road?: number;
    [branch: string]: number | undefined;
  };
  minStock?: number; // legacy optional
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
  formattedRate: string; // 'Rs. 800/kg', 'Rs. 20/pc'
}

export type PaymentMethod = 'CASH' | 'UPI' | 'CARD' | 'SPLIT' | 'CREDIT';
export type TransactionType = 'CUSTOMER_BILL' | 'NO_BILL';

export interface OrderBill {
  id: string;
  billNumber: string;
  dailyBillNumber?: number;
  businessDate?: string;
  transactionType: TransactionType;
  items: CartItem[];
  subtotal: number;
  discountAmount: number;
  gstAmount: number;
  grandTotal: number;
  paymentMethod: PaymentMethod;
  amountReceived: number;
  changeGiven: number;
  dueAmount?: number;
  settledAt?: string;
  isSettled?: boolean;
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
  branch?: string; // 'godi_road' | 'mg_road'
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
  branch?: string; // 'godi_road' | 'mg_road'
}

export interface UserProfile {
  id: string;
  name: string;
  role: 'Owner' | 'Cashier';
  counter: string;
  branchId?: 'godi_road' | 'mg_road';
  branchName?: string;
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
  totalProductsCount: number;
  estimatedProfit: number;
}

// ---------------------------------------------------------------------------
// Customer Booking & Scheduled Delivery Orders
// ---------------------------------------------------------------------------

export type CustomerOrderStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Preparing'
  | 'Ready for Delivery'
  | 'Delivered'
  | 'Cancelled';

export interface CustomerOrderItem {
  productId: string;
  productName: string;
  sku?: string;
  barcode?: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  notes?: string;
}

export interface CustomerOrder {
  id: string;
  orderNumber: string; // e.g. "ORD-20261022-001"
  customerName: string;
  customerPhone: string;
  items: CustomerOrderItem[];
  subtotal: number;
  discountAmount: number;
  gstAmount: number;
  totalAmount: number;
  advancePaid: number;
  balanceDue: number;
  orderDate: string; // YYYY-MM-DD
  deliveryDate: string; // YYYY-MM-DD (Required)
  deliveryTime?: string; // Optional time or time slot (e.g. "Morning", "4:00 PM")
  deliveryAddress?: string;
  status: CustomerOrderStatus;
  paymentMethod?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  branch?: string; // 'godi_road' | 'mg_road'
}

// ---------------------------------------------------------------------------
// Product Category Master
// ---------------------------------------------------------------------------

export interface CategoryItem {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  displayOrder?: number;
  productCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

// ---------------------------------------------------------------------------
// Purchase Bills & Vendor Types
// ---------------------------------------------------------------------------

export interface PurchaseItem {
  productId?: string; // Optional link to existing catalog product
  productName: string;
  quantity: number;
  unit: string; // 'PCS' | 'Box' | 'Packet' | 'KG' | 'Litre' etc.
  unitPrice: number;
  lineTotal: number;
}

export interface VendorPayment {
  id: string;
  purchaseBillId: string;
  vendorId?: string;
  paymentDate: string; // YYYY-MM-DD
  amount: number;
  paymentMode: 'Cash' | 'UPI' | 'Bank Transfer' | 'Other' | string;
  notes?: string;
  createdAt?: string;
}

export interface PurchaseBill {
  id: string;
  purchaseNumber: string; // e.g. 'PUR-0001'
  dailyBillNumber: number; // 1, 2, 3... sequential daily counter in Asia/Kolkata
  businessDate: string; // 'YYYY-MM-DD'
  vendorId?: string;
  vendorName: string;
  vendorContact?: string;
  vendorInvoiceNumber?: string;
  purchaseDate: string; // YYYY-MM-DD
  items: PurchaseItem[];
  subtotal: number;
  discount: number;
  additionalCharges: number;
  grandTotal: number;
  amountPaid: number;
  balanceDue: number;
  paymentStatus: 'Paid' | 'Partially Paid' | 'Unpaid';
  paymentMode: 'Cash' | 'UPI' | 'Bank Transfer' | 'Other' | string;
  notes?: string;
  status: 'Active' | 'Cancelled';
  createdAt?: string;
  updatedAt?: string;
  payments?: VendorPayment[];
  branch?: string; // 'godi_road' | 'mg_road'
}

export interface Vendor {
  id: string;
  name: string;
  contactNumber?: string;
  address?: string;
  notes?: string;
  billsCount?: number;
  totalPurchases?: number;
  totalPaid?: number;
  balanceDue?: number;
}
