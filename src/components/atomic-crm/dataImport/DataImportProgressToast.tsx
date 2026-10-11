import { useEffect } from "react";
import { useTranslate } from "ra-core";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { ImportState } from "../misc/usePapaParse";

const TOAST_ID = "data-import-progress";
const NO_ROW_ERRORS: string[] = [];

export const DataImportProgressToast = ({
  importer,
  onStop,
  onDismiss,
}: {
  importer: ImportState;
  onStop(): void;
  onDismiss(): void;
}) => {
  const translate = useTranslate();
  const active = importer.state === "parsing" || importer.state === "running";
  const hasCounts = "rowCount" in importer;
  const rowCount = hasCounts ? importer.rowCount : 0;
  const importCount = hasCounts ? importer.importCount : 0;
  const errorCount = hasCounts ? importer.errorCount : 0;
  const rowErrors =
    "rowErrors" in importer ? importer.rowErrors : NO_ROW_ERRORS;
  const stopping = "stopping" in importer && importer.stopping;
  const stopped = "stopped" in importer && importer.stopped;
  const error = importer.state === "error" ? importer.error.message : "";
  const remainingTime =
    importer.state === "running" ? importer.remainingTime : null;
  const title =
    importer.state === "parsing"
      ? "Reading local CSV…"
      : stopping
        ? "Stopping after the current row…"
        : active
          ? "Queuing import to House…"
          : error
            ? "Import could not continue"
            : stopped
              ? "Import stopped"
              : "Import finished queuing";

  useEffect(
    () => () => {
      toast.dismiss(TOAST_ID);
    },
    [],
  );
  useEffect(() => {
    if (importer.state === "idle") {
      toast.dismiss(TOAST_ID);
      return;
    }
    toast.custom(
      () => (
        <div className="bg-popover text-popover-foreground flex w-full flex-col gap-2 rounded-md border p-4 shadow-lg">
          <div className="flex flex-row items-start justify-between gap-4">
            <p className="text-sm font-medium">{title}</p>
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={active ? onStop : onDismiss}
              disabled={stopping}
              className={
                active
                  ? "text-destructive h-auto p-0 text-xs"
                  : "h-auto p-0 text-xs"
              }
            >
              {active ? translate("crm.data_import.stop") : "Dismiss"}
            </Button>
          </div>
          {hasCounts && (
            <>
              <Progress
                value={
                  rowCount
                    ? Math.min(
                        100,
                        ((importCount + errorCount) / rowCount) * 100,
                      )
                    : 0
                }
                aria-label="CSV rows processed"
              />
              <p className="text-muted-foreground text-xs">
                {importCount} / {rowCount} records queued to House; {errorCount}{" "}
                rows need attention.
                {remainingTime !== null && !stopping && (
                  <>
                    {" "}
                    Estimated remaining time:{" "}
                    <strong>{millisecondsToTime(remainingTime)}</strong>.
                  </>
                )}
              </p>
            </>
          )}
          <p className="text-muted-foreground text-xs">
            Queued records may still be waiting to synchronize. Stopping does
            not undo records already queued.
          </p>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          {rowErrors.length > 0 && (
            <details open={!active} className="text-xs">
              <summary className="cursor-pointer text-destructive">
                View {rowErrors.length} import{" "}
                {rowErrors.length === 1 ? "issue" : "issues"}
              </summary>
              <ul className="mt-2 max-h-48 overflow-y-auto list-disc pl-4 space-y-1">
                {rowErrors.map((message, index) => (
                  <li key={index}>{message}</li>
                ))}
              </ul>
              <p className="mt-2">
                Related companies or tags may already be queued for a refused
                row. Review the Room before retrying.
              </p>
            </details>
          )}
        </div>
      ),
      { id: TOAST_ID, duration: Infinity, position: "bottom-right" },
    );
  }, [
    importer.state,
    active,
    hasCounts,
    importCount,
    rowCount,
    errorCount,
    rowErrors,
    remainingTime,
    stopping,
    title,
    error,
    translate,
    onStop,
    onDismiss,
  ]);
  return null;
};
const millisecondsToTime = (ms: number) =>
  `${Math.floor(ms / 60000)}m ${Math.floor((ms / 1000) % 60)}s`;
