import { toSlug } from "./lib/toSlug";
import { BusinessDraft } from "./business-draft";
import { mergeDraftParts, type RoomDraft } from "./draft-session";
import { houseBridge } from "@agentshouse/app-bridge";
import type { DataProvider, Identifier, RaRecord } from "ra-core";
import type { ConfigurationContextValue } from "./components/atomic-crm/root/ConfigurationContext";
import type { Contact, Deal } from "./components/atomic-crm/types";

// The sole bridge/Runtime boundary. All records live in the selected House Room.
export type HouseRuntime = Awaited<ReturnType<typeof houseBridge>["runtime"]>;
export type HouseRoom = Awaited<ReturnType<HouseRuntime["rooms"]>>[number];
export type MutationStatus = {
  phase: "saving" | "queued" | "error" | "idle";
  message: string;
  identifier?: string;
};
export type QueuedWrite = { outcome: "queued"; identifier: string };
/** Persist only this Room attachment descriptor; object URLs remain UI-only. */
export type HouseAttachment = {
  attachment_ref: string;
  title: string;
  type: string;
  size?: number;
  sha256?: string;
};
export type AttachmentRead = {
  blob: Blob | null;
  name: string;
  type: string | null;
  status: "available" | "not_saved" | "unavailable";
};
type Row = RaRecord & Record<string, any>;
type Document = {
  room: string;
  path: string;
  type?: string;
  fields?: Readonly<Record<string, unknown>>;
  markdown?: string;
};
type Snapshot = {
  room: string;
  path: string;
  type: string;
  fields: Readonly<Record<string, unknown>>;
  markdown?: string;
};
type Change = {
  path: string;
  parts: Parameters<HouseRuntime["roomDraft"]["write"]>[3];
};
type FieldKind = "string" | "number" | "boolean" | "array" | "object";
const definitions = {
  companies: {
    type: "crm_company",
    string:
      "id name sector linkedin_url website phone_number address zipcode city state_abbr sales_id created_at description revenue tax_identifier country",
    number: "size",
    object: "logo",
    array: "context_links",
    required: "id name created_at",
  },
  contacts: {
    type: "crm_contact",
    string:
      "id first_name last_name title company_id linkedin_url first_seen last_seen gender sales_id status background",
    boolean: "has_newsletter",
    object: "avatar",
    array: "email_jsonb phone_jsonb tags",
    required: "id first_name last_name first_seen last_seen",
  },
  deals: {
    type: "crm_deal",
    string:
      "id name company_id category stage description created_at updated_at archived_at expected_closing_date sales_id",
    number: "amount index",
    array: "contact_ids",
    required: "id name company_id stage created_at updated_at amount index",
  },
  tasks: {
    type: "crm_task",
    string: "id contact_id type text due_date done_date sales_id",
    required: "id contact_id text due_date",
  },
  contact_notes: {
    type: "crm_contact_note",
    string: "id contact_id text date sales_id status",
    array: "attachments",
    required: "id contact_id date",
  },
  deal_notes: {
    type: "crm_deal_note",
    string: "id deal_id text date sales_id",
    array: "attachments",
    required: "id deal_id date",
  },
  sales: {
    type: "crm_sale",
    string: "id first_name last_name email",
    boolean: "administrator disabled",
    object: "avatar",
    array: "secondary_emails",
    required: "id first_name last_name",
  },
  tags: { type: "crm_tag", string: "id name color", required: "id name color" },
  configuration: {
    type: "crm_configuration",
    string: "id",
    object: "config",
    required: "id config",
  },
} as const;
export type CrmResource = keyof typeof definitions;
type Database = Record<CrmResource, Row[]>;
const resources = Object.keys(definitions) as CrmResource[];
const kinds: FieldKind[] = ["string", "number", "boolean", "array", "object"];
const computed = new Set([
  "_house",
  "nb_contacts",
  "nb_deals",
  "nb_tasks",
  "company_name",
  "email_fts",
  "phone_fts",
]);
const definition = (resource: CrmResource) =>
  definitions[resource] as { type: string; required: string } & Partial<
    Record<FieldKind, string>
  >;
const fieldsFor = (resource: CrmResource) =>
  Object.fromEntries(
    kinds.flatMap((kind) =>
      (definition(resource)[kind]?.split(" ") ?? []).map((key) => [key, kind]),
    ),
  ) as Record<string, FieldKind>;
function canonicalResource(resource: string): CrmResource {
  const key = resource.replace(/_summary$/, "");
  if (!resources.includes(key as CrmResource))
    throw new Error(`Unsupported CRM resource: ${resource}.`);
  return key as CrmResource;
}
const equal = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
const idEqual = (a: unknown, b: unknown) =>
  a != null && b != null && String(a) === String(b);
const empty = (value: unknown) => value == null || value === "";
function validId(value: unknown): string {
  if (
    (typeof value !== "string" && typeof value !== "number") ||
    !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(String(value))
  )
    throw new Error(
      "CRM IDs must contain only letters, numbers, underscores, and hyphens.",
    );
  return String(value);
}

let connection: Promise<HouseRuntime> | undefined;
export function houseRuntime(): Promise<HouseRuntime> {
  connection ??= (async () => {
    const bridge = houseBridge();
    if (!bridge) throw new Error("house_bridge_absent");
    bridge.setTab({ title: "CRM" });
    return bridge.runtime;
  })().catch((error: unknown) => {
    connection = undefined;
    throw error;
  });
  return connection;
}
export const crmQuery = {
  types: resources.map((resource) => definitions[resource].type),
  select: { fields: "all" as const, markdown: true as const },
  orderBy: [{ by: "path" as const, direction: "asc" as const }],
};
export const listRooms = (md: HouseRuntime) => md.rooms();
export const observeCrm = (md: HouseRuntime, room: string) =>
  md.observe("query", { ...crmQuery, rooms: [room] });
export const observeRooms = (md: HouseRuntime) => md.observe("rooms");
export const observeSyncStatus = (md: HouseRuntime) =>
  md.observe("sync-status");
export const observeRoomDrafts = (md: HouseRuntime) =>
  md.observe("room-drafts");
export const observeStorageLoss = (md: HouseRuntime) =>
  md.observe("storage-loss");
export const observeConnectionRefusal = (md: HouseRuntime) =>
  md.observe("connection-refusal");
export const observeServiceMode = (md: HouseRuntime) =>
  md.observe("service-mode");
export const observeQueue = (md: HouseRuntime, room: string) =>
  md.observe("queue", room);

export class HouseWriteError extends Error {
  readonly details: unknown;
  constructor(message: string, details: unknown = null) {
    super(message, { cause: details });
    this.name = "HouseWriteError";
    this.details = details;
  }
}
function refused(message: string, details: unknown = null): never {
  throw new HouseWriteError(message, details);
}
// Markdown reserves `type` for the document kind; the donor task subtype uses task_type.
const storedKey = (resource: CrmResource, key: string) =>
  resource === "tasks" && key === "type" ? "task_type" : key;
