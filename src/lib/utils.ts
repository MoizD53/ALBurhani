import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { OrderBill } from '../types';

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
 * Determines whether an order falls within the requested date range:
 * - 'today': calendar day of today
 * - '7days': last 7 calendar days
 * - 'month': last 30 calendar days
 * - 'all': all orders
 */
export function isOrderInDateRange(
  order: OrderBill,
  range: 'today' | '7days' | 'month' | 'all'
): boolean {
  if (range === 'all') return true;

  const timestamp = extractOrderTimestamp(order);
  // Fail-safe: if date cannot be resolved, include the order so real sales are never lost
  if (timestamp === null) return true;

  const orderDate = new Date(timestamp);
  const now = new Date();

  if (range === 'today') {
    return (
      orderDate.getFullYear() === now.getFullYear() &&
      orderDate.getMonth() === now.getMonth() &&
      orderDate.getDate() === now.getDate()
    );
  }

  if (range === '7days') {
    const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).getTime();
    return timestamp >= cutoff;
  }

  if (range === 'month') {
    const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30).getTime();
    return timestamp >= cutoff;
  }

  return true;
}

