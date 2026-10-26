import { Product } from '../types';
import rawData from './importedProducts.json';

export const IMPORTED_PRODUCTS: Product[] = rawData as Product[];

export interface ImportSummary {
  fileName: string;
  totalRows: number;
  importedCount: number;
  weightItemsCount: number;
  pieceItemsCount: number;
  withOriginalBarcodes: number;
  generatedBarcodesCount: number;
  duplicatesFound: number;
}

export const EXCEL_IMPORT_SUMMARY: ImportSummary = {
  fileName: 'al burhani new stock 27-10-2026.xlsx',
  totalRows: 343,
  importedCount: 342,
  weightItemsCount: 111,
  pieceItemsCount: 231,
  withOriginalBarcodes: 342,
  generatedBarcodesCount: 0,
  duplicatesFound: 0,
};
