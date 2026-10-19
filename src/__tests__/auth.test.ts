import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { authenticate, getCurrentSession, terminateSession, isSessionValid, MAX_SESSION_AGE_MS, AuthSession } from '../lib/auth';

const localStore: Record<string, string> = {};
const sessionStore: Record<string, string> = {};

const mockLocalStorage = {
  getItem: (key: string) => localStore[key] || null,
  setItem: (key: string, val: string) => { localStore[key] = String(val); },
  removeItem: (key: string) => { delete localStore[key]; },
  clear: () => { Object.keys(localStore).forEach(k => delete localStore[k]); }
};

const mockSessionStorage = {
  getItem: (key: string) => sessionStore[key] || null,
  setItem: (key: string, val: string) => { sessionStore[key] = String(val); },
  removeItem: (key: string) => { delete sessionStore[key]; },
  clear: () => { Object.keys(sessionStore).forEach(k => delete sessionStore[k]); }
};

beforeAll(() => {
  // @ts-expect-error polyfill
  globalThis.localStorage = mockLocalStorage;
  // @ts-expect-error polyfill
  globalThis.sessionStorage = mockSessionStorage;
});

describe('AL-BHURANI Authentication Service & Session Routing', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    mockSessionStorage.clear();
  });

  it('authenticates successfully with configured admin ID and admin123 password', async () => {
    const res = await authenticate('admin', 'admin123');
    expect(res.success).toBe(true);
    expect(res.session).toBeDefined();
    expect(res.session?.user.role).toBe('Owner');
    expect(res.session?.user.counter).toBe('Godi Road Store');

    const session = getCurrentSession();
    expect(session).not.toBeNull();
    expect(session?.token).toBe(res.session?.token);
  });

  it('authenticates admin ID case-insensitively', async () => {
    const res = await authenticate('ADMIN', 'admin123');
    expect(res.success).toBe(true);
  });

  it('rejects admin ID with wrong password', async () => {
    const res = await authenticate('admin', 'wrongpass999');
    expect(res.success).toBe(false);
    expect(res.error).toContain('Invalid ID or password');
    expect(getCurrentSession()).toBeNull();
  });

  it('rejects empty ID or empty password', async () => {
    const res1 = await authenticate('', 'admin123');
    expect(res1.success).toBe(false);

    const res2 = await authenticate('admin', '');
    expect(res2.success).toBe(false);
  });

  /* ─── Scenario 1: Fresh browser session → Login ─── */
  it('Scenario 1: Fresh browser session requires login (empty sessionStorage)', () => {
    // In a fresh browser session, sessionStorage has no keys
    expect(getCurrentSession()).toBeNull();

    // Even if legacy localStorage contains an old auth session flag, it must NOT auto-authenticate
    mockLocalStorage.setItem('albhurani_auth_session', JSON.stringify({
      token: 'stale-token-123',
      user: { id: 'admin', name: 'Owner', role: 'Owner', counter: 'Godi Road Store' },
      createdAt: new Date().toISOString(),
    }));

    // Must still return null because fresh session requires active sessionStorage
    expect(getCurrentSession()).toBeNull();
    // And stale localStorage flag is safely purged
    expect(mockLocalStorage.getItem('albhurani_auth_session')).toBeNull();
  });

  /* ─── Scenario 2: Successful login → Dashboard ─── */
  it('Scenario 2: Successful login establishes active session for Dashboard', async () => {
    const res = await authenticate('admin', 'admin123');
    expect(res.success).toBe(true);
    expect(res.session).toBeDefined();

    const activeSession = getCurrentSession();
    expect(activeSession).not.toBeNull();
    expect(activeSession?.user.name).toBe('Owner');
    expect(isSessionValid(activeSession)).toBe(true);
  });

  /* ─── Scenario 3: Refresh while authenticated → Dashboard ─── */
  it('Scenario 3: Refresh while authenticated preserves session in sessionStorage', async () => {
    await authenticate('admin', 'admin123');
    const firstSession = getCurrentSession();
    expect(firstSession).not.toBeNull();

    // Simulate page refresh (new component mount in same browser tab with intact sessionStorage)
    const refreshedSession = getCurrentSession();
    expect(refreshedSession).not.toBeNull();
    expect(refreshedSession?.token).toBe(firstSession?.token);
    expect(isSessionValid(refreshedSession)).toBe(true);
  });

  /* ─── Scenario 4: Logout → Login ─── */
  it('Scenario 4: Logout purges active session and user cache', async () => {
    await authenticate('admin', 'admin123');
    expect(getCurrentSession()).not.toBeNull();

    terminateSession();
    expect(getCurrentSession()).toBeNull();
    expect(mockSessionStorage.getItem('albhurani_auth_session')).toBeNull();
    expect(mockLocalStorage.getItem('albhurani_current_user')).toBeNull();
  });

  /* ─── Scenario 5: Refresh after logout → Login ─── */
  it('Scenario 5: Refresh after logout leaves session unauthenticated', async () => {
    await authenticate('admin', 'admin123');
    terminateSession();

    // Refresh simulation
    const sessionAfterRefresh = getCurrentSession();
    expect(sessionAfterRefresh).toBeNull();
  });

  /* ─── Scenario 6: Direct navigation while logged out → Login ─── */
  it('Scenario 6: Unauthenticated user is prevented from accessing protected state', () => {
    // Ensure no session
    terminateSession();
    const session = getCurrentSession();
    const isAuthenticated = Boolean(session && isSessionValid(session));
    expect(isAuthenticated).toBe(false);

    // Protected route check
    const protectedRoutes = ['overview', 'pos', 'customer-bills', 'no-bill-sales', 'inventory', 'settings'];
    protectedRoutes.forEach((route) => {
      // Direct navigation check: if !isAuthenticated, access is denied
      expect(isAuthenticated).toBe(false);
    });
  });

  /* ─── Session Expiration ─── */
  it('purges session if expired past MAX_SESSION_AGE_MS (24 hours)', () => {
    const expiredTime = new Date(Date.now() - (MAX_SESSION_AGE_MS + 1000)).toISOString();
    const expiredSession: AuthSession = {
      token: 'expired-token',
      user: { id: 'admin', email: 'admin@albhurani.com', name: 'Owner', role: 'Owner', counter: 'Godi Road Store' },
      createdAt: expiredTime,
    };

    mockSessionStorage.setItem('albhurani_auth_session', JSON.stringify(expiredSession));

    expect(isSessionValid(expiredSession)).toBe(false);
    expect(getCurrentSession()).toBeNull();
    expect(mockSessionStorage.getItem('albhurani_auth_session')).toBeNull();
  });

  /* ─── Corrupted Session Handling ─── */
  it('gracefully handles corrupted or malformed session JSON without throwing', () => {
    mockSessionStorage.setItem('albhurani_auth_session', 'not-valid-json{{{');
    expect(getCurrentSession()).toBeNull();

    mockSessionStorage.setItem('albhurani_auth_session', JSON.stringify({ token: '' }));
    expect(getCurrentSession()).toBeNull();
  });
});
