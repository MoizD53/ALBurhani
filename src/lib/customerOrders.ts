import { CustomerOrder, CustomerOrderItem, CustomerOrderStatus } from '../types';
import { getKolkataDateString } from './utils';

export const CUSTOMER_ORDERS_STORAGE_KEY = 'albhurani_customer_orders';

export const ORDER_STATUS_CONFIG: Record<CustomerOrderStatus, {
  label: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  dotColor: string;
  badgeClass: string;
}> = {
  'Pending': {
    label: 'Pending',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-800',
    badgeBorder: 'border-amber-300',
    dotColor: 'bg-amber-500',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-300',
  },
  'Confirmed': {
    label: 'Confirmed',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-800',
    badgeBorder: 'border-blue-300',
    dotColor: 'bg-blue-500',
    badgeClass: 'bg-blue-50 text-blue-800 border-blue-300',
  },
  'Preparing': {
    label: 'Preparing',
    badgeBg: 'bg-purple-50',
    badgeText: 'text-purple-800',
    badgeBorder: 'border-purple-300',
    dotColor: 'bg-purple-500',
    badgeClass: 'bg-purple-50 text-purple-800 border-purple-300',
  },
  'Ready for Delivery': {
    label: 'Ready for Delivery',
    badgeBg: 'bg-indigo-50',
    badgeText: 'text-indigo-800',
    badgeBorder: 'border-indigo-300',
    dotColor: 'bg-indigo-600',
    badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-300',
  },
  'Delivered': {
    label: 'Delivered',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-800',
    badgeBorder: 'border-emerald-300',
    dotColor: 'bg-emerald-500',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  },
  'Cancelled': {
    label: 'Cancelled',
    badgeBg: 'bg-stone-100',
    badgeText: 'text-stone-600',
    badgeBorder: 'border-stone-300',
    dotColor: 'bg-stone-400',
    badgeClass: 'bg-stone-100 text-stone-600 border-stone-300',
  },
};

/**
 * Generates a unique, human-readable order number.
 * Format: ORD-YYYYMMDD-XXX (e.g. ORD-20261022-001)
 */
export function generateOrderNumber(existingOrders: CustomerOrder[] = []): string {
  const todayStr = getKolkataDateString().replace(/-/g, ''); // e.g. 20261022
  const prefix = `ORD-${todayStr}-`;

  const todayOrderNumbers = existingOrders
    .map((o) => o.orderNumber)
    .filter((num) => num && num.startsWith(prefix));

  let maxSeq = 0;
  for (const num of todayOrderNumbers) {
    const seqStr = num.slice(prefix.length);
    const parsed = parseInt(seqStr, 10);
    if (!isNaN(parsed) && parsed > maxSeq) {
      maxSeq = parsed;
    }
  }

  const nextSeq = (maxSeq + 1).toString().padStart(3, '0');
  return `${prefix}${nextSeq}`;
}

/**
 * Checks whether an order is active (not delivered and not cancelled)
 */
export function isOrderActive(orderOrStatus: CustomerOrder | CustomerOrderStatus): boolean {
  const status = typeof orderOrStatus === 'string' ? orderOrStatus : orderOrStatus.status;
  return status !== 'Delivered' && status !== 'Cancelled';
}

/**
 * Categorizes an order's timing status relative to today's date.
 */
export function getOrderTimingStatus(
  orderOrDeliveryDate: CustomerOrder | string,
  todayStr = getKolkataDateString()
): 'due_today' | 'upcoming' | 'overdue' | 'delivered' | 'cancelled' {
  if (typeof orderOrDeliveryDate === 'object') {
    if (orderOrDeliveryDate.status === 'Cancelled') return 'cancelled';
    if (orderOrDeliveryDate.status === 'Delivered') return 'delivered';

    const deliveryDate = orderOrDeliveryDate.deliveryDate ? orderOrDeliveryDate.deliveryDate.split('T')[0] : '';
    if (!deliveryDate) return 'upcoming';

    if (deliveryDate === todayStr) return 'due_today';
    if (deliveryDate < todayStr) return 'overdue';
    return 'upcoming';
  } else {
    const deliveryDate = (orderOrDeliveryDate || '').split('T')[0];
    if (!deliveryDate) return 'upcoming';

    if (deliveryDate === todayStr) return 'due_today';
    if (deliveryDate < todayStr) return 'overdue';
    return 'upcoming';
  }
}

/**
 * Returns formatted string representing the nearest upcoming delivery date (e.g. "24 Oct")
 * Excludes orders due today, overdue, delivered, and cancelled.
 */
