import { describe, it, expect } from 'vitest';
import {
  sanitizeCategoryName,
  validateCategoryName,
  harvestCategoriesFromProducts,
  DEFAULT_CATEGORY_NAMES
} from '../lib/categories';
import { CategoryItem, Product } from '../types';

describe('Unified Product Management & Categories Tests', () => {
  describe('sanitizeCategoryName', () => {
    it('trims whitespace and converts to uppercase', () => {
      expect(sanitizeCategoryName('  sweets  ')).toBe('SWEETS');
      expect(sanitizeCategoryName('Dry Fruits')).toBe('DRY FRUITS');
      expect(sanitizeCategoryName('')).toBe('');
    });
  });

  describe('validateCategoryName', () => {
    const existingCategories: CategoryItem[] = [
      { id: 'cat-1', name: 'SWEETS', isActive: true },
      { id: 'cat-2', name: 'SNACKS', isActive: true },
      { id: 'cat-3', name: 'FARSAAN MIX', isActive: false },
    ];

    it('rejects empty or whitespace-only names', () => {
      expect(validateCategoryName('').valid).toBe(false);
      expect(validateCategoryName('   ').valid).toBe(false);
    });

    it('rejects single-character category names', () => {
      expect(validateCategoryName('A').valid).toBe(false);
    });

    it('rejects case-insensitive duplicates', () => {
      const res = validateCategoryName('sweets', existingCategories);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('already exists');
    });

    it('allows editing an existing category without triggering self-duplicate error', () => {
      const res = validateCategoryName('Sweets', existingCategories, 'cat-1');
      expect(res.valid).toBe(true);
    });

    it('accepts unique and valid category names', () => {
      const res = validateCategoryName('PREMIUM CHOCOLATES', existingCategories);
      expect(res.valid).toBe(true);
    });
  });

  describe('harvestCategoriesFromProducts', () => {
    it('combines default categories, custom saved categories, and product categories', () => {
      const mockProducts: Product[] = [
        {
          id: 'p-1',
          name: 'Kaju Katli',
          category: 'SWEETS',
          sellingPrice: 900,
          costPrice: 700,
          unit: 'KG',
          barcode: '1001',
          sku: '1001',
          isActive: true
        },
        {
          id: 'p-2',
          name: 'Peda Special',
          category: 'SWEETS',
          sellingPrice: 600,
          costPrice: 450,
          unit: 'KG',
          barcode: '1002',
          sku: '1002',
          isActive: true
        },
        {
          id: 'p-3',
          name: 'Gond Pak',
          category: 'WINTER SPECIAL',
          sellingPrice: 800,
          costPrice: 600,
          unit: 'KG',
          barcode: '1003',
          sku: '1003',
          isActive: true
        }
      ];

      const saved: CategoryItem[] = [
        { id: 'cat-custom-1', name: 'GIFT HAMPERS', isActive: true, displayOrder: 1 }
      ];

      const harvested = harvestCategoriesFromProducts(mockProducts, saved);

      // Verify custom saved is preserved
      expect(harvested.some((c) => c.name === 'GIFT HAMPERS')).toBe(true);

      // Verify default category SWEETS is present and counted
      const sweetsCat = harvested.find((c) => c.name === 'SWEETS');
      expect(sweetsCat).toBeDefined();
      expect(sweetsCat?.productCount).toBe(2);

      // Verify category from product 'WINTER SPECIAL' is harvested and counted
      const winterCat = harvested.find((c) => c.name === 'WINTER SPECIAL');
      expect(winterCat).toBeDefined();
      expect(winterCat?.productCount).toBe(1);

      // Check defaults are included
      DEFAULT_CATEGORY_NAMES.forEach((defName) => {
        expect(harvested.some((c) => c.name === defName)).toBe(true);
      });
    });
  });
});
