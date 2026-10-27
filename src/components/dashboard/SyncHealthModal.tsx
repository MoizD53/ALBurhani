import React, { useState } from 'react';
import {
  X,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  WifiOff,
  Cloud,
  Database,
  Store,
  Calendar,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { SyncState, syncManager } from '../../lib/syncManager';
import { UserProfile, OrderBill } from '../../types';
import { getKolkataDateString } from '../../lib/utils';

interface SyncHealthModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncState: SyncState;
  currentUser: UserProfile;
  onForceReconcile?: () => Promise<void>;
}

export const SyncHealthModal: React.FC<SyncHealthModalProps> = ({
  isOpen,
  onClose,
  syncState,
  currentUser,
  onForceReconcile,
}) => {
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [manualSyncMessage, setManualSyncMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const pendingOrders = syncManager.getPendingQueue();
  const branchName = currentUser.branchName || (currentUser.branchId === 'mg_road' ? 'MG Road' : 'Godi Road');
  const todayDate = getKolkataDateString();

  const handleSyncNow = async () => {
    setIsManualSyncing(true);
    setManualSyncMessage(null);
    try {
      if (onForceReconcile) {
        await onForceReconcile();
      } else {
        await syncManager.syncNow();
      }
      setManualSyncMessage('Synchronisation completed successfully.');
      setTimeout(() => setManualSyncMessage(null), 4000);
    } catch (err: any) {
      setManualSyncMessage(`Sync error: ${err?.message || 'Network request failed'}`);
    } finally {
      setIsManualSyncing(false);
    }
  };

  const getStatusBadge = () => {
    switch (syncState.status) {
      case 'connected':
        return {
          bg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
          dot: 'bg-emerald-500',
          label: 'Connected & In Sync',
          icon: CheckCircle2,
          description: 'All local records match the cloud database in real time.',
        };
      case 'syncing':
        return {
          bg: 'bg-sky-50 border-sky-200 text-sky-800',
          dot: 'bg-sky-500 animate-ping',
          label: 'Synchronising...',
          icon: RefreshCw,
          description: 'Transmitting delta events and flushing offline transactions...',
        };
      case 'offline':
        return {
          bg: 'bg-amber-50 border-amber-200 text-amber-800',
          dot: 'bg-amber-500',
          label: `Offline (${syncState.pendingCount} Queued)`,
          icon: WifiOff,
          description: 'Device is offline. All sales are preserved in durable storage.',
        };
      case 'error':
      default:
        return {
          bg: 'bg-rose-50 border-rose-200 text-rose-800',
          dot: 'bg-rose-500',
          label: `Sync Alert (${syncState.pendingCount} Queued)`,
          icon: AlertTriangle,
          description: syncState.lastError || 'Network interruption detected. Auto-retrying with backoff.',
        };
    }
  };

  const badge = getStatusBadge();
  const StatusIcon = badge.icon;

  const formatLastSync = (ts: number) => {
    if (!ts) return 'Never';
    const diffSec = Math.floor((Date.now() - ts) / 1000);
    if (diffSec < 10) return 'Just now';
    if (diffSec < 60) return `${diffSec} seconds ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
    return new Date(ts).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-[#E8DEC8] overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E8DEC8] flex items-center justify-between bg-gradient-to-r from-[#FAF8F5] to-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/40 text-[#C99A18] flex items-center justify-center">
              <Cloud className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-stone-900 font-serif">Cloud Synchronisation & Health</h2>
              <p className="text-[11px] text-stone-500">Real-time cloud database & transaction durability monitor</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-stone-100 text-stone-400 hover:text-stone-700 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          
          {/* Status Banner */}
          <div className={`p-4 rounded-xl border ${badge.bg} flex items-start gap-3 transition-colors`}>
            <div className="relative mt-0.5 shrink-0">
              <StatusIcon className="w-5 h-5" />
              <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${badge.dot}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-sm">{badge.label}</span>
                <span className="text-[11px] font-medium opacity-80">
                  Last sync: {formatLastSync(syncState.lastSyncTime)}
                </span>
              </div>
              <p className="text-xs mt-0.5 opacity-90 leading-relaxed">
                {badge.description}
              </p>
            </div>
          </div>

          {/* Manual Sync Trigger */}
          <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-[#FAF8F5] border border-[#E8DEC8]">
            <div className="min-w-0">
              <span className="text-xs font-bold text-stone-900 block">Immediate Reconciliation</span>
              <span className="text-[11px] text-stone-600 block">
                Flush pending queue and pull remote delta updates from cloud database
              </span>
            </div>
            <button
              onClick={handleSyncNow}
              disabled={isManualSyncing || syncState.status === 'syncing'}
              className="px-4 py-2 rounded-xl bg-[#1C1917] hover:bg-stone-800 text-[#D4AF37] font-semibold text-xs flex items-center gap-2 transition-all shadow-sm disabled:opacity-50 shrink-0 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isManualSyncing ? 'animate-spin' : ''}`} />
              <span>{isManualSyncing ? 'Syncing...' : 'Sync Now'}</span>
            </button>
          </div>

          {manualSyncMessage && (
            <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-fade-in">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>{manualSyncMessage}</span>
            </div>
          )}

          {/* Diagnostics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div className="p-3 rounded-xl bg-white border border-[#E8DEC8] space-y-1">
              <div className="flex items-center gap-1.5 text-stone-500 text-[10px] font-bold uppercase tracking-wider">
                <Store className="w-3 h-3 text-[#C99A18]" />
                <span>Store Branch</span>
              </div>
              <span className="text-xs font-bold text-stone-900 block truncate font-serif">
                {branchName}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-white border border-[#E8DEC8] space-y-1">
              <div className="flex items-center gap-1.5 text-stone-500 text-[10px] font-bold uppercase tracking-wider">
                <Calendar className="w-3 h-3 text-[#C99A18]" />
                <span>Business Date</span>
              </div>
              <span className="text-xs font-bold text-stone-900 block truncate">
                {todayDate} (IST)
              </span>
            </div>

            <div className="p-3 rounded-xl bg-white border border-[#E8DEC8] space-y-1">
              <div className="flex items-center gap-1.5 text-stone-500 text-[10px] font-bold uppercase tracking-wider">
                <Layers className="w-3 h-3 text-[#C99A18]" />
                <span>Event Cursor</span>
              </div>
              <span className="text-xs font-bold text-stone-900 block truncate">
                Event #{syncState.latestEventId}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-white border border-[#E8DEC8] space-y-1">
              <div className="flex items-center gap-1.5 text-stone-500 text-[10px] font-bold uppercase tracking-wider">
                <Database className="w-3 h-3 text-[#C99A18]" />
                <span>Database</span>
              </div>
              <span className="text-xs font-bold text-stone-900 block truncate">
                Central Cloud (ACID)
              </span>
            </div>

            <div className="p-3 rounded-xl bg-white border border-[#E8DEC8] space-y-1">
              <div className="flex items-center gap-1.5 text-stone-500 text-[10px] font-bold uppercase tracking-wider">
                <ShieldCheck className="w-3 h-3 text-[#C99A18]" />
                <span>Write Safety</span>
              </div>
              <span className="text-xs font-bold text-emerald-700 block truncate">
                Idempotent Batch
              </span>
            </div>

            <div className="p-3 rounded-xl bg-white border border-[#E8DEC8] space-y-1">
              <div className="flex items-center gap-1.5 text-stone-500 text-[10px] font-bold uppercase tracking-wider">
                <Cloud className="w-3 h-3 text-[#C99A18]" />
                <span>Offline Queue</span>
              </div>
              <span className={`text-xs font-bold block truncate ${syncState.pendingCount > 0 ? 'text-amber-600' : 'text-stone-900'}`}>
                {syncState.pendingCount} Bill{syncState.pendingCount === 1 ? '' : 's'} Queued
              </span>
            </div>
          </div>

          {/* Pending Orders Details */}
          {pendingOrders.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-[#E8DEC8]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Pending Offline Transactions</span>
                </span>
                <span className="text-[11px] text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  {pendingOrders.length} pending
                </span>
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {pendingOrders.map((order: OrderBill) => (
                  <div
                    key={order.id}
                    className="p-2.5 rounded-xl bg-[#FAF8F5] border border-[#E8DEC8] flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-stone-900">{order.billNumber || 'Draft Bill'}</span>
                      <span className="text-[10px] text-stone-500 block">
                        {order.createdAt ? new Date(order.createdAt).toLocaleTimeString('en-IN') : 'Just now'} · {order.items?.length || 0} items
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-[#C99A18] block">₹{Number(order.grandTotal || 0).toLocaleString('en-IN')}</span>
                      <span className="text-[9px] uppercase tracking-wider font-semibold text-stone-500">
                        {order.paymentMethod || 'CASH'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Non-Negotiable Durability Guarantee Callout */}
          <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/80 text-[11px] text-amber-900 space-y-1 leading-relaxed">
            <span className="font-bold flex items-center gap-1.5 text-amber-950">
              <ShieldCheck className="w-3.5 h-3.5 text-[#C99A18]" />
              <span>Owner Durability Guarantee</span>
            </span>
            <p>
              Bills are saved to encrypted browser storage before network transmission and are never discarded until the cloud database acknowledges successful persistence.
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#E8DEC8] bg-[#FAF8F5] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white border border-[#E8DEC8] hover:border-[#D4AF37] text-stone-700 hover:text-stone-900 font-semibold text-xs transition-colors shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
