import { useCallback } from "react";
import { useDataProvider } from "ra-core";
import { useConfigurationContext } from "../root/ConfigurationContext";
import { importRows } from "./localImport";
import type { ProcessImportBatch } from "./types";
export function useCompanyImport(salesId: string | null): ProcessImportBatch {
  const provider = useDataProvider();
  const config = useConfigurationContext();
  return useCallback(
    (batch) => importRows("companies", batch, provider, config, salesId),
    [provider, config, salesId],
  );
}
