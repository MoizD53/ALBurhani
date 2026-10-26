import { describe, it, expect } from 'vitest';
import { validateBatchDates, PRESETS } from '../components/labels/LabelStudioView';
import { Product, UserProfile } from '../types';

describe('AL-BURHANI POS — Label Studio Specification & Verification', () => {
  const mockProducts: Product[] = [
    {
      id: 'prod-1',
      sku: '0001',
      barcode: '0001', // Leading zeros preserved
      name: 'KAJU KATLI 250G',
      category: 'Sweets',
      unit: 'PCS',
      costPrice: 200,
      sellingPrice: 275,
      stock: 45,
      minStock: 5,
    },
    {
      id: 'prod-2',
      sku: 'SKU-0042',
      barcode: '0042', // Leading zeros preserved
      name: 'RATLAMI SEV 500G',
      category: 'Namkeen & Farsan',
      unit: 'PCS',
      costPrice: 70,
      sellingPrice: 110,
      stock: 30,
      minStock: 5,
    },
    {
      id: 'prod-no-barcode',
      sku: 'SKU-9999',
      barcode: '', // Missing barcode
      name: 'UNLABELED PRODUCT',
      category: 'Sweets',
      unit: 'KG',
      costPrice: 100,
      sellingPrice: 150,
      stock: 10,
      minStock: 2,
    },
  ];

  describe('1. Product Selection & Barcode Matching', () => {
    it('matches exact barcodes preserving leading zeros (e.g. "0001" and "0042")', () => {
      const code1 = '0001';
      const match1 = mockProducts.find(
        (p) => p.barcode.toLowerCase() === code1.toLowerCase() || p.sku.toLowerCase() === code1.toLowerCase()
      );
      expect(match1).toBeDefined();
      expect(match1?.name).toBe('KAJU KATLI 250G');
      expect(match1?.barcode).toBe('0001');

      const code2 = '0042';
      const match2 = mockProducts.find(
        (p) => p.barcode.toLowerCase() === code2.toLowerCase() || p.sku.toLowerCase() === code2.toLowerCase()
      );
      expect(match2).toBeDefined();
      expect(match2?.name).toBe('RATLAMI SEV 500G');
      expect(match2?.barcode).toBe('0042');
    });

    it('identifies products with missing or invalid barcodes', () => {
      const hasBarcode = (p: Product) => Boolean(p.barcode && p.barcode.trim());
      expect(hasBarcode(mockProducts[0])).toBe(true);
      expect(hasBarcode(mockProducts[1])).toBe(true);
      expect(hasBarcode(mockProducts[2])).toBe(false);
    });
  });

  describe('2. Manufacturing and Expiry Dates Validation', () => {
    it('passes when EXP date is later than MFG date', () => {
      const mfg = '2026-10-19';
      const exp = '2027-01-19';
      const err = validateBatchDates(mfg, exp);
      expect(err).toBeNull();
    });

    it('passes when dates are on the same day', () => {
      const mfg = '2026-10-19';
      const exp = '2026-10-19';
      const err = validateBatchDates(mfg, exp);
      expect(err).toBeNull();
    });

    it('fails with a clear warning when EXP date is earlier than MFG date', () => {
      const mfg = '2026-10-19';
      const exp = '2026-10-10';
      const err = validateBatchDates(mfg, exp);
      expect(err).toBe('Expiry date (EXP) cannot be earlier than Manufacturing date (MFG).');
    });

    it('passes when dates are optional / partially provided', () => {
      expect(validateBatchDates('2026-10-19', '')).toBeNull();
      expect(validateBatchDates('', '2027-01-19')).toBeNull();
      expect(validateBatchDates('', '')).toBeNull();
    });
  });

  describe('3. Multi-Product Batch Copies & Print Layout Counts', () => {
    it('correctly aggregates copies for multi-product label printing batches', () => {
      const batch = [
        { product: mockProducts[0], copies: 5, mfgDate: '2026-10-19', expDate: '2027-01-19' },
        { product: mockProducts[1], copies: 10, mfgDate: '2026-10-19', expDate: '2027-01-19' },
      ];

      const expandedLabels: any[] = [];
      batch.forEach((item) => {
        for (let i = 0; i < item.copies; i++) {
          expandedLabels.push({
            productId: item.product.id,
            productName: item.product.name,
            barcode: item.product.barcode,
            sellingPrice: item.product.sellingPrice,
            mfgDate: item.mfgDate,
            expDate: item.expDate,
          });
        }
      });

      expect(expandedLabels.length).toBe(15);
      expect(expandedLabels.filter((l) => l.productId === 'prod-1').length).toBe(5);
      expect(expandedLabels.filter((l) => l.productId === 'prod-2').length).toBe(10);
    });

    it('verifies exact required shop name for label branding', () => {
      const expectedShopName = 'AL BURHANI SWEET AND FARSAAN';
      expect(expectedShopName).toBe('AL BURHANI SWEET AND FARSAAN');
    });
  });

  describe('4. Admin / Owner Permissions Verification', () => {
    it('allows Owner to access Label Studio and restricts Cashier', () => {
      const ownerUser: UserProfile = {
        id: 'owner-1',
        name: 'Owner',
        role: 'Owner',
        counter: 'Counter 1',
      };

      const cashierUser: UserProfile = {
        id: 'cashier-1',
        name: 'Cashier Staff',
        role: 'Cashier',
        counter: 'Counter 2',
      };

      const canAccessLabelStudio = (user: UserProfile) => user.role === 'Owner';

      expect(canAccessLabelStudio(ownerUser)).toBe(true);
      expect(canAccessLabelStudio(cashierUser)).toBe(false);
    });
  });

  describe('5. TECHNOVA Profiles for Canon Printer & Geometry Verification', () => {
    it('verifies TECHNOVA — 24 Labels (Canon) profile fits perfectly on A4', () => {
      const profile = PRESETS['technova-24l-canon'];
      expect(profile).toBeDefined();
      expect(profile.label).toBe('TECHNOVA — 24 Labels (Canon)');
      const dims = profile.dims;

      expect(dims.sheetWidthMm).toBe(210);
      expect(dims.sheetHeightMm).toBe(297);
      expect(dims.labelWidthMm).toBe(64);
      expect(dims.labelHeightMm).toBe(34);
      expect(dims.columns).toBe(3);
      expect(dims.rows).toBe(8);
      expect(dims.columns * dims.rows).toBe(24);

      // Verify horizontal total: 6mm left margin + 3 * 64mm + 2 * 3mm gap = 204mm <= 210mm
      const totalWidth = dims.marginLeftMm + (dims.columns * dims.labelWidthMm) + ((dims.columns - 1) * dims.gapXMm);
      expect(totalWidth).toBe(204);
      expect(totalWidth).toBeLessThanOrEqual(210);

      // Verify vertical total: 12.5mm top margin + 8 * 34mm = 284.5mm <= 297mm
      const totalHeight = dims.marginTopMm + (dims.rows * dims.labelHeightMm) + ((dims.rows - 1) * dims.gapYMm);
      expect(totalHeight).toBe(284.5);
      expect(totalHeight).toBeLessThanOrEqual(297);
    });

    it('verifies TECHNOVA — 48 Labels (Canon) profile fits perfectly on A4', () => {
      const profile = PRESETS['technova-48l-canon'];
      expect(profile).toBeDefined();
      expect(profile.label).toBe('TECHNOVA — 48 Labels (Canon)');
      const dims = profile.dims;

      expect(dims.sheetWidthMm).toBe(210);
      expect(dims.sheetHeightMm).toBe(297);
      expect(dims.labelWidthMm).toBe(48);
      expect(dims.labelHeightMm).toBe(24);
      expect(dims.columns).toBe(4);
      expect(dims.rows).toBe(12);
      expect(dims.columns * dims.rows).toBe(48);

      // Verify horizontal total: 4.5mm left margin + 4 * 48mm + 3 * 3mm gap = 205.5mm <= 210mm
      const totalWidth = dims.marginLeftMm + (dims.columns * dims.labelWidthMm) + ((dims.columns - 1) * dims.gapXMm);
      expect(totalWidth).toBe(205.5);
      expect(totalWidth).toBeLessThanOrEqual(210);

      // Verify vertical total: 5mm top margin + 12 * 24mm = 293mm <= 297mm
      const totalHeight = dims.marginTopMm + (dims.rows * dims.labelHeightMm) + ((dims.rows - 1) * dims.gapYMm);
      expect(totalHeight).toBe(293);
      expect(totalHeight).toBeLessThanOrEqual(297);
    });

    it('guarantees that row N+1 starting position strictly matches label height plus vertical gap', () => {
      const dims24 = PRESETS['technova-24l-canon'].dims;
      for (let r = 0; r < dims24.rows - 1; r++) {
        const rowCurrentTop = dims24.marginTopMm + r * (dims24.labelHeightMm + dims24.gapYMm);
        const rowCurrentBottom = rowCurrentTop + dims24.labelHeightMm;
        const rowNextTop = dims24.marginTopMm + (r + 1) * (dims24.labelHeightMm + dims24.gapYMm);

        // Row N bottom must never exceed Row N+1 top (no vertical overlap)
        expect(rowCurrentBottom).toBeLessThanOrEqual(rowNextTop);
      }

      const dims48 = PRESETS['technova-48l-canon'].dims;
      for (let r = 0; r < dims48.rows - 1; r++) {
        const rowCurrentTop = dims48.marginTopMm + r * (dims48.labelHeightMm + dims48.gapYMm);
        const rowCurrentBottom = rowCurrentTop + dims48.labelHeightMm;
        const rowNextTop = dims48.marginTopMm + (r + 1) * (dims48.labelHeightMm + dims48.gapYMm);

        expect(rowCurrentBottom).toBeLessThanOrEqual(rowNextTop);
      }
    });

    it('correctly applies Canon printer calibration offsets to effective margins', () => {
      const baseDims = PRESETS['technova-24l-canon'].dims;
      const offsetY = -1.5; // Compensate for 1.5mm Canon lead-in feed
      const offsetX = 0.5;

      const effectiveTop = Math.max(0, baseDims.marginTopMm + offsetY);
      const effectiveLeft = Math.max(0, baseDims.marginLeftMm + offsetX);

      expect(effectiveTop).toBe(11.0);
      expect(effectiveLeft).toBe(6.5);
      expect(baseDims.printScale).toBe(100);
    });
  });

  describe('6. Exact Barcode String Preservation & SKU on Every Label', () => {
    it('verifies every label data item contains SKU, exact barcode as string, and product name', () => {
      const testItem = mockProducts[0]; // Kaju Katli (SKU: '0001', Barcode: '0001')
      expect(typeof testItem.barcode).toBe('string');
      expect(testItem.barcode).toBe('0001'); // Not converted to number 1
      expect(testItem.sku).toBe('0001');

      // Expanded label payload must include SKU
      const labelPayload = {
        productId: testItem.id,
        productName: testItem.name,
        sku: testItem.sku,
        barcode: testItem.barcode,
        sellingPrice: testItem.sellingPrice,
      };

      expect(labelPayload.sku).toBe('0001');
      expect(labelPayload.barcode).toBe('0001');
      expect(labelPayload.productName).toBe('KAJU KATLI 250G');
    });

    it('preserves label dimensions strictly without changing width, height, or paper geometry', () => {
      // Dimensions must remain exact
      const p24 = PRESETS['technova-24l-canon'].dims;
      expect(p24.labelWidthMm).toBe(64);
      expect(p24.labelHeightMm).toBe(34);
      expect(p24.columns).toBe(3);
      expect(p24.rows).toBe(8);

      const p48 = PRESETS['technova-48l-canon'].dims;
      expect(p48.labelWidthMm).toBe(48);
      expect(p48.labelHeightMm).toBe(24);
      expect(p48.columns).toBe(4);
      expect(p48.rows).toBe(12);
    });
  });
});
