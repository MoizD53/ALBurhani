/**
 * AL-BHURANI — Turso Cloud Database Monthly Read Budget Manager
 * 
 * Target: Combined 200,000,000 rows read / month (Shared 200M operational budget).
 * This is one shared budget across:
 * - Both login experiences (Godi Road and MG Road).
 * - All users and devices.
 * - All admin dashboards and API endpoints.
 * - Background sync, polling, reporting, and database queries.
 * 
 * Safety Rule: Essential billing, sales, payment recording, and safety operations
 * are NEVER blocked simply to enforce the read budget.
 */

export interface TursoBudgetStatus {
  monthlyTarget: number;       // 200,000,000
  planCeiling: number;         // 200,000,000
  currentMonthlyUsage: number; // Measured application estimate or Turso telemetry
  remainingBudget: number;     // monthlyTarget - currentMonthlyUsage
  percentUsed: number;         // (currentMonthlyUsage / monthlyTarget) * 100
  daysRemainingInCycle: number;
  projectedMonthEnd: number;
  projectedPercent: number;
  tier: 'NORMAL' | 'ELEVATED' | 'WARNING' | 'CRITICAL' | 'EMERGENCY';
  alertMessage?: string;
  recommendedDeltaIntervalMs: number;
  recommendedReconcileIntervalMs: number;
  criticalOperationsGuaranteed: boolean;
  metricType: string;
}

const MONTHLY_TARGET = 200_000_000;
const PLAN_CEILING = 200_000_000;
const STORAGE_KEY = 'albhurani_turso_monthly_usage';

// Fresh deployment starts clean at 0 baseline
const DEFAULT_BASELINE_USAGE = 0;

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
      if (!isNaN(parsed) && parsed >= 0) return parsed;
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
 * Reset monthly usage counter (for fresh deployment or monthly rollover)
 */
export function resetMonthlyUsage(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, '0');
  } catch {}
}

/**
 * Computes full budget status, projection, and adaptive throttling intervals.
 * Thresholds: 50%, 70%, 85%, 95% of the 200M target.
 */
export function getTursoBudgetStatus(explicitUsage?: number): TursoBudgetStatus {
  const currentUsage = explicitUsage !== undefined ? explicitUsage : getRecordedMonthlyUsage();
  const daysRemaining = getCycleDaysRemaining();
  const now = new Date();
  const dayOfMonth = Math.max(1, now.getDate());
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  
  // Projection based on daily burn rate
  const dailyBurn = currentUsage / dayOfMonth;
  const projectedMonthEnd = Math.round(dailyBurn * daysInMonth);
  const remainingBudget = Math.max(0, MONTHLY_TARGET - currentUsage);
  const percentUsed = (currentUsage / MONTHLY_TARGET) * 100;
  const projectedPercent = (projectedMonthEnd / MONTHLY_TARGET) * 100;

  let tier: TursoBudgetStatus['tier'] = 'NORMAL';
  let alertMessage: string | undefined;
  let recommendedDeltaIntervalMs = 30_000; // 30s base active interval
  let recommendedReconcileIntervalMs = 180_000; // 3m base reconcile interval

  // Warning thresholds at 50%, 70%, 85%, 95% of the 200M target
  if (percentUsed >= 95) {
    tier = 'EMERGENCY';
    alertMessage = 'CRITICAL ALERT: Database read allowance at 95% of 200M budget. Non-essential reporting and analytics are throttled.';
    recommendedDeltaIntervalMs = 120_000;
    recommendedReconcileIntervalMs = 600_000;
  } else if (percentUsed >= 85) {
    tier = 'CRITICAL';
    alertMessage = 'WARNING: Database read allowance at 85% of 200M budget. Non-essential background polling throttled.';
    recommendedDeltaIntervalMs = 60_000;
    recommendedReconcileIntervalMs = 300_000;
  } else if (percentUsed >= 70) {
    tier = 'WARNING';
    alertMessage = 'NOTICE: Database read allowance at 70% of 200M budget. Adaptive cadence active.';
    recommendedDeltaIntervalMs = 45_000;
    recommendedReconcileIntervalMs = 240_000;
  } else if (percentUsed >= 50) {
    tier = 'ELEVATED';
    alertMessage = 'NOTICE: Database read allowance has crossed 50% milestone of 200M budget.';
    recommendedDeltaIntervalMs = 30_000;
    recommendedReconcileIntervalMs = 180_000;
  } else if (projectedPercent >= 100) {
    tier = 'CRITICAL';
    alertMessage = 'WARNING: Projected monthly consumption is on track to exceed 200M budget.';
    recommendedDeltaIntervalMs = 60_000;
    recommendedReconcileIntervalMs = 300_000;
  } else if (projectedPercent >= 85) {
    tier = 'WARNING';
    alertMessage = 'NOTICE: Projected monthly consumption is reaching elevated levels.';
    recommendedDeltaIntervalMs = 45_000;
    recommendedReconcileIntervalMs = 240_000;
  }

  return {
    monthlyTarget: MONTHLY_TARGET,
    planCeiling: PLAN_CEILING,
    currentMonthlyUsage: currentUsage,
    remainingBudget,
    percentUsed: Math.min(100, Math.round(percentUsed * 100) / 100),
    daysRemainingInCycle: daysRemaining,
    projectedMonthEnd,
    projectedPercent: Math.round(projectedPercent * 100) / 100,
    tier,
    alertMessage,
    recommendedDeltaIntervalMs,
    recommendedReconcileIntervalMs,
    criticalOperationsGuaranteed: true, // Billing, sales, checkout NEVER blocked
    metricType: 'ESTIMATED_APPLICATION_METRIC',
  };
}
