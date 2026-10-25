import { useState, useEffect, useCallback } from 'react';
import { ActiveTab } from '../components/layout/Sidebar';

export type AppRoute =
  | { type: 'public'; section?: string }
  | { type: 'admin'; subRoute?: ActiveTab };

const VALID_ADMIN_TABS: Record<string, ActiveTab> = {
  'overview': 'overview',
  'dashboard': 'overview',
  'pos': 'pos',
  'billing': 'pos',
  'no-bill-sales': 'no-bill-sales',
  'counter-sales': 'no-bill-sales',
  'customer-bills': 'customer-bills',
  'bills': 'customer-bills',
  'purchases': 'purchases',
  'purchase-bills': 'purchases',
  'vendors': 'purchases',
  'orders': 'orders',
  'customer-orders': 'orders',
  'product-management': 'product-management',
  'products': 'product-management',
  'stock': 'product-management',
  'inventory': 'product-management',
  'categories': 'product-management',
  'label-studio': 'label-studio',
  'labels': 'label-studio',
  'expenses': 'expenses',
  'reports': 'reports',
  'analytics': 'reports',
  'settings': 'settings',
};

/**
 * Strips known subfolder base paths (e.g. GitHub Pages repo name /AL-BHURANI)
 */
export function getCleanPathname(pathname: string = typeof window !== 'undefined' ? window.location.pathname : '/'): string {
  if (!pathname) return '/';
  let clean = pathname.replace(/^\/AL-BHURANI(?:\/|$)/i, '/');
  if (!clean.startsWith('/')) clean = '/' + clean;
  // Remove trailing slash if longer than 1 character
  if (clean.length > 1 && clean.endsWith('/')) {
    clean = clean.slice(0, -1);
  }
  return clean;
}

/**
 * Returns the current application base path (e.g. '/AL-BHURANI' on GitHub Pages or '' on root domains)
 */
export function getAppBasePath(): string {
  if (typeof window === 'undefined') return '';
  const p = window.location.pathname;
  if (/^\/AL-BHURANI(?:\/|$)/i.test(p)) {
    return '/AL-BHURANI';
  }
  return '';
}

/**
 * Determines whether the given URL path/hash represents an admin route
 */
export function parseCurrentRoute(
  pathname: string = typeof window !== 'undefined' ? window.location.pathname : '/',
  hash: string = typeof window !== 'undefined' ? window.location.hash : '',
  search: string = typeof window !== 'undefined' ? window.location.search : ''
): AppRoute {
  const cleanPath = getCleanPathname(pathname).toLowerCase();
  const cleanHash = hash.replace(/^#\/?/, '').trim().toLowerCase();

  // 1. Support GitHub Pages SPA redirect query parameter (e.g. ?p=/admin or ?p=/admin/pos)
  if (search) {
    const params = new URLSearchParams(search);
    const redirectPath = params.get('p');
    if (redirectPath) {
      const cleanRedirect = redirectPath.toLowerCase();
      if (cleanRedirect.startsWith('/admin') || cleanRedirect.startsWith('/login')) {
        const subPart = cleanRedirect.replace(/^\/(admin|login)\/?/, '').split('/')[0];
        return {
          type: 'admin',
          subRoute: VALID_ADMIN_TABS[subPart] || 'overview',
        };
      }
    }
  }

  // 2. Direct pathname matches: /admin, /admin/pos, /admin/purchases, etc.
  if (cleanPath === '/admin' || cleanPath.startsWith('/admin/')) {
    const subPart = cleanPath.slice('/admin'.length).replace(/^\//, '').split('/')[0];
    const subRoute = VALID_ADMIN_TABS[subPart] || VALID_ADMIN_TABS[cleanHash] || 'overview';
    return {
      type: 'admin',
      subRoute,
    };
  }

  // 3. Legacy compatibility: /login or /login/...
  if (cleanPath === '/login' || cleanPath.startsWith('/login/')) {
    return {
      type: 'admin',
      subRoute: 'overview',
    };
  }

  // 4. Hash-based admin routing: #admin, #/admin, #login, #/login
  if (cleanHash === 'admin' || cleanHash.startsWith('admin/') || cleanHash === 'login' || cleanHash.startsWith('login/')) {
    const subPart = cleanHash.replace(/^(admin|login)\/?/, '').split('/')[0];
    return {
      type: 'admin',
      subRoute: VALID_ADMIN_TABS[subPart] || 'overview',
    };
  }

  // 5. Bookmarked direct POS tab hashes: #pos, #purchases, #overview, #stock, etc.
  if (cleanHash && VALID_ADMIN_TABS[cleanHash]) {
    return {
      type: 'admin',
      subRoute: VALID_ADMIN_TABS[cleanHash],
    };
  }

  // 6. Default to public website foundation
  const section = cleanHash && ['products', 'about', 'contact', 'stores', 'home'].includes(cleanHash)
    ? cleanHash
    : undefined;

  return {
    type: 'public',
    section,
  };
}

const ROUTE_CHANGE_EVENT = 'al_bhurani_route_change';

/**
 * Universal navigation helper that respects base paths and notifies all listeners
 */
export function navigateTo(targetPath: string, options: { replace?: boolean } = {}): void {
  if (typeof window === 'undefined') return;

  const basePath = getAppBasePath();
  let fullUrl = targetPath;

  // Prepend base path if not already present and target is an absolute path
  if (basePath && targetPath.startsWith('/') && !targetPath.toLowerCase().startsWith(basePath.toLowerCase())) {
    fullUrl = `${basePath}${targetPath}`;
  }

  try {
    if (options.replace) {
      window.history.replaceState(null, '', fullUrl);
    } else {
      window.history.pushState(null, '', fullUrl);
    }
  } catch {
    // fallback for environments with restricted history API
    window.location.href = fullUrl;
    return;
  }

  window.dispatchEvent(new CustomEvent(ROUTE_CHANGE_EVENT));
}

/**
 * React hook to observe and change the active application route
 */
export function useAppRoute() {
  const [route, setRoute] = useState<AppRoute>(() => parseCurrentRoute());

  const handleUpdate = useCallback(() => {
    setRoute(parseCurrentRoute());
  }, []);

  useEffect(() => {
    window.addEventListener('popstate', handleUpdate);
    window.addEventListener('hashchange', handleUpdate);
    window.addEventListener(ROUTE_CHANGE_EVENT, handleUpdate);

    // Clean up query parameter if redirected by SPA 404 handler
    if (typeof window !== 'undefined' && window.location.search.includes('p=')) {
      const params = new URLSearchParams(window.location.search);
      const redirectP = params.get('p');
      if (redirectP) {
        params.delete('p');
        const newSearch = params.toString() ? `?${params.toString()}` : '';
        const basePath = getAppBasePath();
        const cleanTarget = `${basePath}${redirectP.startsWith('/') ? redirectP : `/${redirectP}`}${newSearch}${window.location.hash}`;
        try {
          window.history.replaceState(null, '', cleanTarget);
          setRoute(parseCurrentRoute());
        } catch {}
      }
    }

    return () => {
      window.removeEventListener('popstate', handleUpdate);
      window.removeEventListener('hashchange', handleUpdate);
      window.removeEventListener(ROUTE_CHANGE_EVENT, handleUpdate);
    };
  }, [handleUpdate]);

  const navigate = useCallback((targetPath: string, options?: { replace?: boolean }) => {
    navigateTo(targetPath, options);
  }, []);

  return { route, navigate };
}
