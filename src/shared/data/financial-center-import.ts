import type { TransactionType } from '@/core/entities/category';

export const CENTER_IMPORT_MAX_BYTES = 2 * 1024 * 1024;
export const CENTER_IMPORT_MAX_ROWS = 5000;
export type CenterImportMode = TransactionType | 'BOTH';

export interface CenterImportRow {
  sheet: string;
  line: number;
  name: string;
  type: TransactionType;
  status: 'new' | 'existing' | 'duplicate';
}

export interface CenterImportIssue { sheet: string; line: number; message: string }
export interface CenterImportPlan {
  sheets: string[];
  selectedSheets: string[];
  rows: CenterImportRow[];
  issues: CenterImportIssue[];
  sourceRows: number;
  newCount: number;
  existingCount: number;
  duplicateCount: number;
}

export interface CenterImportPreview extends CenterImportPlan {
  companyId: string;
  companyName: string;
  fingerprint: string;
}
