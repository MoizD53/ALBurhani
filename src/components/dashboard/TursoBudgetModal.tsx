import React, { useEffect, useState, useCallback } from 'react';
import { 
  Database, 
  X, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  ShieldCheck, 
  TrendingUp, 
  Clock, 
  Layers
} from 'lucide-react';
import { fetchTursoBudgetStatus, TursoBudgetStatus } from '../../lib/turso';

interface TursoBudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TursoBudgetModal: React.FC<TursoBudgetModalProps> = ({ isOpen, onClose }) => {
  const [budgetStatus, setBudgetStatus] = useState<TursoBudgetStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async (force = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchTursoBudgetStatus(force);
      if (data && data.success) {
        setBudgetStatus(data);
      } else {
        setError('Could not fetch budget diagnostics from server.');
      }
    } catch {
      setError('Network error connecting to diagnostic endpoint.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadStatus(false);
    }
  }, [isOpen, loadStatus]);

  if (!isOpen) return null;

  // Format large numbers with comma separators (e.g. 200,000,000)
  const formatNum = (num: number) => num.toLocaleString('en-IN');

  const percentageUsed = budgetStatus?.percentageUsed || 0;
  const projectedPercentage = budgetStatus?.projectedPercentage || 0;
  const threshold = budgetStatus?.thresholdStatus || 'normal';

  // Status color helpers
  const getBadgeColor = () => {
    switch (threshold) {
      case 'exceeded':
      case '95%':
        return 'bg-red-50 text-red-700 border-red-200';
      case '85%':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case '70%':
      case '50%':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-[#E8DEC8] overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-[#FAF8F5] via-white to-[#F5EED9] border-b border-[#E8DEC8] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#C99A18]/15 border border-[#C99A18]/30 flex items-center justify-center text-[#C99A18] shadow-sm">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-stone-900 font-serif">
                Cloud Database Read Budget
              </h2>
              <p className="text-xs text-stone-500 font-medium">
                Shared 200M Monthly Operational Read Budget Diagnostic
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadStatus(true)}
              disabled={isLoading}
              className="p-2 rounded-xl border border-[#E8DEC8] hover:border-[#D4AF37] bg-white text-stone-600 hover:text-stone-900 transition-all cursor-pointer disabled:opacity-50"
              title="Refresh Metrics"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#C99A18]' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl border border-[#E8DEC8] hover:border-[#D4AF37] bg-white text-stone-600 hover:text-stone-900 transition-all cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-stone-800 text-sm">
          {error && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Key Metric Highlights Card */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E8DEC8]">
              <div className="flex items-center gap-2 text-stone-500 text-xs font-semibold mb-1">
                <Database className="w-3.5 h-3.5 text-[#C99A18]" />
                <span>Monthly Budget</span>
              </div>
              <div className="text-xl font-extrabold text-stone-900">
                200,000,000
              </div>
              <div className="text-[11px] text-stone-500 mt-0.5">
                Rows Read / Month (Shared)
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E8DEC8]">
              <div className="flex items-center gap-2 text-stone-500 text-xs font-semibold mb-1">
                <Layers className="w-3.5 h-3.5 text-[#C99A18]" />
                <span>Month-to-Date Read</span>
              </div>
              <div className="text-xl font-extrabold text-stone-900">
                {budgetStatus ? formatNum(budgetStatus.totalEstimatedRowsRead) : '...'}
              </div>
              <div className="text-[11px] text-stone-500 mt-0.5">
                {budgetStatus ? `${percentageUsed}% of 200M limit` : 'Loading...'}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#FAF8F5] border border-[#E8DEC8]">
              <div className="flex items-center gap-2 text-stone-500 text-xs font-semibold mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-[#C99A18]" />
                <span>Projected End-of-Month</span>
              </div>
              <div className="text-xl font-extrabold text-stone-900">
                {budgetStatus ? formatNum(budgetStatus.projectedMonthlyRows) : '...'}
              </div>
              <div className="text-[11px] text-stone-500 mt-0.5">
                {budgetStatus ? `${projectedPercentage}% of target` : 'Loading...'}
              </div>
            </div>
          </div>

          {/* Progress Bar & Status Pill */}
          <div className="p-5 rounded-2xl bg-[#FAF8F5] border border-[#E8DEC8] space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-stone-900 text-xs tracking-wider uppercase">
                Budget Consumption ({budgetStatus?.periodMonth || 'Current Period'})
              </span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getBadgeColor()}`}>
                Threshold: {threshold.toUpperCase()}
              </span>
            </div>

            {/* Visual Bar */}
            <div className="w-full h-3.5 rounded-full bg-stone-200 overflow-hidden relative">
              <div 
                className={`h-full transition-all duration-500 rounded-full ${
                  percentageUsed >= 95 ? 'bg-red-500' :
                  percentageUsed >= 85 ? 'bg-orange-500' :
                  percentageUsed >= 70 ? 'bg-amber-500' :
                  'bg-gradient-to-r from-emerald-500 to-[#C99A18]'
                }`}
                style={{ width: `${Math.min(100, Math.max(1, percentageUsed))}%` }}
              />
            </div>

            {/* Threshold Indicators */}
            <div className="flex justify-between text-[10px] text-stone-400 font-medium px-1">
              <span>0M (0%)</span>
              <span>100M (50%)</span>
              <span>140M (70%)</span>
              <span>170M (85%)</span>
              <span>190M (95%)</span>
              <span>200M (100%)</span>
            </div>

            {budgetStatus?.alertMessage && (
              <div className={`p-3 rounded-xl border text-xs font-medium flex items-center gap-2.5 ${getBadgeColor()}`}>
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{budgetStatus.alertMessage}</span>
              </div>
            )}
          </div>

          {/* Safety & Authoritative Clarification Banners */}
          <div className="space-y-2">
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Safety Guarantee: Critical Operations Never Blocked</span>
                <span>Billing, counter checkouts, payments, and stock movements are permanently exempted from query budget restrictions and will never be blocked under any usage threshold.</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Estimated Application Metric</span>
                <span>Values shown are application-level row estimations calculated from executed SQL statement profiles and result lengths. Official authoritative rows read are tracked directly in the cloud platform account dashboard.</span>
              </div>
            </div>
          </div>

          {/* Top Query Consumers Table */}
          {budgetStatus?.topConsumers && budgetStatus.topConsumers.length > 0 && (
            <div className="space-y-2">
              <span className="font-bold text-stone-900 text-xs uppercase tracking-wider block">
                Top Statement Consumers
              </span>
              <div className="overflow-x-auto rounded-2xl border border-[#E8DEC8]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF8F5] border-b border-[#E8DEC8] text-stone-600 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Operation</th>
                      <th className="py-2.5 px-3 text-right">Calls</th>
                      <th className="py-2.5 px-3 text-right">Estimated Rows</th>
                      <th className="py-2.5 px-3 text-right">% of Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0EBE0] text-stone-700">
                    {budgetStatus.topConsumers.map((c, idx) => (
                      <tr key={idx} className="hover:bg-[#FFFDF5] transition-colors">
                        <td className="py-2 px-3 font-mono text-[11px] text-stone-900 font-medium truncate max-w-[200px]">
                          {c.action}
                        </td>
                        <td className="py-2 px-3 text-right font-medium">
                          {formatNum(c.queryCount)}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-stone-900">
                          {formatNum(c.estimatedRows)}
                        </td>
                        <td className="py-2 px-3 text-right text-stone-500 font-medium">
                          {c.percentOfTotal}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#FAF8F5] border-t border-[#E8DEC8] flex items-center justify-between text-xs text-stone-500">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-stone-400" />
            <span>Updated: {new Date().toLocaleTimeString()}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-stone-900 hover:bg-black text-white font-bold transition-all shadow-sm cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
