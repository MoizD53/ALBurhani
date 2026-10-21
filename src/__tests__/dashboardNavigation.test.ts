import { describe, it, expect, beforeEach, beforeAll } from 'vitest';

const VALID_TABS = [
  'overview',
  'pos',
  'customer-bills',
  'no-bill-sales',
  'inventory',
  'label-studio',
  'expenses',
  'reports',
  'settings',
];

const mockLocation = {
  hash: '',
};

beforeAll(() => {
  (globalThis as any).window = {
    location: mockLocation,
  };
});

function getTabFromHash(): string {
  if (typeof window === 'undefined') return 'pos';
  const raw = window.location.hash.replace(/^#\/?/, '').trim().toLowerCase();
  if (raw === 'dashboard' || raw === 'overview') return 'overview';
  if (raw === 'customer-bills' || raw === 'bills' || raw === 'counter-sales') return 'no-bill-sales';
  if (raw === 'stock') return 'inventory';
  return VALID_TABS.includes(raw) ? raw : 'pos';
}

describe('AL-BURHANI POS — Dashboard Navigation & Route Routing', () => {
  beforeEach(() => {
    mockLocation.hash = '';
  });

  it('routes to overview when hash is #dashboard', () => {
    mockLocation.hash = '#dashboard';
    expect(getTabFromHash()).toBe('overview');
  });

  it('routes to overview when hash is #overview', () => {
    mockLocation.hash = '#overview';
    expect(getTabFromHash()).toBe('overview');
  });

  it('routes to overview when hash has leading slash like #/dashboard', () => {
    mockLocation.hash = '#/dashboard';
    expect(getTabFromHash()).toBe('overview');
  });

  it('routes to pos when hash is empty', () => {
    mockLocation.hash = '';
    expect(getTabFromHash()).toBe('pos');
  });

  it('routes to inventory when hash is #inventory or #stock', () => {
    mockLocation.hash = '#inventory';
    expect(getTabFromHash()).toBe('inventory');

    mockLocation.hash = '#stock';
    expect(getTabFromHash()).toBe('inventory');
  });

  it('routes to no-bill-sales when hash is #customer-bills or #bills', () => {
    mockLocation.hash = '#customer-bills';
    expect(getTabFromHash()).toBe('no-bill-sales');

    mockLocation.hash = '#bills';
    expect(getTabFromHash()).toBe('no-bill-sales');
  });

  it('syncs overview activeTab to #dashboard without bouncing to empty hash', () => {
    const activeTab = 'overview';
    const targetHash = activeTab === 'overview' ? 'dashboard' : activeTab;
    expect(targetHash).toBe('dashboard');

    mockLocation.hash = `#${targetHash}`;
    expect(mockLocation.hash).toBe('#dashboard');
    expect(getTabFromHash()).toBe('overview');
  });
});
