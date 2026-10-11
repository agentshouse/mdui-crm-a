import type { DataProvider, RaRecord } from "ra-core";
import type { ConfigurationContextValue } from "../root/ConfigurationContext";
import type { LabeledValue } from "../types";
import { mapSizeToCategory } from "../companies/sizes";
import { toConfiguredValue, toIsoDate, toNumber, toText } from "./parseCell";
import type { ImportBatchResult, ImportCell, ImportRow } from "./types";
export type CsvResource = "contacts" | "companies" | "deals";
type Config = Pick<
  ConfigurationContextValue,
  "companySectors" | "dealCategories" | "dealStages"
>;
const errorText = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
function required(row: ImportRow, key: string) {
  const value = toText(row[key]);
  if (!value) throw new Error(`${key} is required.`);
  return value;
}
function option(value: ImportCell, options: LabeledValue[], label: string) {
  const text = toText(value);
  if (!text) return undefined;
  const matched = toConfiguredValue(value, options);
  if (matched === undefined)
    throw new Error(
      `Unknown ${label}: ${text}. Use a configured value or label.`,
    );
  return matched;
}
function number(value: ImportCell, label: string) {
  const text = toText(value);
  if (!text) return undefined;
  const result = toNumber(value);
  if (result === undefined || result < 0)
    throw new Error(`${label} must be a non-negative number.`);
  return result;
}
function timestamp(value: ImportCell, fallback: string) {
  const text = toText(value);
  if (!text) return fallback;
  const plain = toIsoDate(value);
  if (plain) return plain;
  if (
    !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(text) ||
    !toIsoDate(text.slice(0, 10)) ||
    !Number.isFinite(Date.parse(text))
  )
    throw new Error(
      "Dates must be valid YYYY-MM-DD or ISO timestamps with a timezone.",
    );
  return new Date(text).toISOString();
}
function boolean(value: ImportCell) {
  const text = toText(value)?.toLowerCase();
  if (!text) return false;
  if (["true", "yes", "1"].includes(text)) return true;
  if (["false", "no", "0"].includes(text)) return false;
  throw new Error("has_newsletter must be true or false.");
}
/** No identity lookup: the dialog must explicitly select an assignment. */
async function checkAssignment(provider: DataProvider, salesId: string | null) {
  if (salesId === null) return;
  if (typeof salesId !== "string" || !salesId.trim())
    throw new Error(
      "Choose an existing team label or explicitly leave records unassigned.",
    );
  const { data } = await provider.getOne("sales", { id: salesId });
  if (!data || data.disabled)
    throw new Error(
      "The selected team label is unavailable. Choose another label.",
    );
}
/** Resolve an exact name through House each time; never use stale cached data as a fallback. */
async function resolveName(
  provider: DataProvider,
  resource: "companies" | "tags",
  name: string,
  salesId: string | null,
): Promise<RaRecord> {
  const { data, total } = await provider.getList(resource, {
    filter: { name },
    pagination: { page: 1, perPage: 2 },
    sort: { field: "id", order: "ASC" },
  });
  if (data.length > 1 || (total ?? 0) > 1)
    throw new Error(
      `More than one ${resource} record is named “${name}”. Resolve the duplicate before importing.`,
    );
  if (data[0]) return data[0];
  const created = await provider.create(resource, {
    data:
      resource === "companies"
        ? { name, sales_id: salesId, created_at: new Date().toISOString() }
        : { name, color: "#f9f9f9" },
  });
  return created.data;
}
/** Adapted donor mappings. Related records are ordinary separate queued creates. */
export async function importRows(
  resource: CsvResource,
  rows: ImportRow[],
  provider: DataProvider,
  config: Config,
  salesId: string | null,
): Promise<ImportBatchResult> {
  const result: ImportBatchResult = { created: 0, errors: [] };
  for (const row of rows) {
    let relatedAttempted = false;
    try {
      const now = new Date().toISOString();
      for (const key of ["avatar", "logo", "attachments"])
        if (toText(row[key]))
          throw new Error(
            `CSV ${key} imports are unavailable. Upload files from the record editor after import; no URL is fetched.`,
          );
      for (const key of ["sales_id", "owner", "owner_id"])
        if (toText(row[key]))
          throw new Error(
            `CSV ${key} is not used for identity. Remove that column's values and choose an explicit team-label assignment in the dialog.`,
          );
      let data: Record<string, unknown>;
      if (resource === "companies") {
        const size = number(row.size, "size");
        data = {
          name: required(row, "name"),
          sector: option(row.sector, config.companySectors, "sector"),
          size: size === undefined ? undefined : mapSizeToCategory(size),
          created_at: now,
          sales_id: salesId,
        };
        for (const key of [
          "linkedin_url",
          "website",
          "phone_number",
          "address",
          "zipcode",
          "city",
          "state_abbr",
          "country",
          "description",
          "revenue",
          "tax_identifier",
        ])
          data[key] = toText(row[key]);
      } else if (resource === "contacts") {
        data = {
          first_name: required(row, "first_name"),
          last_name: required(row, "last_name"),
          first_seen: timestamp(row.first_seen, now),
          last_seen: timestamp(row.last_seen, now),
          has_newsletter: boolean(row.has_newsletter),
          sales_id: salesId,
        };
        for (const key of [
          "gender",
          "title",
          "background",
          "status",
          "linkedin_url",
        ])
          data[key] = toText(row[key]);
        data.email_jsonb = ["work", "home", "other"].flatMap((type) => {
          const email = toText(row[`email_${type}`]);
          return email
            ? [{ email, type: type[0].toUpperCase() + type.slice(1) }]
            : [];
        });
        data.phone_jsonb = ["work", "home", "other"].flatMap((type) => {
          const phone = toText(row[`phone_${type}`]);
          return phone
            ? [{ number: phone, type: type[0].toUpperCase() + type.slice(1) }]
            : [];
        });
      } else {
        const stage =
          option(row.stage, config.dealStages, "deal stage") ??
          config.dealStages[0]?.value;
        if (!stage)
          throw new Error("Configure a deal stage before importing deals.");
        required(row, "company");
        const date = toText(row.expected_closing_date);
        if (date && !toIsoDate(row.expected_closing_date))
          throw new Error(
            "expected_closing_date must be a valid YYYY-MM-DD date.",
          );
        data = {
          name: required(row, "name"),
          stage,
          category: option(
            row.category,
            config.dealCategories,
            "deal category",
          ),
          description: toText(row.description),
          amount: number(row.amount, "amount") ?? 0,
          expected_closing_date: toIsoDate(row.expected_closing_date),
          contact_ids: [],
          sales_id: salesId,
          created_at: now,
          updated_at: now,
        };
        // Omit index: the House provider chooses the current end of the stage in
        // its serialized create, rather than an index read by a stale CSV batch.
      }
      // Validate all portable fields before creating any related records.
      await checkAssignment(provider, salesId);
      if (resource !== "companies") {
        const companyName = toText(row.company);
        if (companyName) {
          relatedAttempted = true;
          data.company_id = (
            await resolveName(provider, "companies", companyName, salesId)
          ).id;
        }
        if (resource === "contacts") {
          const tags = [
            ...new Set(
              (toText(row.tags) ?? "")
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean),
            ),
          ];
          data.tags = [];
          for (const name of tags) {
            relatedAttempted = true;
            (data.tags as unknown[]).push(
              (await resolveName(provider, "tags", name, salesId)).id,
            );
          }
        }
      }
      await provider.create(resource, { data });
      result.created++;
    } catch (error) {
      result.errors.push(
        `${errorText(error)}${relatedAttempted ? " Related company/tag records or Room drafts may already be queued; inspect the Room before retrying." : ""}`,
      );
      break;
    }
  }
  return result;
}
