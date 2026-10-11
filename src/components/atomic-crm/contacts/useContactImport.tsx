import { useCallback } from "react";
import { useDataProvider } from "ra-core";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { importRows } from "../dataImport/localImport";
import type { ImportRow, ProcessImportBatch } from "../dataImport/types";
export type ContactImportSchema = ImportRow;
export function useContactImport(salesId: string | null): ProcessImportBatch {
  const provider = useDataProvider();
  const config = useConfigurationContext();
  return useCallback(
    (batch) => importRows("contacts", batch, provider, config, salesId),
    [provider, config, salesId],
  );
}
