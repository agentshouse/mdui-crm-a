import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MAX_CSV_BYTES, parseLocalCsv } from "./localCsv";
import type { ImportBatchResult, ImportRow } from "../dataImport/types";
type Progress = {
  rowCount: number;
  importCount: number;
  errorCount: number;
  rowErrors: string[];
  remainingTime: number | null;
  stopping: boolean;
  stopped: boolean;
};
export type ImportState =
  | { state: "idle" }
  | { state: "parsing"; stopping?: boolean }
  | ({ state: "running" | "complete" } & Progress)
  | ({ state: "error"; error: Error } & Progress);
type Options<T> = {
  batchSize?: number;
  textColumns?: string[];
  processBatch(batch: T[]): Promise<ImportBatchResult>;
};
export function usePapaParse<T extends ImportRow>({
  processBatch,
}: Options<T>) {
  const [importer, setImporter] = useState<ImportState>({ state: "idle" });
  const active = useRef(false);
  const cancelled = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancelled.current = true;
    };
  }, []);
  const publish = useCallback((state: ImportState) => {
    if (mounted.current) setImporter(state);
  }, []);
  const stop = useCallback(() => {
    cancelled.current = true;
    if (mounted.current)
      setImporter((state) =>
        state.state === "running" || state.state === "parsing"
          ? { ...state, stopping: true }
          : state,
      );
  }, []);
  const reset = useCallback(() => {
    if (active.current) {
      stop();
      return;
    }
    cancelled.current = false;
    publish({ state: "idle" });
  }, [publish, stop]);
  const parseCsv = useCallback(
    async (file: File) => {
      if (active.current) return;
      active.current = true;
      cancelled.current = false;
      publish({ state: "parsing" });
      const progress: Progress = {
        rowCount: 0,
        importCount: 0,
        errorCount: 0,
        rowErrors: [],
        remainingTime: null,
        stopping: false,
        stopped: false,
      };
      try {
        if (!(file instanceof File))
          throw new Error("Choose a local CSV file.");
        if (file.size > MAX_CSV_BYTES)
          throw new Error("Choose a CSV file no larger than 5 MiB.");
        const rows = parseLocalCsv(await file.text()) as T[];
        progress.rowCount = rows.length;
        const start = Date.now();
        for (let i = 0; i < rows.length; i++) {
          if (cancelled.current || !mounted.current) break;
          publish({ state: "running", ...progress, stopping: false });
          try {
            // One row at a time: stopping drains only the already-started operation.
            const result = await processBatch([rows[i]]);
            if (
              !Number.isInteger(result.created) ||
              result.created < 0 ||
              result.created > 1 ||
              !Array.isArray(result.errors)
            )
              throw new Error("Import handler returned an invalid result.");
            progress.importCount += result.created;
            progress.errorCount += 1 - result.created;
            progress.rowErrors.push(
              ...result.errors.map((error) => `Row ${i + 2}: ${error}`),
            );
          } catch (error) {
            progress.errorCount++;
            progress.rowErrors.push(
              `Row ${i + 2}: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
          progress.stopping = cancelled.current;
          progress.remainingTime =
            ((Date.now() - start) / (i + 1)) * (rows.length - i - 1);
          publish({
            state: "running",
            ...progress,
            rowErrors: [...progress.rowErrors],
          });
          // A refusal may leave Room drafts/related records. Pause instead of hiding
          // the failure among later writes or automatically retrying any row.
          if (progress.errorCount > 0) {
            cancelled.current = true;
            break;
          }
        }
        progress.stopped = cancelled.current;
        progress.stopping = false;
        progress.remainingTime = null;
        publish({
          state: "complete",
          ...progress,
          rowErrors: [...progress.rowErrors],
        });
      } catch (error) {
        publish({
          state: "error",
          ...progress,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      } finally {
        active.current = false;
      }
    },
    [processBatch, publish],
  );
  return useMemo(
    () => ({ importer, parseCsv, reset, stop }),
    [importer, parseCsv, reset, stop],
  );
}