function storedValue(kind: FieldKind, value: unknown): unknown {
  // MD Model optional fields may be absent, but typed YAML null is invalid.
  if (value == null) {
    if (kind === "string") return "";
    if (kind === "array" || kind === "object") return "null";
    return refused(
      "Clearing a numeric or boolean field is not supported by this Room model.",
    );
  }
  if (kind === "boolean") return String(value);
  if (kind === "array" || kind === "object") return JSON.stringify(value);
  return value;
}
function attachmentRef(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("at_") ||
    value.length <= 3 ||
    /[\s/\\]/.test(value)
  )
    refused("Expected a House at_ attachment reference for this Room.");
  return value;
}
function validateAttachment(value: unknown): asserts value is HouseAttachment {
  if (!value || typeof value !== "object" || Array.isArray(value))
    refused("Invalid House attachment descriptor.");
  const asset = value as Record<string, unknown>;
  const allowed = new Set([
    "attachment_ref",
    "title",
    "type",
    "size",
    "sha256",
  ]);
  if (Object.keys(asset).some((key) => !allowed.has(key)))
    refused(
      "Images and attachments must use a House Room reference, without URLs, raw files, or embedded data.",
    );
  attachmentRef(asset.attachment_ref);
  if (
    typeof asset.title !== "string" ||
    !asset.title.trim() ||
    typeof asset.type !== "string" ||
    !asset.type.trim()
  )
    refused("Attachment title and media type are required.");
  if (
    asset.size !== undefined &&
    (typeof asset.size !== "number" ||
      !Number.isSafeInteger(asset.size) ||
      asset.size < 0)
  )
    refused("Invalid attachment size.");
  if (
    asset.sha256 !== undefined &&
    (typeof asset.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(asset.sha256))
  )
    refused("Invalid attachment SHA-256 digest.");
}
async function attachmentDigest(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await blob.arrayBuffer(),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
async function attachmentUploadInput(file: File, room: string) {
  if (!(file instanceof File) || !file.name.trim())
    refused("Choose a named file to upload.");
  return {
    room_ref: room,
    version: crypto.randomUUID(),
    name: file.name,
    bytes: file.size,
    sha256: await attachmentDigest(file),
    media_type: file.type || "application/octet-stream",
    blob: file,
  };
}
function actionValue(
  action: string,
  response: Awaited<ReturnType<HouseRuntime["call"]>>,
): unknown {
  if (!response || response.kind !== "action") {
    const detail = JSON.stringify(response) ?? String(response);
    refused(`House ${action} did not complete: ${detail}`, response);
  }
  return response.result;
}
type AttachmentRecord = {
  original: unknown;
  version: string;
  attachment: string;
  name: string;
  bytes: number;
  sha256: string;
  media_type: string | null;
  save: { status: "pending" | "saved" | "failed"; failure: string | null };
  storage: { provider: "house" | "connected"; scope: string };
  read?: { status: AttachmentRead["status"] };
  blob?: Blob;
};
function objectResult(value: unknown, label: string): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    value instanceof Blob
  )
    refused(`Unsupported ${label} result shape.`, value);
  return value as Record<string, unknown>;
}
function exactKeys(
  value: Record<string, unknown>,
  allowed: string[],
  required: string[],
  label: string,
) {
  if (
    Object.keys(value).some((key) => !allowed.includes(key)) ||
    required.some((key) => !Object.hasOwn(value, key))
  )
    refused(`Unsupported ${label} result keys.`, value);
}
function uploadFailure(value: Record<string, unknown>) {
  if (Object.hasOwn(value, "upload_failure"))
    refused(
      `House attachment upload failed: ${JSON.stringify(value.upload_failure)}`,
      value,
    );
}
function attachmentRecord(
  value: unknown,
  room: string,
  allowRead: boolean,
): AttachmentRecord {
  const record = objectResult(value, "attachment");
  uploadFailure(record);
  const required = [
    "original",
    "version",
    "attachment",
    "name",
    "bytes",
    "sha256",
    "media_type",
    "save",
    "storage",
  ];
  exactKeys(
    record,
    [...required, ...(allowRead ? ["read", "blob"] : [])],
    required,
    "attachment",
  );
  attachmentRef(record.attachment);
  if (
    typeof record.version !== "string" ||
    !record.version ||
    typeof record.name !== "string" ||
    !record.name ||
    typeof record.bytes !== "number" ||
    !Number.isSafeInteger(record.bytes) ||
    record.bytes < 0 ||
    typeof record.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(record.sha256) ||
    (record.media_type !== null && typeof record.media_type !== "string")
  )
    refused("Unsupported attachment metadata shape.", record);
  const save = objectResult(record.save, "attachment save");
  exactKeys(
    save,
    ["status", "failure"],
    ["status", "failure"],
    "attachment save",
  );
  if (
    !["pending", "saved", "failed"].includes(String(save.status)) ||
    (save.failure !== null && typeof save.failure !== "string")
  )
    refused("Unsupported attachment save state.", record);
  if (save.status === "failed")
    refused(
      `House attachment save failed: ${JSON.stringify(save.failure)}`,
      record,
    );
  const storage = objectResult(record.storage, "attachment storage");
  exactKeys(
    storage,
    ["provider", "scope"],
    ["provider", "scope"],
    "attachment storage",
  );
  if (
    !["house", "connected"].includes(String(storage.provider)) ||
    storage.scope !== room
  )
    refused("This attachment is not bound to the selected House Room.", record);
  if (record.read !== undefined) {
    const read = objectResult(record.read, "attachment read");
    exactKeys(read, ["status"], ["status"], "attachment read");
    if (
      !["available", "not_saved", "unavailable"].includes(String(read.status))
    )
      refused("Unsupported attachment read state.", record);
  }
  if (record.blob !== undefined && !(record.blob instanceof Blob))
    refused(
      "Unsupported attachment bytes; Runtime must return a Blob.",
      record,
    );
  return record as unknown as AttachmentRecord;
}
function uploadedAttachment(
  value: unknown,
  room: string,
): { reference: string; pending: boolean | null; metadata?: AttachmentRecord } {
  const record = objectResult(value, "attachment upload");
  uploadFailure(record);
  if (Object.keys(record).length === 1 && Object.hasOwn(record, "attachment"))
    return { reference: attachmentRef(record.attachment), pending: null };
  const full = attachmentRecord(record, room, false);
  return {
    reference: full.attachment,
    pending: full.save.status === "pending",
    metadata: full,
  };
}
function changedAttachments(changes: (Change | null)[]): HouseAttachment[] {
  const attachments: HouseAttachment[] = [];
  for (const change of changes) {
    if (!change) continue;
    const creation = change.parts.creation;
    for (const key of ["logo", "avatar", "attachments"]) {
      const value =
        creation && "fields" in creation
          ? creation.fields[key]
          : change.parts.fields?.[key]?.value;
      if (value == null) continue;
      if (typeof value !== "string")
        refused("Invalid stored attachment encoding.");
      let decoded: unknown;
      try {
        decoded = JSON.parse(value);
      } catch {
        return refused("Invalid stored attachment JSON.");
      }
      const entries =
        key === "attachments" ? (decoded ?? []) : decoded ? [decoded] : [];
      if (!Array.isArray(entries))
        refused("Invalid stored attachments collection.");
      for (const asset of entries) {
        validateAttachment(asset);
        attachments.push(asset);
      }
    }
  }
  return attachments;
}

