import type { ImportableResourceName } from "./useImportableResources";

/** Local CSV cells after parsing; identifier-like columns remain text. */
export type ImportCell = string | number | boolean | null;
export type ImportRow = Record<string, ImportCell>;

/** A receipt counts queued records, never synchronization completion. */
export type ImportBatchResult = { created: number; errors: string[] };
export type ProcessImportBatch = (
  batch: ImportRow[],
) => Promise<ImportBatchResult>;

export type ImportableResource = {
  name: ImportableResourceName;
  sampleCsv: string;
  textColumns?: string[];
  processBatch: ProcessImportBatch;
};
