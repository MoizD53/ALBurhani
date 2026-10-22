import { CategoryItem, Product } from '../types';

export const CATEGORIES_STORAGE_KEY = 'albhurani_categories';

export const DEFAULT_CATEGORY_NAMES = [
  'SWEETS',
  'SNACKS',
  'FARSAAN MIX',
  'BAKERY',
  'DRY FRUITS',
  'ROASTED',
  'CHIPS',
  'KHARAS',
  'PURI',
  'ACHAR',
  'CHATNI',
  'PAPAD',
  'MUKHWAS',
  'MAWA',
  'PAAK',
  'PARA',
  'TOAST',
  'PANIPURI PANI FLAVOUR',
];

/**
 * Normalizes category name for clean comparison and display.
 */
export function sanitizeCategoryName(name: string): string {
  return (name || '').trim().toUpperCase();
}

/**
 * Validates that category name is not empty and not a duplicate.
 */
export function validateCategoryName(
  name: string,
  existingCategories: CategoryItem[] = [],
  editingId?: string
): { valid: boolean; error?: string } {
  const clean = sanitizeCategoryName(name);

  if (!clean) {
    return { valid: false, error: 'Category name is required' };
  }

  if (clean.length < 2) {
    return { valid: false, error: 'Category name must be at least 2 characters' };
  }

  const isDuplicate = existingCategories.some(
    (c) => c.id !== editingId && sanitizeCategoryName(c.name) === clean
  );

  if (isDuplicate) {
    return { valid: false, error: `Category "${clean}" already exists` };
  }

  return { valid: true };
}

/**
 * Harvests categories from existing products and combines them with defaults.
 */
export function harvestCategoriesFromProducts(
  products: Product[],
  existingSaved: CategoryItem[] = []
): CategoryItem[] {
  const categoryMap = new Map<string, CategoryItem>();

  // 1. Add existing saved
  existingSaved.forEach((cat) => {
    categoryMap.set(sanitizeCategoryName(cat.name), { ...cat });
  });

  // 2. Add defaults if not present
  DEFAULT_CATEGORY_NAMES.forEach((name, idx) => {
    const key = sanitizeCategoryName(name);
    if (!categoryMap.has(key)) {
      categoryMap.set(key, {
        id: `cat-def-${key.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        name,
        isActive: true,
        displayOrder: idx + 1,
      });
    }
  });

  // 3. Harvest from products
  products.forEach((p) => {
    if (p.category && p.category.trim()) {
      const key = sanitizeCategoryName(p.category);
      if (!categoryMap.has(key)) {
        categoryMap.set(key, {
          id: `cat-prod-${key.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          name: p.category.trim(),
          isActive: true,
          displayOrder: 99,
        });
      }
    }
  });

  // 4. Calculate product count per category
  const productCountMap = new Map<string, number>();
  products.forEach((p) => {
    if (p.category) {
      const key = sanitizeCategoryName(p.category);
      productCountMap.set(key, (productCountMap.get(key) || 0) + 1);
    }
  });

  const result = Array.from(categoryMap.values()).map((c) => ({
    ...c,
    productCount: productCountMap.get(sanitizeCategoryName(c.name)) || 0,
  }));

  // Sort: active first, then displayOrder, then name
  result.sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    if ((a.displayOrder || 99) !== (b.displayOrder || 99)) {
      return (a.displayOrder || 99) - (b.displayOrder || 99);
    }
    return a.name.localeCompare(b.name);
  });

  return result;
}

/**
 * Storage helpers
 */
export function getSavedCategories(products?: Product[]): CategoryItem[] {
  if (typeof localStorage === 'undefined') return products ? harvestCategoriesFromProducts(products) : [];
  try {
    const raw = localStorage.getItem(CATEGORIES_STORAGE_KEY);
    if (!raw) return products ? harvestCategoriesFromProducts(products) : [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    return products ? harvestCategoriesFromProducts(products) : [];
  } catch {
    return products ? harvestCategoriesFromProducts(products) : [];
  }
}

export function saveCategoriesLocally(categories: CategoryItem[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
  } catch (err) {
    console.warn('Failed to save categories to localStorage:', err);
  }
}
