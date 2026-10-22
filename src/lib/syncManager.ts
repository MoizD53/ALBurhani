/**
 * AL-BURHANI POS — Central Real-Time Synchronization Engine
 * 
 * Provides 1–3 second cross-device convergence for:
 * - Customer Tax Invoices & No-Bill Sales
 * - Product inventory & catalog prices
 * - Store expenses & finance records
 * - Shared owner settings (GST, shop details, NovaJet label settings)
 * - Customer records
 */

export type SyncStatus = 'connected' | 'syncing' | 'offline' | 'error';

export interface SyncEvent {
  id: number;
  entityType: 'order' | 'product' | 'expense' | 'customer' | 'settings' | 'customer_order' | 'category';
  entityId: string;
  operation: 'save' | 'stock' | 'delete' | 'batch_save' | 'reset_stock' | 'clear_orders' | 'clear_expenses' | 'status_update' | 'rename';
  payload?: any;
  serverTimestamp: number;
}

export type EntityChangeListener = (event: SyncEvent) => void;

class SyncManager {
  private status: SyncStatus = 'connected';
  private lastTimestamp: number = 0;
  private isPolling: boolean = false;
  private pollIntervalId: any = null;
  private statusListeners: Set<(status: SyncStatus) => void> = new Set();
  private entityListeners: Map<string, Set<EntityChangeListener>> = new Map();
  private processedEventIds: Set<number> = new Set();

  constructor() {
    this.initNetworkListeners();
    // Initialize timestamp from persisted sync cursor or past hour to catch changes while device was closed/sleeping
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('albhurani_last_sync_timestamp');
        this.lastTimestamp = saved ? Number(saved) : Date.now() - 3600000;
      } catch {
        this.lastTimestamp = Date.now() - 3600000;
      }
    } else {
      this.lastTimestamp = Date.now() - 3600000;
    }
  }

  private initNetworkListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.setStatus('syncing');
      this.pollForEvents();
    });

    window.addEventListener('offline', () => {
      this.setStatus('offline');
    });

    window.addEventListener('focus', () => {
      this.pollForEvents();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.pollForEvents();
      }
    });
  }

  public start(intervalMs: number = 2500) {
    if (this.pollIntervalId) return;

    // Run first sync immediately
    this.pollForEvents();

    this.pollIntervalId = setInterval(() => {
      this.pollForEvents();
    }, intervalMs);
  }

  public stop() {
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
  }

  public getStatus(): SyncStatus {
    return this.status;
  }

  public setStatus(newStatus: SyncStatus) {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.statusListeners.forEach((listener) => {
        try {
          listener(newStatus);
        } catch (e) {
          console.warn('Status listener error:', e);
        }
      });
    }
  }

  public onStatusChange(callback: (status: SyncStatus) => void): () => void {
    this.statusListeners.add(callback);
    callback(this.status);
    return () => this.statusListeners.delete(callback);
  }

  public subscribe(
    entityType: 'order' | 'product' | 'expense' | 'customer' | 'settings' | 'customer_order' | 'category' | 'all',
    callback: EntityChangeListener
  ): () => void {
    if (!this.entityListeners.has(entityType)) {
      this.entityListeners.set(entityType, new Set());
    }
    const set = this.entityListeners.get(entityType)!;
    set.add(callback);

    return () => {
      set.delete(callback);
    };
  }

  public broadcast(event: Omit<SyncEvent, 'id' | 'serverTimestamp'>): void {
    const fullEvent: SyncEvent = {
      ...event,
      id: Date.now() + Math.floor(Math.random() * 1000),
      serverTimestamp: Date.now(),
    };
    this.processedEventIds.add(fullEvent.id);
    this.dispatchEntityEvent(fullEvent);
  }

  /**
   * Fetches latest sync events from the serverless API.
   * Dispatches events to subscribed entity listeners.
   */
  public async pollForEvents(): Promise<void> {
    if (typeof window === 'undefined' && typeof globalThis.fetch === 'undefined') return;
    if (this.isPolling) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.setStatus('offline');
      return;
    }

    this.isPolling = true;

    try {
      const endpoint = `/api/db?action=fetch-events&since=${this.lastTimestamp}`;
      const res = await fetch(endpoint, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) {
        if (this.status !== 'offline') {
          this.setStatus('error');
        }
        return;
      }

      const data = await res.json();
      if (!data.success || !Array.isArray(data.events)) {
        this.setStatus('error');
        return;
      }

      this.setStatus('connected');

      if (data.events.length > 0) {
        let maxTimestamp = this.lastTimestamp;

        for (const ev of data.events as SyncEvent[]) {
          // Deduplicate
          if (this.processedEventIds.has(ev.id)) continue;
          this.processedEventIds.add(ev.id);

          // Prevent memory leak in processed IDs set
          if (this.processedEventIds.size > 2000) {
            const first1000 = Array.from(this.processedEventIds).slice(0, 1000);
            first1000.forEach((id) => this.processedEventIds.delete(id));
          }

          if (ev.serverTimestamp > maxTimestamp) {
            maxTimestamp = ev.serverTimestamp;
          }

          this.dispatchEntityEvent(ev);
        }

        this.lastTimestamp = maxTimestamp;
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('albhurani_last_sync_timestamp', String(maxTimestamp));
          } catch {}
        }
      } else if (data.serverTime && data.serverTime > this.lastTimestamp) {
        // Keep timestamp roughly updated
        this.lastTimestamp = Math.max(this.lastTimestamp, data.serverTime - 10000);
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('albhurani_last_sync_timestamp', String(this.lastTimestamp));
          } catch {}
        }
      }
    } catch {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        this.setStatus('offline');
      } else {
        this.setStatus('error');
      }
    } finally {
      this.isPolling = false;
    }
  }

  private dispatchEntityEvent(event: SyncEvent) {
    // Notify specific entity listeners
    const specificSet = this.entityListeners.get(event.entityType);
    if (specificSet) {
      specificSet.forEach((cb) => {
        try {
          cb(event);
        } catch (err) {
          console.warn(`Error in ${event.entityType} sync listener:`, err);
        }
      });
    }

    // Notify 'all' listeners
    const allSet = this.entityListeners.get('all');
    if (allSet) {
      allSet.forEach((cb) => {
        try {
          cb(event);
        } catch (err) {
          console.warn('Error in all sync listener:', err);
        }
      });
    }
  }

  /**
   * Resets timestamp and forces full reconciliation
   */
  public resetSyncTimestamp(newTimestamp: number = 0) {
    this.lastTimestamp = newTimestamp;
    this.processedEventIds.clear();
  }
}

export const syncManager = new SyncManager();
