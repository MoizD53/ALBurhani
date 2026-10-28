import { OrderBill, TransactionType } from '../types';
import { isDemoOrTestOrder, isOrderDeleted } from './orders';
import { 
  getKolkataDateString, 
  extractOrderTimestamp, 
  getOrderDue, 
  getOrderCashReceived,
  isOrderInDateRange 
} from './utils';

/**
 * Precision helper to prevent floating point drift in currency math.
 */
export function roundPaise(amount: number): number {
  return Math.round((Number(amount) || 0) * 100) / 100;
}

/**
 * Determines if an order is eligible for sales reporting.
 * Excludes demo orders, mock invoices, and deleted/voided tombstones.
 */
export function isEligibleOrder(order: Partial<OrderBill> | null | undefined): order is OrderBill {
  if (!order || !order.id) return false;
  if (isDemoOrTestOrder(order)) return false;
  if (isOrderDeleted(order.id, order.billNumber)) return false;
  return true;
}

/**
 * Deduplicates orders by stable transaction ID (never relying solely on bill numbers).
 */
export function deduplicateOrders(orders: OrderBill[]): OrderBill[] {
  const seen = new Set<string>();
  const deduplicated: OrderBill[] = [];

  for (const o of orders) {
    if (!o || !o.id) continue;
    const cleanId = o.id.trim();
    if (!seen.has(cleanId)) {
      seen.add(cleanId);
      deduplicated.push(o);
    }
  }

  return deduplicated;
}

/**
 * Classifies if an order is a Retail No-Bill Sale (0% GST memo).
 */
export function isNoBillSale(order: OrderBill): boolean {
  return order.transactionType === 'NO_BILL';
}

/**
 * Classifies if an order is a Customer Tax Invoice (with GST / Tax Invoice).
 */
export function isCustomerBill(order: OrderBill): boolean {
  return order.transactionType === 'CUSTOMER_BILL' || !order.transactionType;
}

/**
 * Standardized Sales Metric Bucket
 */
export interface SalesMetrics {
  count: number;
  grandTotal: number;
  subtotal: number;
  gstAmount: number;
  discountAmount: number;
  cashTotal: number;
  upiTotal: number;
  cardTotal: number;
  creditTotal: number;
  dueAmount: number;
  itemsCount: number;
  uniqueCustomersCount: number;
}

/**
 * Aggregates a slice of orders into standard SalesMetrics.
 */
export function computeSalesMetrics(orders: OrderBill[]): SalesMetrics {
  const cleanOrders = deduplicateOrders(orders.filter(isEligibleOrder));

  let grandTotal = 0;
  let subtotal = 0;
  let gstAmount = 0;
  let discountAmount = 0;
  let cashTotal = 0;
  let upiTotal = 0;
  let cardTotal = 0;
  let creditTotal = 0;
  let dueAmount = 0;
  let itemsCount = 0;
  const uniqueCustomers = new Set<string>();

  for (const o of cleanOrders) {
    const gTotal = Number(o.grandTotal) || 0;
    grandTotal += gTotal;
    subtotal += Number(o.subtotal) || 0;
    gstAmount += Number(o.gstAmount) || 0;
    discountAmount += Number(o.discountAmount) || 0;
    dueAmount += getOrderDue(o);

    // Payment methods
    cashTotal += getOrderCashReceived(o);
    if (o.paymentMethod === 'UPI') upiTotal += gTotal;
    else if (o.paymentMethod === 'CARD') cardTotal += gTotal;
    else if (o.paymentMethod === 'CREDIT') creditTotal += gTotal;

    // Items count
    if (Array.isArray(o.items)) {
      itemsCount += o.items.reduce((sum, it) => sum + (Number(it.quantity) || 1), 0);
    }

    // Unique customers
    if (o.customerPhone && o.customerPhone.trim()) {
      uniqueCustomers.add(o.customerPhone.trim());
    } else if (o.customerName && o.customerName.trim()) {
      uniqueCustomers.add(o.customerName.trim().toLowerCase());
    } else {
      uniqueCustomers.add(`walkin-${o.id}`);
    }
  }

  return {
    count: cleanOrders.length,
    grandTotal: roundPaise(grandTotal),
    subtotal: roundPaise(subtotal),
    gstAmount: roundPaise(gstAmount),
    discountAmount: roundPaise(discountAmount),
    cashTotal: roundPaise(cashTotal),
    upiTotal: roundPaise(upiTotal),
    cardTotal: roundPaise(cardTotal),
    creditTotal: roundPaise(creditTotal),
    dueAmount: roundPaise(dueAmount),
    itemsCount,
    uniqueCustomersCount: uniqueCustomers.size,
  };
}

/**
 * Reconciliation Guard Result
 */
export interface ReconciliationCheckResult {
  isReconciled: boolean;
  countDifference: number;
  amountDifference: number;
  discrepancies: string[];
}

/**
 * Verifies that the mathematical contract holds:
 * Combined Sales = No-Bill Sales + Customer Bills
 */