function validate(resource: CrmResource, input: Row, partial = false): Row {
  const fields = fieldsFor(resource);
  const row: Row = { id: validId(input.id) };
  for (const [key, value] of Object.entries(input)) {
    if (computed.has(key) || value === undefined || key === "id") continue;
    const kind = fields[key];
    if (!kind)
      refused(`The ${resource} field “${key}” is unsupported.`, { key });
    if (value === null) {
      row[key] = null;
      continue;
    }
    if (key.endsWith("_id")) {
      row[key] = empty(value) ? null : validId(value);
      continue;
    }
    if (
      kind === "array"
        ? !Array.isArray(value)
        : kind === "object"
          ? typeof value !== "object" || Array.isArray(value)
          : typeof value !== kind
    )
      refused(`Invalid ${key}: expected ${kind}.`);
    if (kind === "number" && !Number.isFinite(value))
      refused(`${key} must be a finite number.`);
    if (
      (kind === "object" || kind === "array") &&
      /"rawFile"\s*:/.test(JSON.stringify(value))
    )
      refused(
        "Upload files through House before saving this form. Raw files cannot be stored in CRM documents.",
      );
    if (key === "avatar" || key === "logo") {
      // Earlier synthetic fixtures used {} for an absent image; normalize it.
      if (Object.keys(value as object).length === 0) {
        row[key] = null;
        continue;
      }
      validateAttachment(value);
    }
    if (key === "attachments")
      for (const attachment of value as unknown[])
        validateAttachment(attachment);
    row[key] = ["contact_ids", "tags"].includes(key)
      ? (value as unknown[]).map(validId)
      : value;
  }
  if (!partial) {
    for (const key of definition(resource).required.split(" "))
      if (empty(row[key])) refused(`${key.replaceAll("_", " ")} is required.`);
    if (
      resource === "contacts" &&
      !`${row.first_name ?? ""}${row.last_name ?? ""}`.trim()
    )
      refused("A contact needs a name.");
    if (
      (resource === "contact_notes" || resource === "deal_notes") &&
      !String(row.text ?? "").trim() &&
      !(row.attachments?.length > 0)
    )
      refused("A note needs text or at least one uploaded attachment.");
    if (resource === "deals" && (row.amount < 0 || row.index < 0))
      refused("Deal amount and order must be non-negative.");
  }
  for (const [key, value] of Object.entries(row)) {
    if (
      value &&
      (key.endsWith("_date") ||
        [
          "created_at",
          "updated_at",
          "archived_at",
          "first_seen",
          "last_seen",
          "date",
        ].includes(key)) &&
      !Number.isFinite(Date.parse(String(value)))
    )
      refused(`${key} must be a valid date.`);
  }
  return row;
}
function encode(resource: CrmResource, row: Row): Record<string, unknown> {
  const fields = fieldsFor(resource);
  return Object.fromEntries(
    Object.entries(validate(resource, row))
      .filter(([, value]) => value != null)
      .map(([key, value]) => [
        storedKey(resource, key),
        storedValue(fields[key], value),
      ]),
  );
}
export function readCrm(
  result: { documents: readonly Document[] },
  room: string,
): Database {
  const db = Object.fromEntries(
    resources.map((resource) => [resource, []]),
  ) as unknown as Database;
  const seen = new Set<string>();
  for (const document of result.documents) {
    if (document.room !== room)
      refused("House returned a document outside the selected Room.");
    const resource = resources.find(
      (key) => definitions[key].type === document.type,
    );
    if (!resource) refused(`Unsupported CRM document at ${document.path}.`);
    const fields = { ...document.fields };
    const row: Row = { id: validId(fields.id) };
    for (const [key, kind] of Object.entries(fieldsFor(resource))) {
      const storageName = storedKey(resource, key);
      if (!Object.hasOwn(fields, storageName)) continue;
      let value = fields[storageName];
      if (value === null)
        refused(
          `Stored ${key} contains an invalid typed null. Resolve it in House.`,
          document,
        );
      if (value != null && kind === "boolean") {
        if (value !== "true" && value !== "false")
          refused(`Stored ${key} must be true or false.`, document);
        value = value === "true";
      } else if (value != null && (kind === "array" || kind === "object")) {
        if (typeof value !== "string")
          refused(`Stored ${key} must be a JSON string.`, document);
        try {
          value = JSON.parse(value);
        } catch {
          refused(`Stored ${key} contains invalid JSON.`, document);
        }
      }
      row[key] = value;
    }
    const validated = validate(resource, row);
    const key = `${resource}/${row.id}`;
    if (seen.has(key))
      refused(
        `Duplicate ${resource} ID ${row.id}. Resolve the duplicate in House.`,
      );
    seen.add(key);
    validated._house = {
      room,
      path: document.path,
      type: definitions[resource].type,
      fields,
      markdown: document.markdown,
    } satisfies Snapshot;
    db[resource].push(validated);
  }
  validateReferences(db);
  return db;
}
function validateReferences(db: Database): void {
  const exists = (resource: CrmResource, id: unknown) =>
    empty(id) || db[resource].some((row) => idEqual(row.id, id));
  for (const resource of resources)
    for (const row of db[resource]) {
      for (const [field, target] of [
        ["company_id", "companies"],
        ["contact_id", "contacts"],
        ["deal_id", "deals"],
        ["sales_id", "sales"],
      ] as const) {
        if (!exists(target, row[field]))
          refused(
            `${resource} ${row.id} refers to a missing ${target} record. Restore it or resolve the reference in House.`,
          );
      }
      for (const id of row.contact_ids ?? [])
        if (!exists("contacts", id))
          refused(`Deal ${row.id} refers to a missing contact.`);
      for (const id of row.tags ?? [])
        if (!exists("tags", id))
          refused(`Contact ${row.id} refers to a missing tag.`);
    }
}
function decorated(resource: string, db: Database): Row[] {
  if (resource === "activity_log") {
    return [
      ...db.companies.map((company) => ({
        id: `company.${company.id}.created`,
        type: "company.created",
        company_id: company.id,
        company,
        sales_id: company.sales_id,
        date: company.created_at,
      })),
      ...db.contacts.map((contact) => ({
        id: `contact.${contact.id}.created`,
        type: "contact.created",
        company_id: contact.company_id,
        contact,
        sales_id: contact.sales_id,
        date: contact.first_seen,
      })),
      ...db.deals.map((deal) => ({
        id: `deal.${deal.id}.created`,
        type: "deal.created",
        company_id: deal.company_id,
        deal,
        sales_id: deal.sales_id,
        date: deal.created_at,
      })),
      ...db.contact_notes.map((contactNote) => ({
        id: `contactNote.${contactNote.id}.created`,
        type: "contactNote.created",
        company_id: db.contacts.find((row) =>
          idEqual(row.id, contactNote.contact_id),
        )?.company_id,
        contactNote,
        sales_id: contactNote.sales_id,
        date: contactNote.date,
      })),
      ...db.deal_notes.map((dealNote) => ({
        id: `dealNote.${dealNote.id}.created`,
        type: "dealNote.created",
        company_id: db.deals.find((row) => idEqual(row.id, dealNote.deal_id))
          ?.company_id,
        dealNote,
        sales_id: dealNote.sales_id,
        date: dealNote.date,
      })),
    ];
  }
  const key = canonicalResource(resource);
  return db[key].map((row) =>
    key === "companies"
      ? {
          ...row,
          nb_contacts: db.contacts.filter((contact) =>
            idEqual(contact.company_id, row.id),
          ).length,
          nb_deals: db.deals.filter((deal) => idEqual(deal.company_id, row.id))
            .length,
        }
      : key === "contacts"
        ? {
            ...row,
            email_jsonb: row.email_jsonb ?? [],
            phone_jsonb: row.phone_jsonb ?? [],
            tags: row.tags ?? [],
            has_newsletter: row.has_newsletter ?? false,
            nb_tasks: db.tasks.filter(
              (task) =>
                idEqual(task.contact_id, row.id) && empty(task.done_date),
            ).length,
            company_name:
              db.companies.find((company) =>
                idEqual(company.id, row.company_id),
              )?.name ?? "",
            email_fts: (row.email_jsonb ?? [])
              .map((email: Row) => email.email)
              .join(" "),
            phone_fts: (row.phone_jsonb ?? [])
              .map((phone: Row) => phone.number)
              .join(" "),
          }
        : row,
  );
}
function listValues(
  value: unknown,
  opening: string,
  closing: string,
): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (
    typeof value !== "string" ||
    !value.startsWith(opening) ||
    !value.endsWith(closing)
  )
    refused(`Invalid list filter; expected ${opening}values${closing}.`);
  const text = value.slice(1, -1);
  if (!text) return [];
  const result: string[] = [];
  let item = "";
  let quoted = false;
  let escaped = false;
  for (const character of text) {
    if (escaped) {
      item += character;
      escaped = false;
    } else if (character === "\\" && quoted) escaped = true;
    else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) {
      result.push(item.trim());
      item = "";
    } else item += character;
  }
  if (quoted || escaped) refused("Invalid quoted list filter.");
  result.push(item.trim());
  return result;
}
export function matchesFilter(
  row: Row,
  filter: Record<string, unknown> = {},
): boolean {
  return Object.entries(filter).every(([key, expected]) => {
    if (expected === undefined || expected === "") return true;
    if (key === "@or" || key === "@and") {
      if (!expected || typeof expected !== "object" || Array.isArray(expected))
        refused(`Invalid ${key} filter.`);
      const checks = Object.entries(expected).map(([name, value]) =>
        matchesFilter(row, { [name]: value }),
      );
      return key === "@or" ? checks.some(Boolean) : checks.every(Boolean);
    }
    if (key === "q")
      return Object.entries(row)
        .filter(([name]) => name !== "_house")
        .some(([, value]) =>
          JSON.stringify(value)
            ?.toLowerCase()
            .includes(String(expected).toLowerCase()),
        );
    const [field, operator = "eq"] = key.split("@");
    const actual = row[field];
    const isEqual =
      expected === null || expected === "null"
        ? empty(actual)
        : typeof actual === "object"
          ? equal(actual, expected)
          : actual != null && String(actual) === String(expected);
    switch (operator) {
      case "eq":
      case "is":
        return isEqual;
      case "neq":
      case "not.is":
        return !isEqual;
      case "lt":
        return actual != null && actual < expected!;
      case "lte":
        return actual != null && actual <= expected!;
      case "gt":
        return actual != null && actual > expected!;
      case "gte":
        return actual != null && actual >= expected!;
      case "in":
        return listValues(expected, "(", ")").some((value) =>
          idEqual(actual, value),
        );
      case "cs":
        return (
          Array.isArray(actual) &&
          listValues(expected, "{", "}").every((value) =>
            actual.some((item) => idEqual(item, value)),
          )
        );
      case "ilike":
      case "like": {
        const escaped = String(expected)
          .replace(/[.+^${}()|[\]\\]/g, "\\$&")
          .replaceAll("%", ".*")
          .replaceAll("*", ".*")
          .replaceAll("_", ".");
        return new RegExp(escaped, operator === "ilike" ? "i" : "").test(
          String(actual ?? ""),
        );
      }
      default:
        return refused(`Unsupported CRM filter operator: ${operator}.`);
    }
  });
}
function listRows(
  resource: string,
  db: Database,
  params: any,
): { data: Row[]; total: number } {
  const rows = decorated(resource, db).filter((row) =>
    matchesFilter(row, params.filter),
  );
  const { field, order } = params.sort ?? {
    field: resource === "activity_log" ? "date" : "id",
    order: resource === "activity_log" ? "DESC" : "ASC",
  };
  rows.sort((a, b) => {
    const left = a[field];
    const right = b[field];
    if (empty(left) || empty(right))
      return empty(left) === empty(right) ? 0 : empty(left) ? 1 : -1;
    const compared =
      typeof left === "number" && typeof right === "number"
        ? left - right
        : String(left).localeCompare(String(right));
    return compared * (order === "DESC" ? -1 : 1);
  });
  const { page = 1, perPage = 25 } = params.pagination ?? {};
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    !Number.isInteger(perPage) ||
    perPage < 1
  )
    refused("Invalid pagination.");
  return {
    data: rows.slice((page - 1) * perPage, page * perPage),
    total: rows.length,
  };
}
function snapshot(row: Row, resource: CrmResource, room: string): Snapshot {
  const opened = row?._house as Snapshot | undefined;
  if (
    !opened ||
    opened.room !== room ||
    opened.type !== definitions[resource].type ||
    !idEqual(opened.fields.id, row.id)
  )
    refused(
      "This item has no matching opened House snapshot. Reload it before editing.",
    );
  return opened;
}
function currentMember(
  db: Database,
  resource: CrmResource,
  row: Row,
  room: string,
): Row {
  const opened = snapshot(row, resource, room);
  const current = db[resource].find((item) => idEqual(item.id, row.id));
  if (!current || current._house.path !== opened.path)
    refused("This item moved or was deleted. Reload before editing.");
  return current;
}
function fieldChange(
  resource: CrmResource,
  row: Row,
  patch: Row,
  room: string,
): Change | null {
  const opened = snapshot(row, resource, room);
  const kinds = fieldsFor(resource);
  // Only determine the user's changed fields here. Whole-record invariants must
  // be checked against current state plus the actual delta, not a stale form.
  const validated = validate(resource, { ...patch, id: row.id }, true);
  const fields: Record<
    string,
    { value: unknown; base: { value: unknown } | null }
  > = {};
  for (const key of Object.keys(patch)) {
    if (key === "id" || computed.has(key) || patch[key] === undefined) continue;
    const storageName = storedKey(resource, key);
    if (!Object.hasOwn(opened.fields, storageName) && validated[key] === null)
      continue;
    if (Object.hasOwn(opened.fields, storageName) || Object.hasOwn(row, key)) {
      const original = validate(
        resource,
        {
          id: row.id,
          // Compare the opened view's displayed value, including defaults for
          // absent or stored-null fields. Raw bytes remain the conflict base.
          [key]: Object.hasOwn(row, key)
            ? row[key]
            : decodedValue(kinds[key], opened.fields[storageName]),
        },
        true,
      );
      if (sameFieldValue(original[key], validated[key])) continue;
    }
    const value = storedValue(kinds[key], validated[key]);
    if (
      Object.hasOwn(opened.fields, storageName) &&
      equal(opened.fields[storageName], value)
    )
      continue;
    if (!Object.hasOwn(opened.fields, storageName) && value === null) continue;
    fields[storageName] = {
      value,
      base: Object.hasOwn(opened.fields, storageName)
        ? { value: opened.fields[storageName] }
        : null,
    };
  }
  return Object.keys(fields).length
    ? { path: opened.path, parts: { fields } }
    : null;
}
function sameFieldValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) || Array.isArray(b))
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((value, index) => sameFieldValue(value, b[index]))
    );
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  return (
    Object.keys(left).length === Object.keys(right).length &&
    Object.keys(left).every(
      (key) =>
        Object.hasOwn(right, key) && sameFieldValue(left[key], right[key]),
    )
  );
}
function decodedValue(kind: FieldKind, value: unknown): unknown {
  return kind === "boolean"
    ? value === "true"
    : kind === "array" || kind === "object"
      ? JSON.parse(value as string)
      : value;
}
/** Project only fields that will actually be queued onto the latest record.
 * The opened conflict bases in `change` are intentionally left untouched.
 */
