import { AutocompleteInput, ReferenceInput } from "@/components/admin";
import type { Sale } from "../types";

export const TeamLabelInput = () => (
  <ReferenceInput
    source="sales_id"
    reference="sales"
    sort={{ field: "first_name", order: "ASC" }}
  >
    <AutocompleteInput
      label="Team label"
      helperText="Optional manual label"
      optionText={(sale: Sale) => `${sale.first_name} ${sale.last_name}`.trim()}
      clearable
      modal
    />
  </ReferenceInput>
);
