import { describe, it, expect } from 'vitest';
import { parseCurrentRoute, getCleanPathname, getAppBasePath } from '../lib/routing';

describe('AL-BHURANI Routing & Path Resolver', () => {
  it('1. Routes root path "/" to public website', () => {
    const route = parseCurrentRoute('/', '', '');
    expect(route.type).toBe('public');
  });

  it('2. Routes GitHub Pages root path "/AL-BHURANI/" to public website', () => {
    const route = parseCurrentRoute('/AL-BHURANI/', '', '');
    expect(route.type).toBe('public');
  });

  it('3. Routes direct "/admin" to admin route with overview tab', () => {
    const route = parseCurrentRoute('/admin', '', '');
    expect(route.type).toBe('admin');
    if (route.type === 'admin') {
      expect(route.subRoute).toBe('overview');
    }
  });

  it('4. Routes GitHub Pages "/AL-BHURANI/admin" to admin route', () => {
    const route = parseCurrentRoute('/AL-BHURANI/admin', '', '');
    expect(route.type).toBe('admin');
    if (route.type === 'admin') {
      expect(route.subRoute).toBe('overview');
    }
  });

  it('5. Routes nested admin path "/admin/pos" directly to pos billing tab', () => {
    const route = parseCurrentRoute('/admin/pos', '', '');
    expect(route.type).toBe('admin');
    if (route.type === 'admin') {
      expect(route.subRoute).toBe('pos');
    }
  });

  it('6. Routes nested admin path "/admin/purchases" to purchases tab', () => {
    const route = parseCurrentRoute('/admin/purchases', '', '');
    expect(route.type).toBe('admin');
    if (route.type === 'admin') {
      expect(route.subRoute).toBe('purchases');
    }
  });

  it('7. Routes nested admin path "/admin/stock" to product-management tab', () => {
    const route = parseCurrentRoute('/admin/stock', '', '');
    expect(route.type).toBe('admin');
    if (route.type === 'admin') {
      expect(route.subRoute).toBe('product-management');
    }
  });

  it('8. Maps legacy "/login" to admin route for bookmark compatibility', () => {
    const route = parseCurrentRoute('/login', '', '');
    expect(route.type).toBe('admin');
  });

  it('9. Preserves existing hash bookmarks (e.g. "#pos", "#purchases")', () => {
    const posRoute = parseCurrentRoute('/', '#pos', '');
    expect(posRoute.type).toBe('admin');
    if (posRoute.type === 'admin') {
      expect(posRoute.subRoute).toBe('pos');
    }

    const purRoute = parseCurrentRoute('/AL-BHURANI/', '#purchases', '');
    expect(purRoute.type).toBe('admin');
    if (purRoute.type === 'admin') {
      expect(purRoute.subRoute).toBe('purchases');
    }
  });

  it('10. Resolves SPA 404 query redirect parameter ?p=/admin/orders', () => {
    const route = parseCurrentRoute('/AL-BHURANI/', '', '?p=/admin/orders');
    expect(route.type).toBe('admin');
    if (route.type === 'admin') {
      expect(route.subRoute).toBe('orders');
    }
  });

  it('11. Cleans pathnames and extracts base paths correctly', () => {
    expect(getCleanPathname('/AL-BHURANI/admin/pos')).toBe('/admin/pos');
    expect(getCleanPathname('/admin/pos/')).toBe('/admin/pos');
    expect(getCleanPathname('/')).toBe('/');
    expect(getAppBasePath()).toBeDefined();
  });
});
