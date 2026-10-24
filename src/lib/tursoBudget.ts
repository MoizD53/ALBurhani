/**
 * AL-BHURANI — Turso Cloud Database Monthly Read Budget Manager
 * 
 * Target: Combined 450,000,000 rows read / billing cycle (450M Target, with 50M buffer below 500M plan ceiling)
 * Both Godi Road and MG Road share this single production budget.
 */

export interface TursoBudgetStatus {
  monthlyTarget: number;       // 450,000,000
  planCeiling: number;         // 500,000,000
  currentMonthlyUsage: number; // Measured from Turso
  remainingBudget: number;     // monthlyTarget - currentMonthlyUsage
  percentUsed: number;         // (currentMonthlyUsage / monthlyTarget) * 100
  daysRemainingInCycle: number;
  projectedMonthEnd: number;
  tier: 'NORMAL' | 'ELEVATED' | 'WARNING' | 'CRITICAL' | 'EMERGENCY';
  alertMessage?: string;
  recommendedDeltaIntervalMs: number;
  recommendedReconcileIntervalMs: number;
}

const MONTHLY_TARGET = 450_000_000;
const PLAN_CEILING = 500_000_000;
const STORAGE_KEY = 'albhurani_turso_monthly_usage';

// Default baseline from verified production dashboard telemetry
const DEFAULT_BASELINE_USAGE = 28_866_605;

/**
 * Calculates current cycle days remaining (assuming 1st of month reset or 30-day window)
 */
export function getCycleDaysRemaining(): number {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const currentDay = now.getDate();
  return Math.max(1, daysInMonth - currentDay);
}

/**
 * Retrieves the recorded monthly consumption.
 */
export function getRecordedMonthlyUsage(): number {
  if (typeof window === 'undefined') return DEFAULT_BASELINE_USAGE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = Number(raw);
      if (!isNaN(parsed) && parsed >= DEFAULT_BASELINE_USAGE) return parsed;
    }
  } catch {}
  return DEFAULT_BASELINE_USAGE;
}

/**
 * Updates recorded monthly usage from server health check or dashboard telemetry.
 */
export function recordMonthlyUsage(rowsRead: number): void {
  if (typeof window === 'undefined') return;
  try {
    const current = getRecordedMonthlyUsage();
    const updated = Math.max(current, rowsRead);
    localStorage.setItem(STORAGE_KEY, String(updated));
  } catch {}
}

/**
 * Computes full budget status, projection, and adaptive throttling intervals.
 */
export function getTursoBudgetStatus(): TursoBudgetStatus {
  const currentUsage = getRecordedMonthlyUsage();
  const daysRemaining = getCycleDaysRemaining();
  const now = new Date();
  const dayOfMonth = Math.max(1, now.getDate());
  
  // Projection based on daily burn rate
  const dailyBurn = currentUsage / dayOfMonth;
  const projectedMonthEnd = currentUsage + (dailyBurn * daysRemaining);
  const remainingBudget = Math.max(0, MONTHLY_TARGET - currentUsage);
  const percentUsed = (currentUsage / MONTHLY_TARGET) * 100;

  let tier: TursoBudgetStatus['tier'] = 'NORMAL';
  let alertMessage: string | undefined;
  let recommendedDeltaIntervalMs = 10_000; // 10s default
  let recommendedReconcileIntervalMs = 120_000; // 2m default

  if (percentUsed >= 95) {
    tier = 'EMERGENCY';
    alertMessage = 'CRITICAL: Database read allowance at 95% of 450M budget. Non-essential background polling paused to protect live POS checkout.';
    recommendedDeltaIntervalMs = 120_000; // 2m
    recommendedReconcileIntervalMs = 600_000; // 10m
  } else if (percentUsed >= 85) {
    tier = 'CRITICAL';
    alertMessage = 'WARNING: Database read allowance at 85% of budget. Background refresh throttled.';
    recommendedDeltaIntervalMs = 60_000; // 1m
    recommendedReconcileIntervalMs = 300_000; // 5m
  } else if (percentUsed >= 70) {
    tier = 'WARNING';
    alertMessage = 'NOTICE: Database read allowance at 70% of budget. Adaptive refresh enabled.';
    recommendedDeltaIntervalMs = 30_000; // 30s
    recommendedReconcileIntervalMs = 180_000; // 3m
  } else if (percentUsed >= 50) {
    tier = 'ELEVATED';
    recommendedDeltaIntervalMs = 15_000; // 15s
    recommendedReconcileIntervalMs = 150_000; // 2.5m
  }

  return {
    monthlyTarget: MONTHLY_TARGET,
    planCeiling: PLAN_CEILING,
    currentMonthlyUsage: currentUsage,
    remainingBudget,
    percentUsed: Math.min(100, Math.round(percentUsed * 10) / 10),
    daysRemainingInCycle: daysRemaining,
    projectedMonthEnd: Math.round(projectedMonthEnd),
    tier,
    alertMessage,
    recommendedDeltaIntervalMs,
    recommendedReconcileIntervalMs,
  };
}