function effectiveChange(
  resource: CrmResource,
  current: Row,
  change: Change | null,
): Row {
  const delta: Row = { id: current.id };
  for (const [key, kind] of Object.entries(fieldsFor(resource))) {
    const field = change?.parts.fields?.[storedKey(resource, key)];
    if (!field) continue;
    // These values were encoded by fieldChange, never supplied by a caller.
    delta[key] = decodedValue(kind, field.value);
  }
  return { ...current, ...validate(resource, { ...current, ...delta }) };
}
function removal(
  resource: CrmResource,
  opened: Row,
  current: Row,
  room: string,
): Change {
  const before = snapshot(opened, resource, room);
  const after = snapshot(current, resource, room);
  if (
    typeof before.markdown !== "string" ||
    before.markdown !== after.markdown ||
    !equal(before.fields, after.fields)
  )
    refused(
      "This item changed since you opened it. Reload and review before deleting.",
    );
  return { path: before.path, parts: { removal: { base: before.markdown } } };
}
async function queueChanges(
  md: HouseRuntime,
  room: string,
  changes: (Change | null)[],
  assertAvailable: () => void = () => {},
  prepared: RoomDraft | null = null,
): Promise<QueuedWrite | null> {
  const active = changes.filter((change): change is Change => change !== null);
  if (!active.length) return null;
  if (new Set(active.map((change) => change.path)).size !== active.length)
    refused("A grouped save contains the same document twice.");
  for (const change of active) {
    assertAvailable();
    const draft = await md.roomDraft.read(room, change.path);
    if (draft && !(prepared?.path === change.path && prepared.room === room && prepared.revision === draft.revision))
      refused(
        "This item has an unfinished House draft. Resolve it in House before editing again.",
        draft,
      );
  }
  const drafts = [];
  for (const change of active) {
    assertAvailable();
    const written = await md.roomDraft.write(
      room,
      change.path,
      prepared?.path === change.path ? prepared.revision : null,
      prepared?.path === change.path ? mergeDraftParts(prepared.parts, change.parts) : change.parts,
    );
    if (written.outcome !== "written" || !written.roomDraft)
      refused(
        "A House draft changed in another tab. Reload and review. Any prepared drafts have been kept.",
        written,
      );
    drafts.push({ path: change.path, revision: written.roomDraft.revision });
  }
  assertAvailable();
  const saved = await md.save(room, drafts);
  if (saved.outcome !== "saved")
    refused(
      `House did not queue this change: ${saved.rule}. Drafts have been kept.`,
      saved,
    );
  return { outcome: "queued", identifier: saved.identifier };
}
export type CrmDataProvider = DataProvider & {
  openFormDraft(resource: string, record: Row | undefined, values: Record<string, any>): Promise<BusinessDraft>;
  setObservedSnapshot(result: unknown): void;
  getLocalResult(key: readonly unknown[], previous?: unknown): { handled: boolean; value?: unknown };
  uploadAttachment(file: File): Promise<HouseAttachment>;
  getAttachment(attachmentRef: string): Promise<AttachmentRead>;
  addTagsToContacts(
    contacts: Contact[],
    tagIds: Identifier[],
  ): Promise<unknown>;
  unarchiveDeal(deal: Deal): Promise<unknown>;
  moveDeal(
    deal: Deal,
    destinationStage: string,
    orderedDestinationDeals: Deal[],
  ): Promise<unknown>;
  mergeContacts(
    sourceId: Identifier,
    targetId: Identifier,
    sourceSnapshot: Contact,
  ): Promise<unknown>;
  getConfiguration(): Promise<ConfigurationContextValue>;
  updateConfiguration(
    config: ConfigurationContextValue,
  ): Promise<ConfigurationContextValue>;
};

