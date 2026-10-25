/**
 * AL-BURHANI POS — Central Real-Time Synchronization Engine
 * 
 * Strict Business-Activity-Driven Sync Architecture:
 * - Activity-driven adaptive polling: active during billing (30s), backing off to gentle cadence when idle (90s - 300s).
 * - Instant wake on cashier interaction (keystroke, barcode scan, mouse move, touch, checkout).
 * - Zero background reads when tab is hidden or device is offline.
 * - Stable, forward-only cursor progression without backward rewinds.
 * - Single-event delivery: other devices receive sales, products, expenses, and purchases directly via delta payload without table scans.
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
  private pollTimeoutId: any = null;
  private isRunning: boolean = false;
  private activeBranch: string = 'all';
  private statusListeners: Set<(status: SyncStatus) => void> = new Set();
  private entityListeners: Map<string, Set<EntityChangeListener>> = new Map();
  private processedEventIds: Set<number> = new Set();

  // Activity tracking state
  private lastUserActivity: number = Date.now();
  private lastPollTime: number = 0;
  private baseIntervalMs: number = 30000;

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

  private isThrottled: boolean = false;

  public setThrottled(throttled: boolean) {
    this.isThrottled = throttled;
    this.baseIntervalMs = throttled ? 60000 : 30000;
  }

  public setBranch(branch: string) {
    this.activeBranch = branch;
  }

  /**
   * Records retail user activity (scanning, typing, clicking, navigation).
   * If returning from idle, immediately wakes up the sync engine to catch pending events.
   */
  public recordUserActivity(): void {
    const now = Date.now();
    const wasIdle = (now - this.lastUserActivity) > 120000; // was idle > 2 minutes
    this.lastUserActivity = now;

    if (wasIdle && this.isRunning) {
      // Re-activating from idle: check for pending changes if more than 15s since last poll
      if (now - this.lastPollTime > 15000) {
        this.pollForEvents();
      }
      this.reschedule();
    }
  }

  private initNetworkListeners() {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;

    window.addEventListener('online', () => {
      this.setStatus('syncing');
      this.pollForEvents();
      this.reschedule();
    });

    window.addEventListener('offline', () => {
      this.setStatus('offline');
      this.clearTimer();
    });

    window.addEventListener('focus', () => {
      this.recordUserActivity();
      if (this.isRunning && Date.now() - this.lastPollTime > 15000) {
        this.pollForEvents();
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.recordUserActivity();
        if (this.isRunning) {
          this.pollForEvents();
          this.reschedule();
        }
      } else {
        // Tab is hidden: completely pause scheduling to eliminate database reads
        this.clearTimer();
      }
    });

    // Throttled user activity listeners for physical shop laptop
    let lastMoveThrottle = 0;
    const handleMove = () => {
      const now = Date.now();
      if (now - lastMoveThrottle > 10000) {
        lastMoveThrottle = now;
        this.recordUserActivity();
      }
    };

    window.addEventListener('mousemove', handleMove, { passive: true });
    window.addEventListener('keydown', () => this.recordUserActivity(), { passive: true });
    window.addEventListener('pointerdown', () => this.recordUserActivity(), { passive: true });
    window.addEventListener('touchstart', () => this.recordUserActivity(), { passive: true });
  }

  private clearTimer() {
    if (this.pollTimeoutId) {
      clearTimeout(this.pollTimeoutId);
      this.pollTimeoutId = null;
    }
  }

  /**
   * Computes dynamic poll delay based on user idle time.
   * - Active (<2m idle): base interval (30s)
   * - Idle (2m - 5m idle): 90s
   * - Deep Idle (>5m idle): 300s (5m)
   */
  private getNextDelayMs(): number {
    const idleDuration = Date.now() - this.lastUserActivity;
    if (idleDuration > 300000) {
      return 300000; // Deep idle: 5 minutes
    }
    if (idleDuration > 120000) {
      return 90000; // Idle: 90 seconds
    }
    return Math.max(this.isThrottled ? 60000 : 10000, this.baseIntervalMs);
  }

  private reschedule() {
    this.clearTimer();
    if (!this.isRunning) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

    const delay = this.getNextDelayMs();
    this.pollTimeoutId = setTimeout(async () => {
      await this.pollForEvents();
      this.reschedule();
    }, delay);
  }

  public start(intervalMs: number = 30000) {
    this.baseIntervalMs = intervalMs;
    this.isRunning = true;
    this.lastUserActivity = Date.now();

    // Run first sync immediately
    this.pollForEvents();
    this.reschedule();
  }

  public stop() {
    this.isRunning = false;
    this.clearTimer();
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
    this.recordUserActivity();
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
    this.lastPollTime = Date.now();

    try {
      const branchParam = this.activeBranch && this.activeBranch !== 'all' ? `&branch=${encodeURIComponent(this.activeBranch)}` : '';
      const endpoint = `/api/db?action=fetch-events&since=${this.lastTimestamp}${branchParam}&_t=${Date.now()}`;
      const res = await fetch(endpoint, {
        method: 'GET',
        cache: 'no-store',
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
        // Stable cursor advance: do not rewind backward to prevent re-reading the same events repeatedly
        this.lastTimestamp = data.serverTime;
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
