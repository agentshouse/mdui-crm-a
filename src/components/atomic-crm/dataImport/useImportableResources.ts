import { useResourceDefinitions } from "ra-core";
import { useContactImport } from "../contacts/useContactImport";
import companiesSampleCsv from "./companies_sample.csv?raw";
import dealsSampleCsv from "./deals_sample.csv?raw";
import contactsSampleCsv from "../contacts/contacts_export.csv?raw";
import type { ImportableResource } from "./types";
import { useCompanyImport } from "./useCompanyImport";
import { useDealImport } from "./useDealImport";

export const IMPORTABLE_RESOURCES = ["contacts", "companies", "deals"] as const;
export type ImportableResourceName = (typeof IMPORTABLE_RESOURCES)[number];

/** Assignment is an explicit Room label choice, never an authenticated user. */
export function useImportableResources(
  salesId: string | null,
): ImportableResource[] {
  const processContacts = useContactImport(salesId);
  const processCompanies = useCompanyImport(salesId);
  const processDeals = useDealImport(salesId);
  const definitions = useResourceDefinitions();
  const resources: ImportableResource[] = [
    {
      name: "contacts",
      sampleCsv: contactsSampleCsv,
      textColumns: ["phone_work", "phone_home", "phone_other"],
      processBatch: processContacts,
    },
    {
      name: "companies",
      sampleCsv: companiesSampleCsv,
      textColumns: ["zipcode", "phone_number", "tax_identifier"],
      processBatch: processCompanies,
    },
    { name: "deals", sampleCsv: dealsSampleCsv, processBatch: processDeals },
  ];
  return resources.filter(({ name }) => name in definitions);
}
