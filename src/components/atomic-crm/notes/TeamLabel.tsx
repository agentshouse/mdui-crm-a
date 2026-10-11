import type { Identifier } from "ra-core";
import { useGetSalesName } from "../sales/useGetSalesName";

/** A manually selected Room label, not authenticated authorship. */
export const TeamLabel = ({ salesId }: { salesId?: Identifier | null }) => {
  const name = useGetSalesName(salesId ?? undefined);
  return (
    <span>
      Team: {name || (salesId == null ? "Unassigned" : "Unavailable")}
    </span>
  );
};