export function validateSalesReconciliation(
  combined: SalesMetrics,
  noBill: SalesMetrics,
  customerBills: SalesMetrics
): ReconciliationCheckResult {
  const expectedCount = noBill.count + customerBills.count;
  const countDiff = combined.count - expectedCount;

  const expectedAmount = roundPaise(noBill.grandTotal + customerBills.grandTotal);
  const amountDiff = roundPaise(combined.grandTotal - expectedAmount);

  const discrepancies: string[] = [];

  if (countDiff !== 0) {
    discrepancies.push(
      `Count mismatch: Combined (${combined.count}) != No-Bill (${noBill.count}) + Customer Bills (${customerBills.count}), diff = ${countDiff}`
    );
  }

  if (Math.abs(amountDiff) >= 0.01) {
    discrepancies.push(
      `Amount mismatch: Combined (₹${combined.grandTotal}) != No-Bill (₹${noBill.grandTotal}) + Customer Bills (₹${customerBills.grandTotal}), diff = ₹${amountDiff}`
    );
  }

  return {
    isReconciled: discrepancies.length === 0,
    countDifference: countDiff,
    amountDifference: amountDiff,
    discrepancies,
  };
}

/**
 * Master Sales Report Output
 */
export interface MasterSalesReport {
  // 1. All-time Lifetime Scopes
  combinedLifetime: SalesMetrics;
  noBillLifetime: SalesMetrics;
  customerBillsLifetime: SalesMetrics;

  // 2. Today's Business Date Scopes (Asia/Kolkata)
  todayCombined: SalesMetrics;
  todayNoBill: SalesMetrics;
  todayCustomerBills: SalesMetrics;

  // 3. Optional Filtered Range Scopes (e.g. 7days, month)
  filteredCombined: SalesMetrics;
  filteredNoBill: SalesMetrics;
  filteredCustomerBills: SalesMetrics;

  // 4. Active Business Date
  todayDateString: string;

  // 5. Reconciliation Contract Status
  reconciliation: ReconciliationCheckResult;
}

/**
 * Unified Sales Reporting Contract generator.
 * Single source of truth for Overview Dashboard, No-Bill Sales View, Customer Bills View, and Reports.
 */
export function generateMasterSalesReport(
  orders: OrderBill[],
  dateFilter: 'today' | '7days' | 'month' | 'all' = 'all',
  targetBusinessDate?: string
): MasterSalesReport {
  // 1. Clean and deduplicate all eligible orders
  const allEligible = deduplicateOrders(orders.filter(isEligibleOrder));

  // 2. Split by transaction type
  const allNoBill = allEligible.filter(isNoBillSale);
  const allCustomerBills = allEligible.filter(isCustomerBill);

  // 3. Compute Lifetime Metrics
  const combinedLifetime = computeSalesMetrics(allEligible);
  const noBillLifetime = computeSalesMetrics(allNoBill);
  const customerBillsLifetime = computeSalesMetrics(allCustomerBills);

  // 4. Resolve Today's Business Date in Asia/Kolkata
  const todayDateString = targetBusinessDate || getKolkataDateString();

  const isOrderForBusinessDate = (o: OrderBill) => {
    if (o.businessDate) {
      return o.businessDate === todayDateString;
    }
    const ts = extractOrderTimestamp(o);
    if (ts === null) return true; // Fail-safe inclusion
    return getKolkataDateString(ts) === todayDateString;
  };

  const todayEligible = allEligible.filter(isOrderForBusinessDate);
  const todayNoBill = todayEligible.filter(isNoBillSale);
  const todayCustomerBills = todayEligible.filter(isCustomerBill);

  const todayCombinedMetrics = computeSalesMetrics(todayEligible);
  const todayNoBillMetrics = computeSalesMetrics(todayNoBill);
  const todayCustomerBillsMetrics = computeSalesMetrics(todayCustomerBills);

  // 5. Compute Filtered Range Metrics
  const isOrderInFilter = (o: OrderBill) => isOrderInDateRange(o, dateFilter);

  const filteredEligible = dateFilter === 'all' 
    ? allEligible 
    : allEligible.filter(isOrderInFilter);

  const filteredNoBillList = filteredEligible.filter(isNoBillSale);
  const filteredCustomerBillsList = filteredEligible.filter(isCustomerBill);

  const filteredCombinedMetrics = computeSalesMetrics(filteredEligible);
  const filteredNoBillMetrics = computeSalesMetrics(filteredNoBillList);
  const filteredCustomerBillsMetrics = computeSalesMetrics(filteredCustomerBillsList);

  // 6. Enforce Mathematical Reconciliation Contract
  const reconciliation = validateSalesReconciliation(
    combinedLifetime,
    noBillLifetime,
    customerBillsLifetime
  );

  return {
    combinedLifetime,
    noBillLifetime,
    customerBillsLifetime,
    todayCombined: todayCombinedMetrics,
    todayNoBill: todayNoBillMetrics,
    todayCustomerBills: todayCustomerBillsMetrics,
    filteredCombined: filteredCombinedMetrics,
    filteredNoBill: filteredNoBillMetrics,
    filteredCustomerBills: filteredCustomerBillsMetrics,
    todayDateString,
    reconciliation,
  };
}