export function createHouseDataProvider(
  md: HouseRuntime,
  room: string,
  options: { onMutation?: (status: MutationStatus) => void; isAvailable?: () => boolean; observed?: boolean } = {},
): CrmDataProvider {
  if (!room) throw new Error("Select an attached House Room.");
  const assertAvailable = () => {
    if (options.isAvailable && !options.isAvailable())
      refused("The data binding is not ready. Your open edits and House drafts are kept.");
  };
  // Snapshots are concurrency bases, never a data fallback. Every read queries House.
  const openedRows = new Map<string, Row>();
  const formEditors = new Map<string, {resource:CrmResource; editor:BusinessDraft}>();
  const formEditorFor=(resource:CrmResource,params:any)=>{
    const token=params.meta?.houseFormDraft;
    if(token===undefined)return undefined;
    const entry=formEditors.get(token);
    if(!entry||entry.resource!==resource||!idEqual(entry.editor.id,params.id??params.data?.id))refused("This form draft is no longer open or belongs to another record.");
    return entry!.editor;
  };
  let configurationOpened: Row | undefined;
  let mutations: Promise<unknown> = Promise.resolve();
  const verifiedAttachmentRefs = new Set<string>();
  let observedDb: Database | undefined;
  const fetchDb = async () => {
    assertAvailable();
    if (options.observed) {
      if (!observedDb) refused("The initial House snapshot is still loading.");
      return structuredClone(observedDb);
    }
    const result = await md.query({ ...crmQuery, rooms: [room] });
    assertAvailable();
    return readCrm(result, room);
  };
  const remember = (resource: string, rows: Row[]) => {
    if (resource !== "activity_log")
      for (const row of rows)
        openedRows.set(
          `${canonicalResource(resource)}/${row.id}`,
          structuredClone(row),
        );
    return rows;
  };
  const notify = (status: MutationStatus) => {
    options.onMutation?.(status);
  };
  const getAttachment = async (reference: string): Promise<AttachmentRead> => {
    assertAvailable();
    const attachment_ref = attachmentRef(reference);
    const result = actionValue(
      "attachments/get",
      await md.call("attachments/get", { room_ref: room, attachment_ref }),
    );
    const record = attachmentRecord(result, room, true);
    if (record.attachment !== attachment_ref)
      refused("House returned a different attachment reference.", result);
    const blob = record.blob ?? null;
    if (blob && blob.size !== record.bytes)
      refused(
        "House attachment byte length does not match its metadata.",
        result,
      );
    if (blob && (await attachmentDigest(blob)) !== record.sha256)
      refused("House attachment SHA-256 does not match its metadata.", result);
    if (record.read?.status === "available" && !blob)
      refused(
        "House reported an available attachment without Blob bytes.",
        result,
      );
    if (blob && record.read && record.read.status !== "available")
      refused(
        "House returned attachment bytes with an incompatible read status.",
        result,
      );
    verifiedAttachmentRefs.add(attachment_ref);
    return {
      blob,
      name: record.name,
      type: record.media_type,
      status: blob ? "available" : (record.read?.status ?? "unavailable"),
    };
  };
  const mutation = <T>(
    operation: (
      save: (changes: (Change | null)[], prepared?: RoomDraft | null) => Promise<void>,
      assertWritable: () => void,
    ) => Promise<T>,
    noSaveStatus: () => MutationStatus = () => ({
      phase: "idle",
      message: "No changes needed.",
    }),
  ): Promise<T> => {
    const run = async () => {
      notify({ phase: "saving", message: "Preparing House change…" });
      let mode: Awaited<ReturnType<typeof observeServiceMode>> | undefined;
      try {
        assertAvailable();
        mode = await observeServiceMode(md);
        assertAvailable();

        let queued = false;
        const result = await operation(
          async (changes, prepared) => {
            for (const asset of changedAttachments(changes)) {
              if (!verifiedAttachmentRefs.has(asset.attachment_ref)) {
                // Rooms is the installed Runtime's local, provider-declared metadata.
                // Save must never perform an attachment Action or fetch bytes.
                const known=(await md.rooms()).find(candidate=>candidate.locator===room)?.attachments.find(candidate=>candidate.reference===asset.attachment_ref);
                if(!known)refused("This attachment is not declared in the selected Room's local metadata. Your draft is kept.");
                if((asset.size!==undefined&&asset.size!==known.byteLength)||(known.mediaType!==null&&asset.type!==known.mediaType))refused("Attachment metadata does not match the selected Room's declaration.");
              }
            }
            const receipt = await queueChanges(md, room, changes, assertAvailable, prepared);
            if (receipt) {
              queued = true;
              notify({
                phase: "queued",
                message: "Queued in House. Waiting for synchronization.",
                identifier: receipt.identifier,
              });
            }
          },
          () => {
            if (mode?.current() !== "open")
              refused(
                "House writes are paused. Your changes have not been saved.",
              );
          },
        );
        if (!queued) notify(noSaveStatus());
        return result;
      } catch (error) {
        notify({
          phase: "error",
          message:
            error instanceof Error
              ? error.message
              : "House could not save this change.",
        });
        throw error;
      } finally {
        mode?.close();
      }
    };
    const result = mutations.then(run, run);
    mutations = result.catch(() => undefined);
    return result;
  };
  const openedFor = (resource: CrmResource, id: Identifier, previous?: Row) => {
    const row =
      previous ??
      openedRows.get(`${resource}/${id}`) ??
      refused("Open this record before changing it.");
    if (!idEqual(row.id, id))
      refused("This opened snapshot belongs to another record.");
    return row;
  };
  const defaults = (resource: CrmResource, data: Row, db: Database): Row => {
    const now = new Date().toISOString();
    const shared = {
      ...data,
      id: data.id ?? `${resource}-${crypto.randomUUID()}`,
    };
    if (resource === "contacts")
      return {
        email_jsonb: [],
        phone_jsonb: [],
        tags: [],
        has_newsletter: false,
        first_seen: now,
        last_seen: now,
        ...shared,
      };
    if (resource === "companies")
      return { created_at: now, context_links: [], ...shared };
    if (resource === "deals")
      return {
        amount: 0,
        index:
          Math.max(
            -1,
            ...db.deals
              .filter(
                (deal) => deal.stage === data.stage && empty(deal.archived_at),
              )
              .map((deal) => deal.index),
          ) + 1,
        contact_ids: [],
        created_at: now,
        updated_at: now,
        ...shared,
      };
    if (resource === "contact_notes" || resource === "deal_notes")
      return { date: now, attachments: [], ...shared };
    if (resource === "sales")
      return { administrator: false, disabled: false, ...shared };
    return shared;
  };
  const updateRecord = async (resourceName:string, params:any, save:(changes:(Change|null)[],prepared?:RoomDraft|null)=>Promise<void>) => {
        const resource = canonicalResource(resourceName);
        const editor=formEditorFor(resource,params);
        const prepared=editor?await editor.prepare(params.data):null;
        const opened = openedFor(resource, params.id, editor?.row??params.previousData);
        const db = await fetchDb();
        const current = currentMember(db, resource, opened, room);
        if (
          !idEqual(opened.id, params.id) ||
          (params.data.id != null && !idEqual(params.data.id, params.id))
        )
          refused("An edit cannot change a record ID.");
        const patch = {
          ...(prepared?.data??params.data),
          ...(resource === "deals"
            ? { updated_at: new Date().toISOString() }
            : {}),
          id: opened.id,
        };
        const change = fieldChange(resource, opened, patch, room) ?? (prepared?.draft ? {path:prepared.draft.path,parts:prepared.draft.parts}:null);
        const next = effectiveChange(resource, current, change);
        db[resource] = db[resource].map((row) =>
          idEqual(row.id, opened.id) ? next : row,
        );
        validateReferences(db);
        await save([change], prepared?.draft);
        // Match getOne's view shape using the effective database, never stale
        // computed fields submitted by the form or a fabricated saved snapshot.
        return {
          data: decorated(resourceName, db).find((row) =>
            idEqual(row.id, next.id),
          )!,
        };

  };
  const provider = {
    async openFormDraft(resourceName: string, record: Row | undefined, values: Record<string, any>) {
      assertAvailable();const resource=canonicalResource(resourceName);const type=definitions[resource].type;
      const opened=record?._house?.room===room && record._house.type===type ? snapshot(record,resource,room) : null;
      let row:Row;let creationPath:string|undefined;
      if(opened)row=record!;
      else {
        const observation=await observeRoomDrafts(md);const all=observation.current();observation.close();
        const scopeKeys=resource==='contact_notes'||resource==='tasks'?['contact_id']:resource==='deal_notes'?['deal_id']:[];
        const constraints=Object.entries(values).filter(([key,value])=>key.endsWith('_id')&&value!=null&&value!=='');
        for(const key of scopeKeys)if(!constraints.some(([field])=>field===key))constraints.push([key,null]);
        const candidate=all.find(d=>d.room===room&&d.parts.creation&&'type' in d.parts.creation&&d.parts.creation.type===type&&constraints.every(([key,value])=>'fields' in d.parts.creation!&&(d.parts.creation.fields[storedKey(resource,key)]??null)===(value??null)));
        row=defaults(resource,values as Row,await fetchDb());
        if(candidate?.parts.creation && 'fields' in candidate.parts.creation){row.id=String(candidate.parts.creation.fields.id);creationPath=candidate.path;}
      }
      const fields=fieldsFor(resource);
      const editor=new BusinessDraft(md,room,opened?.path??creationPath??`crm/${resource}/${row.id}.md`,row,type,opened?.fields??null,{
        fields:Object.keys(fields),storageKey:key=>storedKey(resource,key),
        forSave:(key,value)=>{
          if(resource==='configuration'&&key==='config'&&value&&typeof value==='object'&&!Array.isArray(value))return Object.fromEntries(Object.entries(value).map(([name,items])=>[name,['companySectors','dealCategories','taskTypes','dealStages','noteStatuses'].includes(name)&&Array.isArray(items)?items.map(item=>({...item,value:item.value||toSlug(item.label)})):items]));
          // Apply the donor's deterministic cleanup to the CURRENT draft, never
          // to a potentially stale full-form snapshot submitted before preparation.
          if(resource==='companies'&&key==='website'&&typeof value==='string'&&value&&!value.startsWith('http'))return 'https://'+value;
          if(resource==='contacts'&&['email_jsonb','phone_jsonb'].includes(key)&&Array.isArray(value)){
            const entries=value.filter(item=>item?.[key==='email_jsonb'?'email':'number']!=null);return entries.length?entries:null;
          }
          if(['contact_notes','deal_notes'].includes(resource)&&key==='date'&&typeof value==='string'&&Number.isFinite(Date.parse(value)))return new Date(value).toISOString();
          if(fields[key]==='number'&&typeof value==='string'&&/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())&&Number.isFinite(Number(value)))return Number(value);
          return value;
        },
        encode:(key,value)=>fields[key]==='array'||fields[key]==='object'?JSON.stringify(value??null):fields[key]==='boolean'&&typeof value==='boolean'?String(value):value===undefined?null:value,
        decode:(key,value)=>{if(fields[key]==='boolean')return value==='true'?true:value==='false'?false:value;if((fields[key]==='array'||fields[key]==='object')&&typeof value==='string'){try{return JSON.parse(value)}catch{return value}}return value},
      });
      await editor.observe();formEditors.set(editor.token,{resource,editor});editor.onClose=()=>{formEditors.delete(editor.token)};return editor;
    },
    setObservedSnapshot(result: unknown) {
      if (!result || typeof result !== "object" || !("documents" in result) || !Array.isArray(result.documents)) refused("House returned an invalid observed document snapshot.");
      observedDb = readCrm(result as Parameters<typeof readCrm>[0], room);
      for(const {resource,editor} of formEditors.values()){const row=observedDb[resource]?.find(row=>idEqual(row.id,editor.id));if(row)editor.adopt(row,row._house.fields);}
    },
    getLocalResult(key: readonly unknown[], previous?: unknown): { handled: boolean; value?: unknown } {
      const [resource, method, raw] = key;
      if (!observedDb || typeof resource !== "string" || typeof method !== "string" || !["getList", "getOne", "getMany", "getManyReference", "getInfiniteList"].includes(method)) return { handled: false };
      assertAvailable();
      const params = (raw ?? {}) as any;
      if (method === "getOne") {
        const data = decorated(resource, observedDb).find(row => idEqual(row.id, params.id));
        if (!data) throw Object.assign(new Error(`${resource} record was not found in this Room.`), { status: 404 });
        remember(resource, [data]);
        if (resource === "configuration") configurationOpened = data;
        return { handled: true, value: data };
      }
      if (method === "getMany") {
        const data = decorated(resource, observedDb).filter(row => (params.ids ?? []).some((id: Identifier) => idEqual(row.id, id)));
        remember(resource, data); return { handled: true, value: data };
      }
      if (method === "getInfiniteList") {
        const existing = previous as { pageParams?: unknown[] } | undefined;
        const pageParams = existing?.pageParams?.length ? existing.pageParams : [params.pagination?.page ?? 1];
        const pages = pageParams.map(page => { const result = listRows(resource, observedDb!, { ...params, pagination: { ...params.pagination, page } }); remember(resource, result.data); return { ...result, pageParam: page }; });
        return { handled: true, value: { pages, pageParams } };
      }
      const result = listRows(resource, observedDb, method === "getManyReference" ? { ...params, filter: { ...params.filter, [params.target]: params.id } } : params);
      remember(resource, result.data); return { handled: true, value: result };
    },
    getAttachment,
    uploadAttachment(file: File): Promise<HouseAttachment> {
      let completion: MutationStatus = {
        phase: "idle",
        message: "File received by House. Save the form to link it.",
      };
      return mutation(
        async (_save, assertWritable) => {
          const input = await attachmentUploadInput(file, room);
          assertWritable();
          const result = actionValue(
            "attachments/upload",
            await md.call("attachments/upload", input),
          );
          const uploaded = uploadedAttachment(result, room);
          if (
            uploaded.metadata &&
            (uploaded.metadata.bytes !== input.bytes ||
              uploaded.metadata.sha256 !== input.sha256)
          )
            refused(
              "House returned attachment metadata that does not match the uploaded file.",
              result,
            );
          verifiedAttachmentRefs.add(uploaded.reference);
          if (uploaded.pending === true)
            completion = {
              phase: "queued",
              message:
                "Attachment save is pending in House. It is not linked until you save the form.",
            };
          else if (uploaded.pending === false)
            completion = {
              phase: "idle",
              message: "Attachment stored in House. Save the form to link it.",
            };
          return {
            attachment_ref: uploaded.reference,
            title: input.name,
            type: input.media_type,
            size: input.bytes,
            sha256: input.sha256,
          };
        },
        () => completion,
      );
    },
    async getList(resource: string, params: any) {
      const result = listRows(resource, await fetchDb(), params);
      remember(resource, result.data);
      return result;
    },
    async getOne(resource: string, params: any) {
      const data = decorated(resource, await fetchDb()).find((row) =>
        idEqual(row.id, params.id),
      );
      if (!data)
        throw Object.assign(
          new Error(`${resource} record was not found in this Room.`),
          { status: 404 },
        );
      remember(resource, [data]);
      if (resource === "configuration") configurationOpened = data;
      return { data };
    },
    async getMany(resource: string, params: any) {
      const data = decorated(resource, await fetchDb()).filter((row) =>
        params.ids.some((id: Identifier) => idEqual(row.id, id)),
      );
      remember(resource, data);
      return { data };
    },
    async getManyReference(resource: string, params: any) {
      return provider.getList(resource, {
        ...params,
        filter: { ...params.filter, [params.target]: params.id },
      });
    },
    create(resourceName: string, params: any) {
      return mutation(async (save) => {
        const resource = canonicalResource(resourceName);
        const editor=formEditorFor(resource,params);
        const prepared=editor?await editor.prepare(params.data):null;
        const db = await fetchDb();
        const data = validate(resource, defaults(resource, prepared?.data??params.data, db));
        if (db[resource].some((row) => idEqual(row.id, data.id))) {
          if(editor?.openedFields) return updateRecord(resourceName,{id:editor.id,data:params.data,previousData:editor.row,meta:params.meta},save);
          refused("A CRM record with this ID already exists.");
        }
        const fields = encode(resource, data);
        const path = editor?.path ?? `crm/${resource}/${data.id}.md`;
        const changes: (Change | null)[] = [
          {
            path,
            parts: {
              creation: {
                type: definitions[resource].type,
                fields,
                sections: {},
              },
            },
          },
        ];
        db[resource].push(data);
        if (resource === "deals") {
          for (const other of db.deals)
            if (
              !idEqual(other.id, data.id) &&
              other.stage === data.stage &&
              empty(other.archived_at) &&
              other.index >= data.index
            )
              changes.push(
                fieldChange(
                  "deals",
                  other,
                  { id: other.id, index: other.index + 1 },
                  room,
                ),
              );
        }
        if (resource === "contact_notes" || resource === "tasks") {
          const contact = db.contacts.find((row) =>
            idEqual(row.id, data.contact_id),
          );
          if (contact) {
            const date =
              resource === "tasks" ? new Date().toISOString() : data.date;
            const patch = {
              id: contact.id,
              ...(String(date) > String(contact.last_seen)
                ? { last_seen: date }
                : {}),
              ...(resource === "contact_notes" && data.status
                ? { status: data.status }
                : {}),
            };
            changes.push(fieldChange("contacts", contact, patch, room));
          }
        }
        validateReferences(db);
        await save(changes, prepared?.draft);
        return {
          data: {
            ...data,
            _house: { room, path, type: definitions[resource].type, fields },
          },
        };
      });
    },
    update(resourceName: string, params: any) {
      return mutation(save=>updateRecord(resourceName,params,save));
    },
    updateMany(resourceName: string, params: any) {
      return mutation(async (save) => {
        const resource = canonicalResource(resourceName);
        const db = await fetchDb();
        const changes = params.ids.map((id: Identifier) => {
          const opened = openedFor(resource, id);
          const current = currentMember(db, resource, opened, room);
          if (params.data.id != null && !idEqual(params.data.id, id))
            refused("A bulk edit cannot change record IDs.");
          const change = fieldChange(
            resource,
            opened,
            { ...params.data, id },
            room,
          );
          const next = effectiveChange(resource, current, change);
          db[resource] = db[resource].map((row) =>
            idEqual(row.id, id) ? next : row,
          );
          return change;
        });
        validateReferences(db);
        await save(changes);
        return { data: params.ids };
      });
    },
    delete(resourceName: string, params: any) {
      return mutation(async (save) => {
        const resource = canonicalResource(resourceName);
        const opened = openedFor(resource, params.id, params.previousData);
        const db = await fetchDb();
        const current = currentMember(db, resource, opened, room);
        const change = removal(resource, opened, current, room);
        db[resource] = db[resource].filter(
          (row) => !idEqual(row.id, opened.id),
        );
        try {
          validateReferences(db);
        } catch {
          refused(
            "This record is still referenced. Reassign or remove its related records before deleting it.",
          );
        }
        await save([change]);
        return { data: current };
      });
    },
    deleteMany(resourceName: string, params: any) {
      return mutation(async (save) => {
        const resource = canonicalResource(resourceName);
        const db = await fetchDb();
        const changes = params.ids.map((id: Identifier) => {
          const opened = openedFor(resource, id);
          return removal(
            resource,
            opened,
            currentMember(db, resource, opened, room),
            room,
          );
        });
        db[resource] = db[resource].filter(
          (row) => !params.ids.some((id: Identifier) => idEqual(row.id, id)),
        );
        try {
          validateReferences(db);
        } catch {
          refused(
            "A selected record is still referenced. Reassign or remove its related records before deleting it.",
          );
        }
        await save(changes);
        return { data: params.ids };
      });
    },
    getConfiguration: async () => {
      const db = await fetchDb();
      const config = db.configuration.find((row) => idEqual(row.id, 1));
      configurationOpened = config;
      return (config?.config ?? {}) as ConfigurationContextValue;
    },
    updateConfiguration: (config: ConfigurationContextValue) =>
      mutation(async (save) => {
        const db = await fetchDb();
        const current = db.configuration.find((row) => idEqual(row.id, 1));
        if (!current) {
          const data = validate("configuration", { id: "1", config });
          await save([
            {
              path: "crm/configuration/1.md",
              parts: {
                creation: {
                  type: "crm_configuration",
                  fields: encode("configuration", data),
                  sections: {},
                },
              },
            },
          ]);
        } else {
          if (!configurationOpened)
            refused("Open the configuration before editing it.");
          currentMember(db, "configuration", configurationOpened, room);
          const change = fieldChange(
            "configuration",
            configurationOpened,
            { id: "1", config },
            room,
          );
          const next = effectiveChange("configuration", current, change);
          await save([change]);
          return next.config as ConfigurationContextValue;
        }
        return config;
      }),
    addTagsToContacts: (contacts: Contact[], tagIds: Identifier[]) =>
      mutation(async (save) => {
        const db = await fetchDb();
        const additions = tagIds.map(validId);
        const changes = contacts.map((opened) => {
          const current = currentMember(db, "contacts", opened, room);
          const before = snapshot(opened, "contacts", room);
          if (!equal(before.fields.tags, current._house.fields.tags))
            refused(
              "A selected contact’s tags changed. Refresh and review before applying tags.",
            );
          const tags = [
            ...new Set([...(opened.tags ?? []).map(validId), ...additions]),
          ];
          db.contacts = db.contacts.map((row) =>
            idEqual(row.id, opened.id) ? { ...row, tags } : row,
          );
          return fieldChange("contacts", opened, { id: opened.id, tags }, room);
        });
        validateReferences(db);
        await save(changes);
        return { data: contacts.map((contact) => contact.id) };
      }),
    moveDeal: (
      deal: Deal,
      destinationStage: string,
      orderedDestinationDeals: Deal[],
    ) =>
      mutation(async (save) => {
        const db = await fetchDb();
        const current = currentMember(db, "deals", deal, room);
        if (current.stage !== deal.stage || !empty(current.archived_at))
          refused(
            "This deal moved or was archived. Refresh the board before moving it.",
          );
        const expected = db.deals.filter(
          (row) =>
            row.stage === destinationStage &&
            empty(row.archived_at) &&
            !idEqual(row.id, deal.id),
        );
        const ordered = orderedDestinationDeals.filter(
          (row) => !idEqual(row.id, deal.id),
        );
        if (
          expected.length !== ordered.length ||
          expected.some(
            (row) => !ordered.some((item) => idEqual(item.id, row.id)),
          )
        )
          refused(
            "This stage changed or is filtered. Show all deals and refresh before reordering.",
          );
        if (
          orderedDestinationDeals.filter((row) => idEqual(row.id, deal.id))
            .length !== 1
        )
          refused(
            "The moved deal must occur exactly once in the destination order.",
          );
        const data: Row[] = [];
        const changes = orderedDestinationDeals.map((row, index) => {
          const before = idEqual(row.id, deal.id) ? deal : row;
          const current = currentMember(db, "deals", before, room);
          if (current.index !== before.index)
            refused(
              "This stage order changed. Refresh the board before reordering.",
            );
          const change = fieldChange(
            "deals",
            before,
            {
              id: before.id,
              stage: destinationStage,
              index,
              updated_at: new Date().toISOString(),
            },
            room,
          );
          data.push(effectiveChange("deals", current, change));
          return change;
        });
        await save(changes);
        return { data };
      }),
    unarchiveDeal: (deal: Deal) =>
      mutation(async (save) => {
        const db = await fetchDb();
        const current = currentMember(db, "deals", deal, room);
        if (current.stage !== deal.stage)
          refused("This deal moved. Reload before restoring it.");
        const index =
          Math.max(
            -1,
            ...db.deals
              .filter(
                (row) => row.stage === deal.stage && empty(row.archived_at),
              )
              .map((row) => row.index),
          ) + 1;
        const change = fieldChange(
          "deals",
          deal,
          {
            id: deal.id,
            archived_at: null,
            index,
            updated_at: new Date().toISOString(),
          },
          room,
        );
        const next = effectiveChange("deals", current, change);
        await save([change]);
        return { data: next };
      }),
    mergeContacts: (
      sourceId: Identifier,
      targetId: Identifier,
      sourceSnapshot: Contact,
    ) =>
      mutation(async (save) => {
        if (idEqual(sourceId, targetId))
          refused("Choose two different contacts to merge.");
        if (!sourceSnapshot)
          refused("Open the source contact before merging it.");
        const source = openedFor("contacts", sourceId, sourceSnapshot);
        const target = openedFor("contacts", targetId);
        const db = await fetchDb();
        const losing = currentMember(db, "contacts", source, room);
        const winning = currentMember(db, "contacts", target, room);
        const remove = removal("contacts", source, losing, room);
        if (
          !equal(
            snapshot(target, "contacts", room).fields,
            snapshot(winning, "contacts", room).fields,
          )
        )
          refused(
            "The destination contact changed. Reload and review before merging.",
          );
        const mergeUnique = (a: any[] = [], b: any[] = [], key?: string) => [
          ...new Map(
            [...b, ...a].map((item) => [
              key ? String(item[key]).toLowerCase() : String(item),
              item,
            ]),
          ).values(),
        ];
        const patch: Row = { id: target.id };
        for (const key of Object.keys(fieldsFor("contacts")))
          if (key !== "id" && empty(winning[key]) && !empty(losing[key]))
            patch[key] = losing[key];
        patch.email_jsonb = mergeUnique(
          winning.email_jsonb,
          losing.email_jsonb,
          "email",
        );
        patch.phone_jsonb = mergeUnique(
          winning.phone_jsonb,
          losing.phone_jsonb,
          "number",
        );
        patch.tags = mergeUnique(winning.tags, losing.tags);
        patch.last_seen =
          String(winning.last_seen) > String(losing.last_seen)
            ? winning.last_seen
            : losing.last_seen;
        const changes: (Change | null)[] = [
          remove,
          fieldChange("contacts", target, patch, room),
        ];
        for (const resource of ["tasks", "contact_notes"] as const)
          for (const row of db[resource])
            if (idEqual(row.contact_id, sourceId)) {
              changes.push(
                fieldChange(
                  resource,
                  row,
                  { id: row.id, contact_id: target.id },
                  room,
                ),
              );
              row.contact_id = target.id;
            }
        for (const deal of db.deals)
          if (
            (deal.contact_ids ?? []).some((id: Identifier) =>
              idEqual(id, sourceId),
            )
          ) {
            const contact_ids = [
              ...new Set(
                deal.contact_ids.map((id: Identifier) =>
                  idEqual(id, sourceId) ? target.id : id,
                ),
              ),
            ];
            changes.push(
              fieldChange("deals", deal, { id: deal.id, contact_ids }, room),
            );
            deal.contact_ids = contact_ids;
          }
        db.contacts = db.contacts
          .filter((row) => !idEqual(row.id, sourceId))
          .map((row) =>
            idEqual(row.id, targetId) ? { ...row, ...patch } : row,
          );
        validateReferences(db);
        await save(changes);
        return { data: { ...winning, ...patch } };
      }),
  };
  return provider as unknown as CrmDataProvider;
}
