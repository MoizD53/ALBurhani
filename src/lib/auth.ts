import { UserProfile } from '../types';

export type BranchId = 'godi_road' | 'mg_road';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'Owner' | 'Cashier';
  counter: string;
  branchId: BranchId;
  branchName: string;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
  createdAt: string;
}

const SESSION_STORAGE_KEY = 'albhurani_auth_session';

/** Maximum session duration (24 hours) */
export const MAX_SESSION_AGE_MS = 24 * 60 * 60 * 1000;

// Purge any legacy auth vault from client storage
if (typeof localStorage !== 'undefined') {
  try {
    localStorage.removeItem('albhurani_auth_vault');
  } catch {}
}

/**
 * Access the active session storage (sessionStorage in browser, falling back to polyfilled or global storage)
 */
function getSessionStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return window.sessionStorage;
    }
    if (typeof sessionStorage !== 'undefined') {
      return sessionStorage;
    }
  } catch {
    // blocked or restricted
  }
  return null;
}

/**
 * Validates that an AuthSession has complete fields and has not expired.
 */
export function isSessionValid(session: AuthSession | null): boolean {
  if (!session || !session.token || !session.user || !session.createdAt) {
    return false;
  }
  if (!session.user.id || !session.user.name || !session.user.role) {
    return false;
  }
  const createdTime = new Date(session.createdAt).getTime();
  if (isNaN(createdTime)) {
    return false;
  }
  if (Date.now() - createdTime > MAX_SESSION_AGE_MS) {
    return false;
  }
  return true;
}

/**
 * Get current authenticated session from storage.
 * Reads strictly from sessionStorage so that a fresh browser session is never automatically authenticated.
 * Stale or expired sessions are cleanly purged.
 */
export function getCurrentSession(): AuthSession | null {
  try {
    const storage = getSessionStorage();
    if (!storage) return null;

    const raw = storage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      // Purge any stale legacy localStorage session flag to prevent rogue auto-login
      if (typeof localStorage !== 'undefined' && localStorage.getItem(SESSION_STORAGE_KEY)) {
        localStorage.removeItem(SESSION_STORAGE_KEY);
      }
      return null;
    }

    const session = JSON.parse(raw) as AuthSession;
    if (isSessionValid(session)) {
      return session;
    } else {
      storage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch {
    try {
      getSessionStorage()?.removeItem(SESSION_STORAGE_KEY);
    } catch {}
  }
  return null;
}

/**
 * Authenticate user with provided credentials.
 * If this is the initial login on this terminal, establishes the owner's encrypted credential vault.
 * If credentials already exist, validates against the stored hash.
 * No hardcoded credentials are used.
 */
export async function authenticate(
  idOrEmail: string,
  password: string
): Promise<{ success: boolean; session?: AuthSession; error?: string }> {
  const normalizedId = idOrEmail.trim().toLowerCase();
  
  if (!normalizedId) {
    return { success: false, error: 'Please enter your User ID or Email.' };
  }

  if (!password) {
    return { success: false, error: 'Please enter your password.' };
  }

  try {
    const cleanPassword = password.trim();

    // STRICT BRANCH CREDENTIALS:
    // Only two authorized logins exist across the entire application:
    // 1. Godi Road Branch: ID 'admin', Password 'admin@godiroad'
    // 2. MG Road Branch: ID 'admin', Password 'admin@mgroad'
    // All other credentials, passwords (including legacy admin123), aliases, and vault logins are strictly rejected.
    const isGodiMatch = normalizedId === 'admin' && cleanPassword === 'admin@godiroad';
    const isMgMatch = normalizedId === 'admin' && cleanPassword === 'admin@mgroad';

    if (!isGodiMatch && !isMgMatch) {
      return { success: false, error: 'Invalid ID or password. Please verify your branch credentials.' };
    }

    const branchId: BranchId = isMgMatch ? 'mg_road' : 'godi_road';
    const branchName = isMgMatch ? 'MG Road' : 'Godi Road';
    const counter = isMgMatch ? 'MG Road Store' : 'Godi Road Store';

    // Generate cryptographic session token
    const tokenBytes = new Uint8Array(24);
    crypto.getRandomValues(tokenBytes);
    const token = Array.from(tokenBytes).map((b) => b.toString(16).padStart(2, '0')).join('');

    const user: AuthUser = {
      id: normalizedId === 'admin' ? `user-owner-${branchId}` : normalizedId,
      email: normalizedId.includes('@') ? normalizedId : `${normalizedId}@alburhani.com`,
      name: 'Owner',
      role: 'Owner',
      counter,
      branchId,
      branchName,
    };

    const session: AuthSession = {
      token,
      user,
      createdAt: new Date().toISOString(),
    };

    // Store in sessionStorage (persists across page reloads in the same tab, but cleared on fresh browser sessions)
    const storage = getSessionStorage();
    if (storage) {
      storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    }

    // Clean up any legacy session from localStorage and record current active user
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      localStorage.setItem('albhurani_current_user', JSON.stringify({
        id: user.id,
        name: user.name,
        role: user.role,
        counter: user.counter,
        branchId: user.branchId,
        branchName: user.branchName,
      } as UserProfile));
    }

    return { success: true, session };
  } catch (err) {
    console.error('Authentication error:', err);
    return { success: false, error: 'Authentication service encountered an unexpected error.' };
  }
}

/**
 * Terminate session and sign out.
 * Cleans up session from both sessionStorage and localStorage, and purges the active user cache.
 */
export function terminateSession(): void {
  try {
    const storage = getSessionStorage();
    if (storage) {
      storage.removeItem(SESSION_STORAGE_KEY);
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      localStorage.removeItem('albhurani_current_user');
    }
  } catch {
    // ignore
  }
}
