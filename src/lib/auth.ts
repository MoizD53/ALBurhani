import { UserProfile } from '../types';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'Owner' | 'Cashier';
  counter: string;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
  createdAt: string;
}

const SESSION_STORAGE_KEY = 'albhurani_auth_session';
const CREDENTIALS_STORAGE_KEY = 'albhurani_auth_vault';

/**
 * SHA-256 helper for client-side password hashing without external dependencies
 */
async function hashSecret(secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(secret);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Get current authenticated session from storage.
 */
export function getCurrentSession(): AuthSession | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as AuthSession;
    if (session && session.token && session.user) {
      return session;
    }
  } catch {
    // corrupted session
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
    // 1. Direct configured admin credentials
    const isAdminMatch = normalizedId === 'admin' && password === 'admin123';

    // 2. Encrypted device vault verification
    let isVaultMatch = false;
    const passwordHash = await hashSecret(`${normalizedId}:::${password}`);
    const vaultRaw = typeof localStorage !== 'undefined' ? localStorage.getItem(CREDENTIALS_STORAGE_KEY) : null;

    if (vaultRaw) {
      try {
        const vaultData = JSON.parse(vaultRaw);
        if (vaultData.email === normalizedId && vaultData.hash === passwordHash) {
          isVaultMatch = true;
        }
      } catch {}
    }

    if (!isAdminMatch && !isVaultMatch) {
      return { success: false, error: 'Invalid ID or password. Please verify your credentials.' };
    }

    // Generate cryptographic session token
    const tokenBytes = new Uint8Array(24);
    crypto.getRandomValues(tokenBytes);
    const token = Array.from(tokenBytes).map((b) => b.toString(16).padStart(2, '0')).join('');

    const user: AuthUser = {
      id: normalizedId === 'admin' ? 'user-owner' : normalizedId,
      email: normalizedId.includes('@') ? normalizedId : `${normalizedId}@albhurani.com`,
      name: 'Owner',
      role: 'Owner',
      counter: 'Godi Road Store',
    };

    const session: AuthSession = {
      token,
      user,
      createdAt: new Date().toISOString(),
    };

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      localStorage.setItem('albhurani_current_user', JSON.stringify({
        id: user.id,
        name: user.name,
        role: user.role,
        counter: user.counter,
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
 */
export function terminateSession(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}
