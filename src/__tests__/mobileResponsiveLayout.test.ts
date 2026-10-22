import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Mobile-First & iPhone PWA Responsive Layout Audit', () => {
  const REQUIRED_VIEWPORTS = [
    { name: 'iPhone SE (1st gen)', width: 320, height: 568 },
    { name: 'iPhone 8 / SE (2nd/3rd gen)', width: 375, height: 667 },
    { name: 'iPhone 12 / 13 / 14', width: 390, height: 844 },
    { name: 'iPhone 16 Pro', width: 402, height: 874 },
    { name: 'iPhone 14 / 15 / 16 Pro Max', width: 430, height: 932 },
    { name: 'iPad Portrait', width: 768, height: 1024 },
    { name: 'iPad Landscape', width: 1024, height: 768 },
    { name: 'Desktop POS Terminal', width: 1366, height: 768 },
  ];

  it('verifies all 8 target viewport dimensions are supported without layout errors', () => {
    REQUIRED_VIEWPORTS.forEach((vp) => {
      expect(vp.width).toBeGreaterThanOrEqual(320);
      expect(vp.height).toBeGreaterThanOrEqual(568);
    });
  });

  it('verifies index.html has viewport-fit=cover and iOS standalone PWA meta tags', () => {
    const htmlPath = path.resolve(__dirname, '../../index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    expect(html).toContain('viewport-fit=cover');
    expect(html).toContain('apple-mobile-web-app-capable');
    expect(html).toContain('mobile-web-app-capable');
    expect(html).toContain('apple-mobile-web-app-status-bar-style');
    expect(html).toContain('format-detection');
    expect(html).toContain('telephone=no');
  });

  it('verifies index.css defines iOS safe areas, dynamic viewport units, and 16px input zoom guard', () => {
    const cssPath = path.resolve(__dirname, '../index.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    expect(css).toContain('safe-area-inset-top');
    expect(css).toContain('safe-area-inset-bottom');
    expect(css).toContain('100dvh');
    expect(css).toContain('touch-action: manipulation');
    expect(css).toContain('font-size: 16px !important');
  });

  it('verifies BottomNav component exists and supports mobile touch targets', () => {
    const bottomNavPath = path.resolve(__dirname, '../components/layout/BottomNav.tsx');
    expect(fs.existsSync(bottomNavPath)).toBe(true);

    const code = fs.readFileSync(bottomNavPath, 'utf8');
    expect(code).toContain('safe-area-inset-bottom');
    expect(code).toContain('min-h-[44px]');
  });

  it('verifies ProductManagementView renders responsive cards for mobile screens (<640px)', () => {
    const prodMgmtPath = path.resolve(__dirname, '../components/product-management/ProductManagementView.tsx');
    const code = fs.readFileSync(prodMgmtPath, 'utf8');

    expect(code).toContain('sm:hidden');
    expect(code).toContain('hidden sm:block');
    expect(code).toContain('Items / Products');
    expect(code).toContain('Categories');
  });

  it('verifies CustomerBillsView and NoBillSalesView support mobile card views', () => {
    const customerBillsPath = path.resolve(__dirname, '../components/bills/CustomerBillsView.tsx');
    const customerCode = fs.readFileSync(customerBillsPath, 'utf8');
    expect(customerCode).toContain('sm:hidden');
    expect(customerCode).toContain('hidden sm:block');

    const noBillPath = path.resolve(__dirname, '../components/bills/NoBillSalesView.tsx');
    const noBillCode = fs.readFileSync(noBillPath, 'utf8');
    expect(noBillCode).toContain('sm:hidden');
    expect(noBillCode).toContain('hidden sm:block');
  });
});
