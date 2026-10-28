import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { OrderBill, ExpenseItem } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// POS Beep Audio Synthesizer (Pure Web Audio API - Safe fallback)
export function playBeep(type: 'scan' | 'error' | 'success' = 'scan') {
  try {
    if (typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    const audioCtx = new AudioCtx();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'scan') {
      // Crisp 1760Hz POS retail scanner chirp
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
    } else if (type === 'success') {
      // Pleasant double chord chime for checkout
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, audioCtx.currentTime + 0.18);
      gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.25);
    } else {
      // Low buzz for unknown barcode / out of stock
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.2);
    }
  } catch (e) {
    // Audio autoplay policy or device without audio
  }
}

/**
 * Returns date in YYYY-MM-DD format in Asia/Kolkata timezone
 */
export function getKolkataDateString(dateOrTimestamp: number | Date = Date.now()): string {
  try {
    const d = typeof dateOrTimestamp === 'number' ? new Date(dateOrTimestamp) : dateOrTimestamp;
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch {
    const d = typeof dateOrTimestamp === 'number' ? new Date(dateOrTimestamp) : dateOrTimestamp;
    return d.toISOString().split('T')[0];
  }
}

/**
 * Extracts a reliable epoch millisecond timestamp from an order
 */
export function extractOrderTimestamp(order: OrderBill): number | null {
  if (typeof order.timestamp === 'number' && !isNaN(order.timestamp)) {
    return order.timestamp;
  }

  // Extract from sale-${timestamp} or sale-${timestamp}-${random}
  if (order.id && order.id.startsWith('sale-')) {
    const parts = order.id.split('-');
    const parsed = parseInt(parts[1], 10);
    if (!isNaN(parsed) && parsed > 1600000000000) {
      return parsed;
    }
  }

  // Attempt parsing createdAt string (e.g. ISO string or "19 Oct 2026, 02:45 PM")
  if (order.createdAt) {
    const parsed = Date.parse(order.createdAt);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }

  return null;
}

/**
 * Resolves the sequential daily bill number (1, 2, 3... N) for an order,
 * with deterministic fallback to chronological position for that business day.
 */
export function resolveDailyBillNumber(order: OrderBill, allOrders: OrderBill[] = []): number {
  if (typeof order.dailyBillNumber === 'number' && order.dailyBillNumber > 0) {
    return order.dailyBillNumber;
  }

  const orderDate = order.businessDate || getKolkataDateString(extractOrderTimestamp(order) || Date.now());
  const sameDayOrders = allOrders.filter((o) => {
    const oDate = o.businessDate || getKolkataDateString(extractOrderTimestamp(o) || Date.now());
    return oDate === orderDate;
  });

  if (sameDayOrders.length === 0) return 1;

  // Sort same day orders ascending by timestamp / createdAt
  const sorted = [...sameDayOrders].sort((a, b) => {
    const tA = extractOrderTimestamp(a) || 0;
    const tB = extractOrderTimestamp(b) || 0;
    return tA - tB;
  });

  const idx = sorted.findIndex((o) => o.id === order.id || o.billNumber === order.billNumber);
  return idx >= 0 ? idx + 1 : 1;
}

/**
 * Determines whether an order falls within the requested date range:
 * - 'today': calendar day of today in Asia/Kolkata
 * - '7days': last 7 calendar days
 * - 'month': last 30 calendar days
 * - 'all': all orders
 */
export function isOrderInDateRange(
  order: OrderBill,
  range: 'today' | '7days' | 'month' | 'all'
): boolean {
  if (range === 'all') return true;

  const todayKolkata = getKolkataDateString(Date.now());
  if (range === 'today' && order.businessDate) {
    return order.businessDate === todayKolkata;
  }

  const timestamp = extractOrderTimestamp(order);
  // Fail-safe: if date cannot be resolved, include the order so real sales are never lost
  if (timestamp === null) return true;

  if (range === 'today') {
    return getKolkataDateString(timestamp) === todayKolkata;
  }

  const now = Date.now();
  if (range === '7days') {
    return timestamp >= now - 7 * 24 * 60 * 60 * 1000;
  }

  if (range === 'month') {
    return timestamp >= now - 30 * 24 * 60 * 60 * 1000;
  }

  return true;
}

/**
 * Extracts a reliable epoch millisecond timestamp from an expense
 */
export function extractExpenseTimestamp(expense: ExpenseItem): number | null {
  if (typeof (expense as any).timestamp === 'number' && !isNaN((expense as any).timestamp)) {
    return (expense as any).timestamp;
  }

  if (expense.id && expense.id.startsWith('expense-')) {
    const parts = expense.id.split('-');
    const parsed = parseInt(parts[1], 10);
    if (!isNaN(parsed) && parsed > 1600000000000) {
      return parsed;
    }
  }

  if (expense.date) {
    if (expense.date.toLowerCase().startsWith('today')) {
      return Date.now();
    }
    const parsed = Date.parse(expense.date);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }

  return null;
}

/**
 * Determines whether an expense falls within the requested date range
 */
export function isExpenseInDateRange(
  expense: ExpenseItem,
  range: 'today' | '7days' | 'month' | 'all'
): boolean {
  if (range === 'all') return true;

  const timestamp = extractExpenseTimestamp(expense);
  if (timestamp === null) return true;

  if (range === 'today') {
    return getKolkataDateString(timestamp) === getKolkataDateString(Date.now());
  }

  const now = Date.now();
  if (range === '7days') {
    return timestamp >= now - 7 * 24 * 60 * 60 * 1000;
  }

  if (range === 'month') {
    return timestamp >= now - 30 * 24 * 60 * 60 * 1000;
  }

  return true;
}

/**
 * Calculates the exact pending due (udhar) balance for an order
 */
export function getOrderDue(order: OrderBill): number {
  if (order.isSettled) return 0;
  if (typeof order.dueAmount === 'number') {
    return Math.max(0, order.dueAmount);
  }
  if (order.paymentMethod === 'CREDIT') {
    const received = typeof order.amountReceived === 'number' ? order.amountReceived : 0;
    return Math.max(0, order.grandTotal - received);
  }
  if (typeof order.amountReceived === 'number' && order.amountReceived < order.grandTotal) {
    return Math.max(0, order.grandTotal - order.amountReceived);
  }
  return 0;
}

/**
 * Aggregates all due orders and totals
 */
export function calculateDueSummary(orders: OrderBill[]): {
  totalDue: number;
  dueOrdersCount: number;
  dueOrders: OrderBill[];
} {
  const dueOrders = orders.filter((o) => getOrderDue(o) > 0);
  const totalDue = dueOrders.reduce((sum, o) => sum + getOrderDue(o), 0);
  return {
    totalDue,
    dueOrdersCount: dueOrders.length,
    dueOrders,
  };
}

/**
 * Formats a clean customer-facing bill label: "Bill #1", "Bill #2", etc.
 * Never shows internal raw prefixes like "ALB-NB-1234".
 */
export function formatDisplayBillNumber(order: OrderBill, allOrders: OrderBill[] = []): string {
  const num = resolveDailyBillNumber(order, allOrders);

  // If there are collisions for this daily bill number on the same business date and branch,
  // disambiguate with timestamp so cashiers can clearly tell them apart
  if (allOrders.length > 0 && num > 0) {
    const orderDate = order.businessDate || getKolkataDateString(extractOrderTimestamp(order) || Date.now());
    const orderBranch = order.branch || 'godi_road';
    const collisions = allOrders.filter((o) => {
      const oDate = o.businessDate || getKolkataDateString(extractOrderTimestamp(o) || Date.now());
      const oBranch = o.branch || 'godi_road';
      const oNum = resolveDailyBillNumber(o, allOrders);
      return oDate === orderDate && oBranch === orderBranch && oNum === num;
    });

    if (collisions.length > 1) {
      const timeStr = order.createdAt 
        ? (order.createdAt.includes(',') ? order.createdAt.split(',')[1]?.trim() : order.createdAt)
        : '';
      if (timeStr) {
        return `Bill #${num} (${timeStr})`;
      }
    }
  }

  return `Bill #${num}`;
}

/**
 * Completely purges legacy ALB- prefixes ("ALB-NB-", "ALB-INV-", "ALB-")
 * and returns clean "Bill #N" format.
 */
export function cleanBillNumber(billNumber?: string, dailyBillNumber?: number): string {
  if (typeof dailyBillNumber === 'number' && dailyBillNumber > 0) {
    return `Bill #${dailyBillNumber}`;
  }
  if (!billNumber || !billNumber.trim()) return 'Bill #1';
  if (billNumber.startsWith('Bill #')) return billNumber;
  const stripped = billNumber.replace(/^ALB-(NB|INV|SIM)-?/i, '').replace(/^ALB-?/i, '').trim();
  return `Bill #${stripped || '1'}`;
}

/**
 * Universal CSV export helper with UTF-8 BOM encoding for Excel/Google Sheets compatibility.
 */
export function exportToCsv(filename: string, headers: string[], rows: (string | number | undefined | null)[][]): void {
  const escapeCell = (cell: string | number | undefined | null): string => {
    if (cell === null || cell === undefined) return '""';
    const str = String(cell).replace(/"/g, '""');
    return `"${str}"`;
  };

  const csvContent = '\uFEFF' + [
    headers.map(escapeCell).join(','),
    ...rows.map((row) => row.map(escapeCell).join(','))
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
