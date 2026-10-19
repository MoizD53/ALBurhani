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
  fileName: 'al burhani stock - Copy.xlsx',
  totalRows: 304,
  importedCount: 305,
  weightItemsCount: 98,
  pieceItemsCount: 207,
  withOriginalBarcodes: 292,
  generatedBarcodesCount: 13,
  duplicatesFound: 0,
};