export function getNearestUpcomingDeliveryDate(
  orders: CustomerOrder[],
  todayStr = getKolkataDateString()
): string | null {
  const upcomingOrders = orders.filter((o) => {
    if (!isOrderActive(o)) return false;
    const delDate = (o.deliveryDate || '').split('T')[0];
    return delDate > todayStr;
  });

  if (upcomingOrders.length === 0) return null;

  // Sort by delivery date ascending
  upcomingOrders.sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate));
  const nearest = upcomingOrders[0].deliveryDate.split('T')[0];

  try {
    const [y, m, d] = nearest.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  } catch {
    return nearest;
  }
}

/**
 * Recalculates line subtotals, grand total, and balance due safely.
 */
export function calculateOrderAmounts(
  items: CustomerOrderItem[],
  discountAmount = 0,
  gstAmount = 0,
  advancePaid = 0
): {
  subtotal: number;
  discountAmount: number;
  gstAmount: number;
  totalAmount: number;
  advancePaid: number;
  balanceDue: number;
  validatedItems: CustomerOrderItem[];
} {
  const validatedItems = items.map((item) => {
    const qty = Math.max(0, Number(item.quantity) || 0);
    const price = Math.max(0, Number(item.unitPrice) || 0);
    const subtotal = Math.round(qty * price * 100) / 100;
    return {
      ...item,
      quantity: qty,
      unitPrice: price,
      subtotal,
    };
  });

  const subtotal = validatedItems.reduce((acc, it) => acc + it.subtotal, 0);
  const cleanDiscount = Math.max(0, Math.min(subtotal, Number(discountAmount) || 0));
  const cleanGst = Math.max(0, Number(gstAmount) || 0);
  const totalAmount = Math.max(0, Math.round((subtotal - cleanDiscount + cleanGst) * 100) / 100);
  const cleanAdvance = Math.max(0, Number(advancePaid) || 0);
  const balanceDue = Math.max(0, Math.round((totalAmount - cleanAdvance) * 100) / 100);

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discountAmount: cleanDiscount,
    gstAmount: cleanGst,
    totalAmount,
    advancePaid: cleanAdvance,
    balanceDue,
    validatedItems,
  };
}

/**
 * Formats order items into a concise summary line for tables and cards.
 */
export function formatOrderItemsSummary(items: CustomerOrderItem[] = []): string {
  if (!items || items.length === 0) return 'No items';
  const first = `${items[0].productName} (${items[0].quantity} ${items[0].unit})`;
  if (items.length === 1) return first;
  return `${first} +${items.length - 1} more`;
}

/**
 * Generates an order confirmation message suitable for WhatsApp wa.me links.
 */
export function generateWhatsAppOrderMessage(
  order: CustomerOrder,
  shopName = 'AL-BURHANI SWEETS & DRY ITEMS'
): string {
  const itemsList = order.items
    .map((item, idx) => `${idx + 1}. ${item.productName} — ${item.quantity} ${item.unit} @ Rs.${item.unitPrice} = Rs.${item.subtotal}`)
    .join('\n');

  const deliveryInfo = order.deliveryTime 
    ? `${order.deliveryDate} (${order.deliveryTime})` 
    : order.deliveryDate;

  return `*${shopName}*
*Order Confirmation: ${order.orderNumber}*

Dear ${order.customerName},
Thank you for placing your order with us!

*Order Items:*
${itemsList}

*Subtotal:* Rs. ${order.subtotal.toFixed(2)}
${order.discountAmount > 0 ? `*Discount:* -Rs. ${order.discountAmount.toFixed(2)}\n` : ''}*Total Amount:* Rs. ${order.totalAmount.toFixed(2)}
*Advance Paid:* Rs. ${order.advancePaid.toFixed(2)}
*Balance Due:* Rs. ${order.balanceDue.toFixed(2)}

*Delivery Date:* ${deliveryInfo}
${order.deliveryAddress ? `*Delivery Address:* ${order.deliveryAddress}\n` : ''}${order.notes ? `*Special Notes:* ${order.notes}\n` : ''}
*Status:* ${order.status}

We will keep you updated as your order is prepared and ready for delivery.
For any queries, please call us or reply to this message.`;
}

/**
 * Storage helpers for local caching of customer orders
 */
export function getSavedCustomerOrders(): CustomerOrder[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CUSTOMER_ORDERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomerOrdersLocally(orders: CustomerOrder[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(CUSTOMER_ORDERS_STORAGE_KEY, JSON.stringify(orders));
  } catch (err) {
    console.warn('Failed to save customer orders to localStorage:', err);
  }
}
