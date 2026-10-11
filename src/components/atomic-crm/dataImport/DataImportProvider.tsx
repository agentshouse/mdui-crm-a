/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNotify, useRefresh } from "ra-core";
import { usePapaParse } from "../misc/usePapaParse";
import { DataImportDialog, UNASSIGNED_IMPORT } from "./DataImportDialog";
import { DataImportProgressToast } from "./DataImportProgressToast";
import type { ImportableResource, ProcessImportBatch } from "./types";
import {
  useImportableResources,
  type ImportableResourceName,
} from "./useImportableResources";

type DataImportContextValue = {
  resources: ImportableResource[];
  isImporting: boolean;
  openDialog(resource?: ImportableResourceName): void;
};
const DataImportContext = createContext<DataImportContextValue | undefined>(
  undefined,
);
export const useDataImportContext = () => {
  const context = useContext(DataImportContext);
  if (!context)
    throw new Error(
      "useDataImportContext must be used inside a <DataImportProvider>",
    );
  return context;
};

export const DataImportProvider = ({ children }: { children: ReactNode }) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const [assignment, setAssignment] = useState("");
  const resources = useImportableResources(
    assignment && assignment !== UNASSIGNED_IMPORT ? assignment : null,
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [pinnedName, setPinnedName] = useState<ImportableResourceName | null>(
    null,
  );
  const [resourceName, setResourceName] =
    useState<ImportableResourceName | null>(null);
  const [starting, setStarting] = useState(false);
  const runPending = useRef(false);
  const runResource = useRef<ImportableResource | null>(null);
  const resource =
    resources.find(({ name }) => name === resourceName) ?? resources[0];
  // Capture this callback once per explicit Start. Re-renders, settings changes,
  // or a later assignment selection cannot change a run already in progress.
  const processBatch = useCallback<ProcessImportBatch>((batch) => {
    const selected = runResource.current;
    if (!selected)
      return Promise.reject(
        new Error("Choose a resource and assignment before importing."),
      );
    return selected.processBatch(batch);
  }, []);
  const { importer, parseCsv, reset, stop } = usePapaParse({
    batchSize: 1,
    textColumns: runPending.current
      ? runResource.current?.textColumns
      : resource?.textColumns,
    processBatch,
  });
  const isImporting =
    starting || importer.state === "parsing" || importer.state === "running";
  useEffect(() => {
    if (importer.state === "parsing" || importer.state === "running")
      setStarting(false);
    if (importer.state === "complete" || importer.state === "error") {
      runPending.current = false;
      setStarting(false);
      refresh();
    }
  }, [importer, refresh]);
  const openDialog = useCallback(
    (pinned?: ImportableResourceName) => {
      if (runPending.current || isImporting) return;
      if (importer.state === "complete" || importer.state === "error") reset();
      setAssignment("");
      setPinnedName(pinned ?? null);
      setResourceName(pinned ?? resources[0]?.name ?? null);
      setIsDialogOpen(true);
    },
    [importer.state, isImporting, reset, resources],
  );
  const startImport = (file: File) => {
    if (runPending.current || isImporting) return;
    if (!assignment || !resource || !/\.csv$/i.test(file.name)) {
      notify(
        "Choose a local CSV and explicitly assign a Room team label or leave records unassigned.",
        { type: "warning" },
      );
      return;
    }
    runPending.current = true;
    runResource.current = {
      ...resource,
      textColumns: resource.textColumns ? [...resource.textColumns] : undefined,
    };
    setStarting(true);
    parseCsv(file);
    setIsDialogOpen(false);
  };
  const value = useMemo(
    () => ({ resources, isImporting, openDialog }),
    [resources, isImporting, openDialog],
  );
  return (
    <DataImportContext.Provider value={value}>
      {children}
      {resource && (
        <DataImportDialog
          open={isDialogOpen}
          resources={
            pinnedName
              ? resources.filter(({ name }) => name === pinnedName)
              : resources
          }
          resource={resource}
          assignment={assignment}
          isImporting={isImporting}
          onAssignmentChange={(value) => {
            if (!runPending.current) setAssignment(value);
          }}
          onResourceChange={(name) => {
            if (!runPending.current) setResourceName(name);
          }}
          onStart={startImport}
          onClose={() => {
            if (!runPending.current) setIsDialogOpen(false);
          }}
        />
      )}
      <DataImportProgressToast
        importer={importer}
        onStop={stop}
        onDismiss={reset}
      />
    </DataImportContext.Provider>
  );
};
