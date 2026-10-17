export type ProductCategory = 
  | 'Sweets' 
  | 'Namkeen & Farsan' 
  | 'Dry Fruits' 
  | 'Snacks & Khakhra' 
  | 'Festive Gift Hampers';

export interface Product {
  id: string;
  barcode: string;
  name: string;
  category: ProductCategory;
  unit: string;
  netWeight: string;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  minStock: number;
  shelfLifeDays: number;
  batchNo: string;
  mfgDate: string;
  expiryDate: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  discountPercent: number;
}

export type PaymentMethod = 'CASH' | 'UPI' | 'CARD' | 'SPLIT';

export interface OrderBill {
  id: string;
  billNumber: string;
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
}

export interface StoreSummary {
  todaySales: number;
  todayOrders: number;
  cashCollected: number;
  upiCollected: number;
  cardCollected: number;
  lowStockCount: number;
  expiringSoonCount: number;
}
