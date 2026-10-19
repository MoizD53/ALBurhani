import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { authenticate, getCurrentSession, terminateSession } from '../lib/auth';

const store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, val: string) => { store[key] = String(val); },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); }
};

beforeAll(() => {
  // @ts-expect-error polyfill
  globalThis.localStorage = mockLocalStorage;
});

describe('AL-BHURANI Authentication Service', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
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

  it('terminates session properly on sign out', async () => {
    await authenticate('admin', 'admin123');
    expect(getCurrentSession()).not.toBeNull();

    terminateSession();
    expect(getCurrentSession()).toBeNull();
  });
});
