import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { connectLocalQueryProjection } from '../src/local-query-projection';
import { importRows } from "../src/components/atomic-crm/dataImport/localImport";
import { defaultConfiguration } from "../src/components/atomic-crm/root/defaultConfiguration";
// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { parse, validate, verify } from "@agentshouse/mdmodel";
// @ts-expect-error The synthetic seed is a standalone JavaScript CLI.
import * as seedModule from "../scripts/seed-data.mjs";
const { buildSeedChanges, seedRecords } = seedModule as {
  buildSeedChanges: (room?: string) => {
    changes: { op: string; path: string; content: string }[];
  };
  seedRecords: Record<string, Record<string, any>[]>;
};
import {
  createHouseDataProvider,
  matchesFilter,
  readCrm,
  type HouseRuntime,
  type MutationStatus,
} from "../src/house";
vi.mock("@agentshouse/app-bridge", () => ({ houseBridge: vi.fn() }));

const ROOM = "house://crm-test";
const typeNames: Record<string, string> = {
  companies: "crm_company",
  contacts: "crm_contact",
  deals: "crm_deal",
  tasks: "crm_task",
  contact_notes: "crm_contact_note",
  deal_notes: "crm_deal_note",
  sales: "crm_sale",
  tags: "crm_tag",
  configuration: "crm_configuration",
};
const baseDate = "2026-10-01T10:00:00.000Z";
const contact = (id = "contact-1", extra = {}) => ({
  id,
  first_name: "Ada",
  last_name: "Rivera",
  first_seen: baseDate,
  last_seen: baseDate,
  email_jsonb: [{ email: "ada@maple.example", type: "Work" }],
  tags: [],
  phone_jsonb: [],
  ...extra,
});
const company = (id = "company-1", extra = {}) => ({
  id,
  name: "Maple Studio",
  created_at: baseDate,
  ...extra,
});
const deal = (id = "deal-1", extra = {}) => ({
  id,
  name: "Brand workshop",
  company_id: "company-1",
  stage: "opportunity",
  amount: 12000,
  index: 0,
  created_at: baseDate,
  updated_at: baseDate,
  contact_ids: [],
  ...extra,
});
function document(resource: string, row: Record<string, any>) {
  const fields = Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      resource === "tasks" && key === "type" ? "task_type" : key,
      typeof value === "boolean"
        ? String(value)
        : value != null && typeof value === "object"
          ? JSON.stringify(value)
          : value,
    ]),
  );
  return {
    room: ROOM,
    path: `crm/${resource}/${row.id}.md`,
    type: typeNames[resource],
    fields,
    markdown: JSON.stringify({ resource, fields }),
  };
}
function fixture(rows: [string, Record<string, any>][] = []) {
  const documents = rows.map(([resource, row]) => document(resource, row));
  const drafts = new Map<string, any>();
  const pending = new Map<string, any>();
  let mode: "open" | "write-halted" = "open";
  const close = vi.fn();
  const binaryDocuments: any[] = [];
  const binaryBytes = new Map<string, Blob>();
  const md = {
    binaryFile: { read: vi.fn(async (_room: string, path: string): Promise<any> => binaryBytes.has(path) ? {kind:"binary",blob:binaryBytes.get(path)} : {kind:"absent",code:"not_found",retryable:false}) },
    rooms: vi.fn(():any[]=>[]),
    call: vi.fn(
      async (_name: string, _input: unknown): Promise<any> => ({
        kind: "undeclared",
      }),
    ),
    query: vi.fn(async (_query: unknown) => ({
      documents: (_query as any)?.pathPrefix ? structuredClone(binaryDocuments) : structuredClone(documents),
    })),
    observe: vi.fn(async () => ({
      current: () => mode,
      subscribe: vi.fn(() => vi.fn()),
      close,
    })),
    roomDraft: {
      read: vi.fn(async (_room, path) => drafts.get(path) ?? null),
      write: vi.fn(async (_room, path, revision, parts) => {
        expect(revision).toBeNull();
        const roomDraft = {
          room: ROOM,
          path,
          revision: `revision-${pending.size + 1}`,
          parts,
          changedUnderneath: {},
          returned: null,
        };
        pending.set(path, roomDraft);
        return { outcome: "written", roomDraft };
      }),
      discard: vi.fn(),
    },
    save: vi.fn(async (_room, saved) => {
      // Only the test double applies local changes. Production always reads House.
      for (const { path } of saved) {
        const draft = pending.get(path);
        const currentIndex = documents.findIndex((doc) => doc.path === path);
        if (draft.parts.file) {
          const blob = draft.parts.file.blob as Blob;
          const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer())), value => value.toString(16).padStart(2,"0")).join("");
          binaryBytes.set(path, blob);
          binaryDocuments.push({room:ROOM,path,binaryFile:{state:"pending",localId:path,path,byteLength:blob.size,mediaType:blob.type || "application/octet-stream",sha256:digest}});
          pending.delete(path);
          continue;
        }
        if (draft.parts.removal) documents.splice(currentIndex, 1);
        else if (draft.parts.creation)
          documents.push({
            room: ROOM,
            path,
            type: draft.parts.creation.type,
            fields: { ...draft.parts.creation.fields },
            markdown: JSON.stringify(draft.parts.creation.fields),
          });
        else {
          const current = documents[currentIndex];
          for (const [key, patch] of Object.entries(
            draft.parts.fields ?? {},
          ) as any)
            current.fields[key] = patch.value;
          current.markdown = JSON.stringify(current.fields);
        }
        pending.delete(path);
      }
      return { outcome: "saved", identifier: "batch-1" };
    }),
  };
  const statuses: MutationStatus[] = [];
  const provider = createHouseDataProvider(
    md as unknown as HouseRuntime,
    ROOM,
    { onMutation: (status) => statuses.push(status) },
  );
  return {
    md,
    provider,
    documents,
    drafts,
    pending,
    statuses,
    close,
    setMode: (value: typeof mode) => {
      mode = value;
    },
  };
}
const list = {
  pagination: { page: 1, perPage: 100 },
  sort: { field: "id", order: "ASC" as const },
  filter: {},
};

describe("House CRM reads and views", () => {
  it("scopes every query to one attached Room and never invents data", async () => {
    const f = fixture();
    expect(await f.provider.getList("contacts", list)).toEqual({
      data: [],
      total: 0,
    });
    expect(f.md.query.mock.calls[0][0]).toMatchObject({
      rooms: [ROOM],
      select: { fields: "all", markdown: true },
    });
    f.md.query.mockRejectedValueOnce(new Error("Room unavailable"));
    await expect(f.provider.getList("contacts", list)).rejects.toThrow(
      "Room unavailable",
    );
  });
  it("decodes JSON/boolean fields and derives task and company counts", async () => {
    const f = fixture([
      ["companies", company()],
      [
        "contacts",
        contact("contact-1", {
          company_id: "company-1",
          has_newsletter: false,
        }),
      ],
      ["deals", deal()],
      [
        "tasks",
        {
          id: "task-1",
          contact_id: "contact-1",
          text: "Call",
          due_date: baseDate,
        },
      ],
      [
        "tasks",
        {
          id: "task-2",
          contact_id: "contact-1",
          text: "Done",
          due_date: baseDate,
          done_date: baseDate,
        },
      ],
    ]);
    const { data: c } = await f.provider.getOne("contacts", {
      id: "contact-1",
    });
    expect(c).toMatchObject({
      nb_tasks: 1,
      company_name: "Maple Studio",
      has_newsletter: false,
      email_jsonb: [{ email: "ada@maple.example", type: "Work" }],
    });
    expect(
      (await f.provider.getOne("companies_summary", { id: "company-1" })).data,
    ).toMatchObject({ nb_contacts: 1, nb_deals: 1 });
  });
  it("supports filtering, total-before-pagination, sorting and references", async () => {
    const f = fixture([
      ["companies", company()],
      [
        "contacts",
        contact("contact-1", { company_id: "company-1", first_name: "Ada" }),
      ],
      [
        "contacts",
        contact("contact-2", { company_id: "company-1", first_name: "Zoe" }),
      ],
    ]);
    const result = await f.provider.getManyReference("contacts", {
      ...list,
      target: "company_id",
      id: "company-1",
      pagination: { page: 1, perPage: 1 },
      sort: { field: "first_name", order: "DESC" },
    });
    expect(result.total).toBe(2);
    expect(result.data[0].first_name).toBe("Zoe");
    expect(
      (await f.provider.getMany("contacts", { ids: ["contact-2", "missing"] }))
        .data,
    ).toHaveLength(1);
  });
  it("derives note activity with company and author filters", async () => {
    const f = fixture([
      ["sales", { id: "label-1", first_name: "Alex", last_name: "Kim" }],
      ["companies", company()],
      ["contacts", contact("contact-1", { company_id: "company-1" })],
      [
        "contact_notes",
        {
          id: "note-1",
          contact_id: "contact-1",
          text: "Discovery complete",
          date: baseDate,
          sales_id: "label-1",
        },
      ],
    ]);
    const result = await f.provider.getList("activity_log", {
      ...list,
      filter: { company_id: "company-1", sales_id: "label-1" },
    });
    expect(result.total).toBe(1);
    expect(result.data[0]).toMatchObject({
      type: "contactNote.created",
      contactNote: { text: "Discovery complete" },
    });
  });
  it("rejects cross-Room documents, duplicate IDs, malformed JSON and missing references", () => {
    expect(() =>
      readCrm(
        {
          documents: [
            { ...document("contacts", contact()), room: "elsewhere" },
          ],
        },
        ROOM,
      ),
    ).toThrow("outside");
    expect(() =>
      readCrm(
        {
          documents: [
            document("contacts", contact()),
            { ...document("contacts", contact()), path: "duplicate.md" },
          ],
        },
        ROOM,
      ),
    ).toThrow("Duplicate");
    expect(() =>
      readCrm(
        {
          documents: [
            document("contacts", { ...contact(), email_jsonb: "[bad" }),
          ],
        },
        ROOM,
      ),
    ).toThrow("invalid JSON");
    expect(() =>
      readCrm(
        {
          documents: [
            document(
              "contacts",
              contact("contact-1", { company_id: "missing" }),
            ),
          ],
        },
        ROOM,
      ),
    ).toThrow("missing");
  });
  it("treats sales records only as stored labels", async () => {
    const f = fixture([
      ["sales", { id: "sales-1", first_name: "Alex", last_name: "Kim" }],
    ]);
    expect(
      (await f.provider.getOne("sales", { id: "sales-1" })).data,
    ).not.toHaveProperty("user_id");
    expect(f.provider).not.toHaveProperty("signUp");
  });
});

describe("PostgREST-style donor filters", () => {
  it("supports comparisons, nulls, in, contains, full-text search and OR", () => {
    const row = {
      id: "contact-1",
      title: "Design Partner",
      tags: ["tag-2", "tag-3"],
      last_seen: "2026-10-10",
      nb_tasks: 2,
      archived_at: null,
    };
    for (const filter of [
      { "nb_tasks@gt": 1 },
      { "nb_tasks@gte": 2 },
      { "nb_tasks@lt": 3 },
      { "nb_tasks@lte": 2 },
      { "nb_tasks@neq": 0 },
      { "archived_at@is": null },
      { "tags@cs": "{tag-2,tag-3}" },
      { "id@in": "(contact-1,contact-2)" },
      { "@or": { "title@ilike": "partner", "title@eq": "not found" } },
      { q: "design" },
    ])
      expect(matchesFilter(row, filter)).toBe(true);
    expect(matchesFilter(row, { "archived_at@not.is": null })).toBe(false);
    expect(matchesFilter(row, { "id@in": "()" })).toBe(false);
    expect(matchesFilter(row, { "tags@cs": "{}" })).toBe(true);
    expect(
      matchesFilter(row, {
        "@or": { "title@eq": "missing", "nb_tasks@eq": 9 },
      }),
    ).toBe(false);
  });
  it("parses quoted list values and fails unsupported/malformed filters explicitly", () => {
    expect(matchesFilter({ id: "a,b" }, { "id@in": '("a,b",other)' })).toBe(
      true,
    );
    expect(() => matchesFilter({ id: "x" }, { "id@in": "[x]" })).toThrow(
      "Invalid list",
    );
    expect(() => matchesFilter({ id: "x" }, { "id@unknown": "x" })).toThrow(
      "Unsupported",
    );
  });
});

describe("House write safety", () => {
  it("queues creation with absent-draft bases and never calls save success synced", async () => {
    const f = fixture();
    const { data } = await f.provider.create("contacts", {
      data: { first_name: "Nora", last_name: "Chen" },
    });
    expect(data.id).toMatch(/^contacts-/);
    expect(f.md.roomDraft.write).toHaveBeenCalledWith(
      ROOM,
      expect.any(String),
      null,
      expect.objectContaining({
        creation: expect.objectContaining({ type: "crm_contact" }),
      }),
    );
    expect(f.md.save).toHaveBeenCalledOnce();
    expect(f.statuses.map((status) => status.phase)).toEqual([
      "saving",
      "queued",
    ]);
    expect(f.statuses.at(-1)?.message).toContain("Waiting for synchronization");
    expect(f.close).toHaveBeenCalled();
  });
  it("uses original exact field bases, including absent and explicitly empty values", async () => {
    const f = fixture([["contacts", contact("contact-1", { title: "" })]]);
    const { data: before } = await f.provider.getOne("contacts", {
      id: "contact-1",
    });
    f.documents[0].fields.first_name = "Changed in another tab";
    await f.provider.update("contacts", {
      id: before.id,
      previousData: before,
      data: {
        first_name: "Edited",
        title: "Director",
        background: "Introduced at event",
      },
    });
    expect(f.md.roomDraft.write.mock.calls[0][3].fields).toEqual({
      first_name: { value: "Edited", base: { value: "Ada" } },
      title: { value: "Director", base: { value: "" } },
      background: { value: "Introduced at event", base: null },
    });
  });
  it("preserves exact JSON string bases rather than reserializing the opened value", async () => {
    const f = fixture([["contacts", contact()]]);
    f.documents[0].fields.email_jsonb =
      '[ { "email": "ada@maple.example", "type": "Work" } ]';
    const { data } = await f.provider.getOne("contacts", { id: "contact-1" });
    await f.provider.update("contacts", {
      id: data.id,
      previousData: data,
      data: { email_jsonb: [] },
    });
    expect(
      f.md.roomDraft.write.mock.calls[0][3].fields.email_jsonb.base.value,
    ).toBe('[ { "email": "ada@maple.example", "type": "Work" } ]');
  });
  it("preflights every grouped path before writing any draft", async () => {
    const f = fixture([["contacts", contact()]]);
    f.drafts.set("crm/contacts/contact-1.md", {
      revision: "existing",
      returned: { kind: "conflicted" },
    });
    await expect(
      f.provider.create("contact_notes", {
        data: {
          contact_id: "contact-1",
          text: "A meeting",
          date: "2026-10-11T10:00:00Z",
        },
      }),
    ).rejects.toThrow("unfinished");
    expect(f.md.roomDraft.write).not.toHaveBeenCalled();
    expect(f.md.save).not.toHaveBeenCalled();
    expect(f.md.roomDraft.discard).not.toHaveBeenCalled();
  });
  it("keeps prepared drafts on cross-tab stale writes and save refusal", async () => {
    const f = fixture([["contacts", contact()]]);
    f.md.roomDraft.write.mockResolvedValueOnce({
      outcome: "stale",
      current: null,
    } as any);
    await expect(
      f.provider.create("tasks", {
        data: { contact_id: "contact-1", text: "Call", due_date: baseDate },
      }),
    ).rejects.toThrow("another tab");
    expect(f.md.save).not.toHaveBeenCalled();
    expect(f.md.roomDraft.discard).not.toHaveBeenCalled();
    const g = fixture();
    g.md.save.mockResolvedValueOnce({
      outcome: "refused",
      rule: "write-halted",
    } as any);
    await expect(
      g.provider.create("tags", {
        data: { name: "Priority", color: "#ff0000" },
      }),
    ).rejects.toThrow("Drafts have been kept");
    expect(g.pending.size).toBe(1);
    expect(g.statuses.at(-1)?.phase).toBe("error");
  });
  it("blocks stale deletion by exact opened Markdown and fields", async () => {
    const f = fixture([
      ["tags", { id: "tag-1", name: "Priority", color: "#00ff00" }],
    ]);
    const { data } = await f.provider.getOne("tags", { id: "tag-1" });
    f.documents[0].markdown += "\nA new section";
    await expect(
      f.provider.delete("tags", { id: data.id, previousData: data }),
    ).rejects.toThrow("changed since");
    expect(f.md.roomDraft.write).not.toHaveBeenCalled();
  });
  it("uses whole opened Markdown as deletion base when unchanged", async () => {
    const f = fixture([
      ["tags", { id: "tag-1", name: "Priority", color: "#00ff00" }],
    ]);
    const { data } = await f.provider.getOne("tags", { id: "tag-1" });
    const markdown = f.documents[0].markdown;
    await f.provider.delete("tags", { id: data.id, previousData: data });
    expect(f.md.roomDraft.write.mock.calls[0][3]).toEqual({
      removal: { base: markdown },
    });
  });
  it("rejects writes without opened snapshots and rejects cross-Room snapshots", async () => {
    const f = fixture([["contacts", contact()]]);
    await expect(
      f.provider.update("contacts", {
        id: "contact-1",
        data: { first_name: "New" },
        previousData: contact(),
      }),
    ).rejects.toThrow("snapshot");
    const { data } = await f.provider.getOne("contacts", { id: "contact-1" });
    data._house.room = "other";
    await expect(
      f.provider.update("contacts", {
        id: "contact-1",
        data: { first_name: "New" },
        previousData: data,
      }),
    ).rejects.toThrow("snapshot");
  });
  it("blocks orphaning deletes and invalid references before creating drafts", async () => {
    const f = fixture([
      ["companies", company()],
      ["contacts", contact("contact-1", { company_id: "company-1" })],
    ]);
    const { data } = await f.provider.getOne("companies", { id: "company-1" });
    await expect(
      f.provider.delete("companies", { id: data.id, previousData: data }),
    ).rejects.toThrow("still referenced");
    await expect(
      f.provider.create("tasks", {
        data: { contact_id: "missing", text: "Call", due_date: baseDate },
      }),
    ).rejects.toThrow("missing");
    expect(f.md.roomDraft.write).not.toHaveBeenCalled();
  });
  it("queues local Save while provider uploads are halted", async () => {
    const f = fixture();
    f.setMode("write-halted");
    await expect(
      f.provider.create("tags", {
        data: { name: "Priority", color: "#00ff00" },
      }),
    ).resolves.toMatchObject({ data: { name: "Priority" } });
    expect(f.md.roomDraft.write).toHaveBeenCalledOnce();
    expect(f.md.save).toHaveBeenCalledOnce();
    expect(f.close).toHaveBeenCalled();
  });
  it("serializes mutations and groups bulk edits into one save", async () => {
    const f = fixture([
      ["tags", { id: "tag-1", name: "One", color: "#00ff00" }],
      ["tags", { id: "tag-2", name: "Two", color: "#00ff00" }],
    ]);
    await f.provider.getList("tags", list);
    await f.provider.updateMany("tags", {
      ids: ["tag-1", "tag-2"],
      data: { color: "#ff0000" },
    });
    expect(f.md.save).toHaveBeenCalledOnce();
    expect(f.md.save.mock.calls[0][1]).toHaveLength(2);
    f.md.save.mockClear();
    await Promise.all([
      f.provider.create("tags", { data: { name: "Three", color: "#ffffff" } }),
      f.provider.create("tags", { data: { name: "Four", color: "#ffffff" } }),
    ]);
    expect(f.statuses.map((status) => status.phase)).toEqual([
      "saving",
      "queued",
      "saving",
      "queued",
      "saving",
      "queued",
    ]);
  });
  it("rejects local files and secret/account fields", async () => {
    const f = fixture();
    await expect(
      f.provider.create("sales", {
        data: { first_name: "A", last_name: "B", password: "secret" },
      }),
    ).rejects.toThrow("unsupported");
    await expect(
      f.provider.create("companies", {
        data: { name: "Studio", logo: { src: "blob:temporary" } },
      }),
    ).rejects.toThrow("House Room reference");
    expect(f.md.save).not.toHaveBeenCalled();
  });
});

describe("CRM grouped operations", () => {
  it("creates a contact note and updates contact status/last_seen in one save", async () => {
    const f = fixture([["contacts", contact()]]);
    await f.provider.create("contact_notes", {
      data: {
        contact_id: "contact-1",
        text: "Ready for proposal",
        status: "warm",
        date: "2026-10-10T10:00:00Z",
      },
    });
    expect(f.md.save).toHaveBeenCalledOnce();
    expect(f.md.save.mock.calls[0][1]).toHaveLength(2);
    expect(f.md.roomDraft.write.mock.calls[1][3].fields).toMatchObject({
      last_seen: { value: "2026-10-10T10:00:00Z", base: { value: baseDate } },
      status: { value: "warm", base: null },
    });
  });
  it("does not move last_seen backwards for a backdated note", async () => {
    const f = fixture([["contacts", contact()]]);
    await f.provider.create("contact_notes", {
      data: {
        contact_id: "contact-1",
        text: "Historical conversation",
        date: "2026-09-01T10:00:00Z",
      },
    });
    expect(f.md.save.mock.calls[0][1]).toHaveLength(1);
  });
  it("groups task creation with last_seen and derives pending task count", async () => {
    const f = fixture([["contacts", contact()]]);
    await f.provider.create("tasks", {
      data: {
        contact_id: "contact-1",
        text: "Send proposal",
        due_date: "2026-10-12",
      },
    });
    expect(f.md.save.mock.calls[0][1]).toHaveLength(2);
    expect(
      (await f.provider.getOne("contacts", { id: "contact-1" })).data.nb_tasks,
    ).toBe(1);
  });
  it("groups inserted deal with affected stage indices", async () => {
    const f = fixture([
      ["companies", company()],
      ["deals", deal()],
    ]);
    await f.provider.create("deals", {
      data: {
        name: "Launch campaign",
        company_id: "company-1",
        stage: "opportunity",
        index: 0,
      },
    });
    expect(f.md.save.mock.calls[0][1]).toHaveLength(2);
    expect(f.md.roomDraft.write.mock.calls[1][3].fields.index).toEqual({
      value: 1,
      base: { value: 0 },
    });
  });
  it("moves a complete destination stage in one save and rejects filtered orders", async () => {
    const f = fixture([
      ["companies", company()],
      ["deals", deal()],
      ["deals", deal("deal-2", { stage: "proposal-sent" })],
    ]);
    const { data } = await f.provider.getList("deals", list);
    await expect(
      f.provider.moveDeal(data[0] as any, "proposal-sent", [data[0]] as any),
    ).rejects.toThrow("filtered");
    await f.provider.moveDeal(data[0] as any, "proposal-sent", [
      data[0],
      data[1],
    ] as any);
    expect(f.md.save).toHaveBeenCalledOnce();
    expect(f.md.save.mock.calls[0][1]).toHaveLength(2);
  });
  it("merges contact arrays and transfers notes/tasks/deal links in one save", async () => {
    const f = fixture([
      ["companies", company()],
      ["contacts", contact()],
      [
        "contacts",
        contact("contact-2", {
          first_name: "Ada",
          email_jsonb: [{ email: "ada@another.example", type: "Work" }],
        }),
      ],
      ["deals", deal("deal-1", { contact_ids: ["contact-1", "contact-2"] })],
      [
        "tasks",
        {
          id: "task-1",
          contact_id: "contact-1",
          text: "Call",
          due_date: baseDate,
        },
      ],
      [
        "contact_notes",
        {
          id: "note-1",
          contact_id: "contact-1",
          text: "Hello",
          date: baseDate,
        },
      ],
    ]);
    const { data: selected } = await f.provider.getList("contacts", list);
    await f.provider.mergeContacts(
      "contact-1",
      "contact-2",
      selected[0] as any,
    );
    expect(f.md.save).toHaveBeenCalledOnce();
    expect(f.md.save.mock.calls[0][1]).toHaveLength(5);
    expect((await f.provider.getList("contacts", list)).data).toHaveLength(1);
    expect(
      (await f.provider.getOne("contacts", { id: "contact-2" })).data
        .email_jsonb,
    ).toHaveLength(2);
    expect(
      (await f.provider.getOne("deals", { id: "deal-1" })).data.contact_ids,
    ).toEqual(["contact-2"]);
  });
  it("persists configuration in Room with an exact config field base", async () => {
    const f = fixture([
      ["configuration", { id: "1", config: { title: "Studio" } }],
    ]);
    expect(await f.provider.getConfiguration()).toEqual({ title: "Studio" });
    await f.provider.updateConfiguration({ title: "Studio CRM" } as any);
    expect(f.md.roomDraft.write.mock.calls[0][3].fields.config).toEqual({
      value: '{"title":"Studio CRM"}',
      base: { value: '{"title":"Studio"}' },
    });
  });
  it("declares every retained resource in schema and manifest", () => {
    const schema = readFileSync(
      new URL("../schema.yaml", import.meta.url),
      "utf8",
    );
    const manifest = JSON.parse(
      readFileSync(new URL("../app.json", import.meta.url), "utf8"),
    );
    expect(manifest.room_slots[0]).toMatchObject({
      name: "crm",
      access: "write",
    });
    expect(manifest.room_slots[0].types.sort()).toEqual(
      Object.values(typeNames).sort(),
    );
    for (const type of Object.values(typeNames))
      expect(schema).toContain(`${type}:`);
  });
});

describe("Synthetic Room seed uses the published MD Model", () => {
  it("validates all 88 records and exposes donor task subtype through its storage alias", async () => {
    const { changes } = buildSeedChanges("atomic-crm-port");
    expect(changes).toHaveLength(89);
    expect(
      Object.values(seedRecords).reduce(
        (count, rows) => count + rows.length,
        0,
      ),
    ).toBe(88);
    const schema = verify(changes[0].content);
    expect(schema.verdict).toBe("accept");
    if (schema.verdict !== "accept") throw new Error("Schema refused");
    const library = Object.fromEntries(
      changes
        .slice(1)
        .map((change) => [
          change.path.replace("/rooms/atomic-crm-port/", ""),
          change.content,
        ]),
    );
    expect(validate(library, { binaryTargets: [] }, schema.model)).toEqual({
      verdict: "accept",
    });
    const documents = Object.entries(library).map(([path, markdown]) => {
      const parsed = parse(markdown, path);
      if (!parsed.ok) throw new Error("Seed Markdown did not parse");
      return {
        room: ROOM,
        path,
        type: parsed.document.type,
        fields: parsed.document.fields,
        markdown,
      };
    });
    const db = readCrm({ documents }, ROOM);
    expect(db.contacts).toHaveLength(24);
    expect(db.deals).toHaveLength(16);
    expect(db.tasks[0].type).toBe(seedRecords.tasks[0].type);
    expect(
      documents.find((document) => document.type === "crm_task")?.fields
        .task_type,
    ).toBe(seedRecords.tasks[0].type);
  });
  it("omits null creation fields and clears nullable text with a schema-valid empty string", async () => {
    const f = fixture([
      ["companies", company()],
      ["contacts", contact("contact-1", { company_id: "company-1" })],
    ]);
    await f.provider.create("contacts", {
      data: {
        first_name: "Nora",
        last_name: "Chen",
        company_id: null,
        title: null,
      },
    });
    expect(
      f.md.roomDraft.write.mock.calls[0][3].creation.fields,
    ).not.toHaveProperty("company_id");
    const { data } = await f.provider.getOne("contacts", { id: "contact-1" });
    await f.provider.update("contacts", {
      id: data.id,
      previousData: data,
      data: { company_id: null },
    });
    expect(f.md.roomDraft.write.mock.calls[1][3].fields.company_id).toEqual({
      value: "",
      base: { value: "company-1" },
    });
    const schema = verify(
      readFileSync(new URL("../schema.yaml", import.meta.url), "utf8"),
    );
    if (schema.verdict !== "accept") throw new Error("Schema refused");
    const good =
      '---\ntype: crm_task\nid: "task-1"\ncontact_id: "contact-1"\ntext: "Call"\ndue_date: "2026-10-01"\ndone_date: ""\n---\n';
    expect(
      validate({ "task.md": good }, { binaryTargets: [] }, schema.model)
        .verdict,
    ).toBe("accept");
    expect(
      validate(
        { "task.md": good.replace('done_date: ""', "done_date: null") },
        { binaryTargets: [] },
        schema.model,
      ).verdict,
    ).toBe("refuse");
  });
  it("stores new task type as task_type without replacing document type", async () => {
    const f = fixture([["contacts", contact()]]);
    await f.provider.create("tasks", {
      data: {
        contact_id: "contact-1",
        text: "Send proposal",
        type: "email",
        due_date: baseDate,
      },
    });
    expect(f.md.roomDraft.write.mock.calls[0][3].creation).toMatchObject({
      type: "crm_task",
      fields: { task_type: "email" },
    });
    expect(
      f.md.roomDraft.write.mock.calls[0][3].creation.fields,
    ).not.toHaveProperty("type");
  });
});

describe("Grouped bulk tagging", () => {
  const rows: [string, Record<string, any>][] = [
    ["tags", { id: "tag-1", name: "Priority", color: "#ff0000" }],
    ["tags", { id: "tag-2", name: "Referral", color: "#00ff00" }],
    ["contacts", contact("contact-1", { tags: ["tag-1"] })],
    ["contacts", contact("contact-2")],
  ];
  it("preserves existing tags, adds new tags once, and saves all contacts together", async () => {
    const f = fixture(rows);
    const { data } = await f.provider.getList("contacts", list);
    await f.provider.addTagsToContacts(data as any, ["tag-2", "tag-2"]);
    expect(f.md.save).toHaveBeenCalledOnce();
    expect(f.md.save.mock.calls[0][1]).toHaveLength(2);
    expect(
      (await f.provider.getOne("contacts", { id: "contact-1" })).data.tags,
    ).toEqual(["tag-1", "tag-2"]);
    expect(
      (await f.provider.getOne("contacts", { id: "contact-2" })).data.tags,
    ).toEqual(["tag-2"]);
  });
  it("does not draft any contact when a later contact has an existing draft", async () => {
    const f = fixture(rows);
    const { data } = await f.provider.getList("contacts", list);
    f.drafts.set("crm/contacts/contact-2.md", {
      returned: { kind: "conflicted" },
    });
    await expect(
      f.provider.addTagsToContacts(data as any, ["tag-2"]),
    ).rejects.toThrow("unfinished");
    expect(f.md.roomDraft.write).not.toHaveBeenCalled();
    expect(f.md.save).not.toHaveBeenCalled();
    expect(f.md.roomDraft.discard).not.toHaveBeenCalled();
  });
  it("refuses known stale tag snapshots and unknown tags before preparing drafts", async () => {
    const f = fixture(rows);
    const { data } = await f.provider.getList("contacts", list);
    const current = f.documents.find((doc) => doc.fields.id === "contact-2")!;
    current.fields.tags = '["tag-1"]';
    await expect(
      f.provider.addTagsToContacts(data as any, ["tag-2"]),
    ).rejects.toThrow("tags changed");
    expect(f.md.roomDraft.write).not.toHaveBeenCalled();
    const g = fixture(rows);
    const selected = await g.provider.getList("contacts", list);
    await expect(
      g.provider.addTagsToContacts(selected.data as any, ["missing"]),
    ).rejects.toThrow("missing tag");
    expect(g.md.roomDraft.write).not.toHaveBeenCalled();
  });
});

it("reports an unchanged edit as idle, never as a queued save", async () => {
  const f = fixture([["contacts", contact()]]);
  const { data } = await f.provider.getOne("contacts", { id: "contact-1" });
  await f.provider.update("contacts", {
    id: data.id,
    previousData: data,
    data: { first_name: "Ada" },
  });
  expect(f.md.save).not.toHaveBeenCalled();
  expect(f.statuses.map((status) => status.phase)).toEqual(["saving", "idle"]);
});

it("uses the exact merge source shown even after a newer background read", async () => {
  const f = fixture([
    ["contacts", contact()],
    ["contacts", contact("contact-2")],
  ]);
  const { data: original } = await f.provider.getOne("contacts", {
    id: "contact-1",
  });
  const current = f.documents.find((doc) => doc.fields.id === "contact-1")!;
  current.fields.first_name = "Updated";
  current.markdown += "\nNew content";
  await f.provider.getList("contacts", list);
  await expect(
    f.provider.mergeContacts("contact-1", "contact-2", original as any),
  ).rejects.toThrow("changed since");
  expect(f.md.roomDraft.write).not.toHaveBeenCalled();
});

describe("Persisted Room attachment descriptors", () => {
  const attachment = {
    path: "files/example",
    title: "Workshop outline.pdf",
    type: "application/pdf",
    size: 42,
    sha256: "a".repeat(64),
  };
  it("allows attachment-only notes and rejects empty notes", () => {
    const parent = document("contacts", contact());
    const withFile = document("contact_notes", {
      id: "note-1",
      contact_id: "contact-1",
      date: baseDate,
      attachments: [attachment],
    });
    expect(
      readCrm({ documents: [parent, withFile] }, ROOM).contact_notes[0]
        .attachments,
    ).toEqual([attachment]);
    expect(() =>
      readCrm(
        {
          documents: [
            parent,
            document("contact_notes", {
              id: "note-1",
              contact_id: "contact-1",
              date: baseDate,
              text: " ",
              attachments: [],
            }),
          ],
        },
        ROOM,
      ),
    ).toThrow("text or at least one");
  });
  it("rejects legacy URL/rawFile metadata and invalid attachment refs", () => {
    for (const logo of [
      { src: "https://example.test/photo.jpg", title: "Photo" },
      { rawFile: {} },
      { ...attachment, path: "https://example.test/image" },
      { ...attachment, sha256: "NOT-A-DIGEST" },
    ]) {
      expect(() =>
        readCrm(
          {
            documents: [document("companies", company("company-1", { logo }))],
          },
          ROOM,
        ),
      ).toThrow();
    }
  });
  it("makes note text optional in actual MD Model while preserving task text requirement", () => {
    const schema = verify(
      readFileSync(new URL("../schema.yaml", import.meta.url), "utf8"),
    );
    if (schema.verdict !== "accept") throw new Error("Schema refused");
    const markdown = `---\ntype: crm_contact_note\nid: "note-1"\ncontact_id: "contact-1"\ndate: "2026-10-11"\nattachments: ${JSON.stringify(JSON.stringify([attachment]))}\n---\n`;
    expect(
      validate({ "note.md": markdown }, { binaryTargets: [] }, schema.model),
    ).toEqual({ verdict: "accept" });
  });
});

describe("Room binary files", () => {
  const file = () => new File(["abc"], "brief.txt", { type: "text/plain" });
  const digest = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
  it("writes a binary Room Draft, queues it and reads the exact Room path", async () => {
    const f = fixture(), input = file();
    const asset = await f.provider.uploadAttachment(input);
    expect(asset).toEqual({path:expect.stringMatching(/^files\/[0-9a-f-]+$/),title:"brief.txt",type:"text/plain",size:3,sha256:digest});
    expect(f.md.roomDraft.write).toHaveBeenCalledWith(ROOM, asset.path, null, {file:{blob:input}});
    expect(f.md.save).toHaveBeenCalledWith(ROOM,[{path:asset.path,revision:"revision-1"}]);
    expect(f.statuses.at(-1)).toMatchObject({phase:"queued",message:expect.stringContaining("locally")});
    expect(await f.provider.getAttachment(asset.path)).toMatchObject({blob:input,status:"available",type:"text/plain"});
    expect(f.md.binaryFile.read).toHaveBeenCalledWith(ROOM,asset.path);
    expect(f.md.call).not.toHaveBeenCalled();
  });
  it("keeps the file draft and structured refusal when Save is refused without retrying", async () => {
    const f=fixture();const refusal={outcome:"refused",code:"new_refusal",retryable:false,location:"file"};
    f.md.save.mockResolvedValueOnce(refusal as never);
    await expect(f.provider.uploadAttachment(file())).rejects.toMatchObject({details:refusal,message:expect.stringContaining("new_refusal")});
    expect(f.pending.size).toBe(1);expect(f.md.save).toHaveBeenCalledOnce();expect(f.md.roomDraft.discard).not.toHaveBeenCalled();
  });
  it("preserves an uncertain Save and does not retry", async () => {
    const f=fixture();f.md.save.mockRejectedValueOnce(new Error("Lost save answer"));
    await expect(f.provider.uploadAttachment(file())).rejects.toThrow("Lost save answer");
    expect(f.pending.size).toBe(1);expect(f.md.save).toHaveBeenCalledOnce();
  });
  it("refuses a stale file draft before Save",async()=>{
    const f=fixture();f.md.roomDraft.write.mockResolvedValueOnce({outcome:"stale",current:null} as never);
    await expect(f.provider.uploadAttachment(file())).rejects.toThrow("stale");expect(f.md.save).not.toHaveBeenCalled();
  });
  it.each(["https://other.test/file","data:text/plain,abc","blob:local","../outside","files/../outside","/absolute","at_old"])("rejects an invalid path %s before reads", async path=>{
    const f=fixture();await expect(f.provider.getAttachment(path)).rejects.toThrow("path");expect(f.md.query).not.toHaveBeenCalled();expect(f.md.binaryFile.read).not.toHaveBeenCalled();
  });
  it.each(["room","path"])("does not read a metadata match from another %s",async kind=>{
    const f=fixture();const asset=await f.provider.uploadAttachment(file());
    f.md.query.mockResolvedValueOnce({documents:[{room:kind==="room"?"other":ROOM,path:kind==="path"?asset.path+"-other":asset.path,binaryFile:{}}]} as never);
    await expect(f.provider.getAttachment(asset.path)).rejects.toThrow("not declared");expect(f.md.binaryFile.read).not.toHaveBeenCalled();
  });
  it.each(["abcd","abd"])("checks file size and SHA-256 before returning bytes: %s",async bytes=>{
    const f=fixture();const asset=await f.provider.uploadAttachment(file());f.md.binaryFile.read.mockResolvedValueOnce({kind:"binary",blob:new Blob([bytes])});
    await expect(f.provider.getAttachment(asset.path)).rejects.toThrow("SHA-256");
  });
  it("keeps unknown read refusals unavailable, with no URL fallback or automatic retry",async()=>{
    const f=fixture();const asset=await f.provider.uploadAttachment(file());f.md.binaryFile.read.mockResolvedValueOnce({kind:"rejected",code:"new_refusal",retryable:true});
    expect(await f.provider.getAttachment(asset.path)).toMatchObject({blob:null,status:"unavailable"});expect(f.md.binaryFile.read).toHaveBeenCalledOnce();
  });
  it("links the queued binary using only its descriptor, not Blob bytes or an object URL",async()=>{
    const f=fixture([["contacts",contact()]]);const asset=await f.provider.uploadAttachment(file());
    await f.provider.create("contact_notes",{data:{contact_id:"contact-1",date:baseDate,attachments:[asset]}});
    const creation=f.md.roomDraft.write.mock.calls[1][3].creation;
    expect(JSON.parse(creation.fields.attachments)).toEqual([asset]);expect(JSON.stringify(creation)).not.toMatch(/rawFile|data:|blob:|"src"/);
    expect(f.md.call).not.toHaveBeenCalled();expect(f.md.save).toHaveBeenCalledTimes(2);
  });
  it("checks a reloaded descriptor against only local binary metadata while writes are halted",async()=>{
    const f=fixture([["contacts",contact()]]);f.setMode("write-halted");const asset={path:"files/known",title:"brief.txt",type:"text/plain",size:3,sha256:digest};
    const query=f.md.query.getMockImplementation()!;let scope="other",size=3;
    f.md.query.mockImplementation(async input=>(input as any)?.pathPrefix?{documents:[{room:scope,path:asset.path,binaryFile:{path:asset.path,byteLength:size,mediaType:asset.type,sha256:digest}}]} as never:query(input));
    await expect(f.provider.create("contact_notes",{data:{contact_id:"contact-1",date:baseDate,attachments:[asset]}})).rejects.toThrow("not declared");
    scope=ROOM;size=4;await expect(f.provider.create("contact_notes",{data:{contact_id:"contact-1",date:baseDate,attachments:[asset]}})).rejects.toThrow("does not match");
    size=3;await f.provider.create("contact_notes",{data:{contact_id:"contact-1",date:baseDate,attachments:[asset]}});
    expect(f.md.call).not.toHaveBeenCalled();expect(f.md.binaryFile.read).not.toHaveBeenCalled();expect(f.md.save).toHaveBeenCalledOnce();
  });
  it("queues binary Drafts locally during a provider write halt",async()=>{
    const f=fixture();f.setMode("write-halted");const asset=await f.provider.uploadAttachment(file());
    expect(asset.path).toMatch(/^files\//);expect(f.md.save).toHaveBeenCalledOnce();expect(f.md.call).not.toHaveBeenCalled();
  });
});

// These tests distinguish submitted full-form values from actual user edits.
// A field unchanged since opening must never rebase validation or returned data
// onto that stale value when another editor changed it in the Room.
describe("Adversarial stale full-form intent", () => {
  function concurrentChange(
    f: ReturnType<typeof fixture>,
    resource: string,
    id: string,
    patch: Record<string, unknown>,
  ) {
    const current = f.documents.find(
      (doc) => doc.path === `crm/${resource}/${id}.md`,
    )!;
    Object.assign(current.fields, document(resource, { id, ...patch }).fields);
    current.markdown = JSON.stringify(current.fields);
  }
  function removeDocument(
    f: ReturnType<typeof fixture>,
    resource: string,
    id: string,
  ) {
    f.documents.splice(
      f.documents.findIndex((doc) => doc.path === `crm/${resource}/${id}.md`),
      1,
    );
  }
  const companies = (): [string, Record<string, any>][] => [
    ["companies", company("company-old", { name: "Previous company" })],
    ["companies", company("company-current", { name: "Current company" })],
  ];

  it("validates an untouched concurrent reference rather than a stale full-form target that was deleted", async () => {
    const f = fixture([
      ...companies(),
      [
        "contacts",
        contact("contact-1", {
          company_id: "company-old",
          title: "Original title",
        }),
      ],
    ]);
    const { data: opened } = await f.provider.getOne("contacts", {
      id: "contact-1",
    });
    concurrentChange(f, "contacts", "contact-1", {
      company_id: "company-current",
      title: "Concurrent title",
    });
    removeDocument(f, "companies", "company-old");

    await expect(
      f.provider.update("contacts", {
        id: opened.id,
        previousData: opened,
        data: { ...opened, first_name: "Edited name" },
      }),
    ).resolves.toMatchObject({
      data: {
        company_id: "company-current",
        title: "Concurrent title",
        first_name: "Edited name",
      },
    });
    const fields = f.md.roomDraft.write.mock.calls[0][3].fields;
    expect(fields).not.toHaveProperty("company_id");
    expect(fields).not.toHaveProperty("title");
    expect(
      (await f.provider.getOne("contacts", { id: opened.id })).data.company_id,
    ).toBe("company-current");
  });

  it("returns current untouched fields for the contacts_summary alias, matching the actual queued mutation", async () => {
    const f = fixture([
      ...companies(),
      [
        "contacts",
        contact("contact-1", {
          company_id: "company-old",
          title: "Original title",
        }),
      ],
    ]);
    const { data: opened } = await f.provider.getOne("contacts_summary", {
      id: "contact-1",
    });
    concurrentChange(f, "contacts", "contact-1", {
      company_id: "company-current",
      title: "Concurrent title",
    });

    f.documents.push(
      document("tasks", {
        id: "task-current",
        contact_id: "contact-1",
        text: "Concurrent task",
        due_date: baseDate,
      }),
    );
    const result = await f.provider.update("contacts_summary", {
      id: opened.id,
      previousData: opened,
      data: { ...opened, first_name: "Edited name" },
    });
    const actual = (
      await f.provider.getOne("contacts_summary", { id: opened.id })
    ).data;
    expect(actual.company_id).toBe("company-current");
    expect(result.data.company_id).toBe(actual.company_id);
    expect(result.data.title).toBe(actual.title);
    expect(result.data.company_name).toBe(actual.company_name);
    expect(result.data.company_name).toBe("Current company");
    expect(result.data.nb_tasks).toBe(actual.nb_tasks);
    expect(result.data.nb_tasks).toBe(1);
    expect(result.data.has_newsletter).toBe(actual.has_newsletter);
    expect(result.data.has_newsletter).toBe(false);
    expect(result.data._house.fields.company_id).toBe("company-current");
    expect(result.data._house.fields.first_name).toBe("Ada");
    expect(f.md.roomDraft.write.mock.calls[0][3].fields).toEqual({
      first_name: { value: "Edited name", base: { value: "Ada" } },
    });
  });

  it("treats semantically unchanged JSON as untouched despite its original whitespace encoding", async () => {
    const f = fixture([
      ["tags", { id: "tag-old", name: "Old", color: "#ff0000" }],
      ["tags", { id: "tag-current", name: "Current", color: "#00ff00" }],
      ["contacts", contact("contact-1", { tags: ["tag-old"] })],
    ]);
    f.documents.find((doc) => doc.type === "crm_contact")!.fields.tags =
      '[ "tag-old" ]';
    const { data: opened } = await f.provider.getOne("contacts", {
      id: "contact-1",
    });
    concurrentChange(f, "contacts", "contact-1", {
      tags: ["tag-current"],
      phone_jsonb: [{ number: "+1-202-555-0142", type: "Work" }],
    });
    removeDocument(f, "tags", "tag-old");

    await expect(
      f.provider.update("contacts", {
        id: opened.id,
        previousData: opened,
        data: { ...opened, first_name: "Edited name" },
      }),
    ).resolves.toMatchObject({
      data: {
        tags: ["tag-current"],
        phone_jsonb: [{ number: "+1-202-555-0142", type: "Work" }],
      },
    });
    const fields = f.md.roomDraft.write.mock.calls[0][3].fields;
    expect(fields).not.toHaveProperty("tags");
    expect(fields).not.toHaveProperty("phone_jsonb");
  });

  it("applies updateMany intent per opened record and retains concurrent untouched references", async () => {
    const f = fixture([
      ...companies(),
      [
        "contacts",
        contact("contact-1", { company_id: "company-old", status: "cold" }),
      ],
      [
        "contacts",
        contact("contact-2", { company_id: "company-old", status: "cold" }),
      ],
    ]);
    await f.provider.getList("contacts", list);
    concurrentChange(f, "contacts", "contact-1", {
      company_id: "company-current",
    });
    concurrentChange(f, "contacts", "contact-2", {
      company_id: "company-current",
    });
    removeDocument(f, "companies", "company-old");

    await expect(
      f.provider.updateMany("contacts", {
        ids: ["contact-1", "contact-2"],
        data: { company_id: "company-old", status: "warm" },
      }),
    ).resolves.toEqual({ data: ["contact-1", "contact-2"] });
    expect(f.md.save).toHaveBeenCalledOnce();
    expect(f.md.save.mock.calls[0][1]).toHaveLength(2);
    for (const call of f.md.roomDraft.write.mock.calls)
      expect(call[3].fields).toEqual({
        status: { value: "warm", base: { value: "cold" } },
      });
    expect(
      (await f.provider.getList("contacts", list)).data.every(
        (row) => row.company_id === "company-current",
      ),
    ).toBe(true);
  });

  it("skips a shared bulk value only for records where it was actually unchanged", async () => {
    const f = fixture([
      [
        "contacts",
        contact("contact-1", { first_name: "Ada", title: "Old role" }),
      ],
      [
        "contacts",
        contact("contact-2", { first_name: "Nora", title: "Old role" }),
      ],
    ]);
    await f.provider.getList("contacts", list);
    concurrentChange(f, "contacts", "contact-1", {
      first_name: "Concurrent Ada",
    });
    concurrentChange(f, "contacts", "contact-2", {
      first_name: "Concurrent Nora",
    });
    await f.provider.updateMany("contacts", {
      ids: ["contact-1", "contact-2"],
      data: { first_name: "Ada", title: "New role" },
    });
    const first = f.md.roomDraft.write.mock.calls.find((call) =>
      call[1].endsWith("/contact-1.md"),
    )![3].fields;
    const second = f.md.roomDraft.write.mock.calls.find((call) =>
      call[1].endsWith("/contact-2.md"),
    )![3].fields;
    expect(first).not.toHaveProperty("first_name");
    expect(second.first_name).toEqual({
      value: "Ada",
      base: { value: "Nora" },
    });
    expect(first.title.base).toEqual({ value: "Old role" });
  });

  it("preserves the current task subtype and reference through full-form task_type alias updates", async () => {
    const f = fixture([
      ["contacts", contact("contact-old")],
      ["contacts", contact("contact-current")],
      [
        "tasks",
        {
          id: "task-1",
          contact_id: "contact-old",
          type: "call",
          text: "Old task",
          due_date: baseDate,
        },
      ],
    ]);
    const { data: opened } = await f.provider.getOne("tasks", { id: "task-1" });
    concurrentChange(f, "tasks", "task-1", {
      contact_id: "contact-current",
      type: "email",
    });
    removeDocument(f, "contacts", "contact-old");
    await expect(
      f.provider.update("tasks", {
        id: opened.id,
        previousData: opened,
        data: { ...opened, text: "Edited task" },
      }),
    ).resolves.toMatchObject({
      data: {
        contact_id: "contact-current",
        type: "email",
        text: "Edited task",
      },
    });
    expect(f.md.roomDraft.write.mock.calls[0][3].fields).toEqual({
      text: { value: "Edited task", base: { value: "Old task" } },
    });
  });

  it("retains original exact conflict bases for real JSON and aliased edits", async () => {
    const f = fixture([
      ["tags", { id: "tag-old", name: "Old", color: "#ff0000" }],
      ["tags", { id: "tag-current", name: "Current", color: "#00ff00" }],
      ["tags", { id: "tag-edited", name: "Edited", color: "#0000ff" }],
      ["contacts", contact("contact-1", { tags: ["tag-old"] })],
      [
        "tasks",
        {
          id: "task-1",
          contact_id: "contact-1",
          type: "call",
          text: "Task",
          due_date: baseDate,
        },
      ],
    ]);
    f.documents.find((doc) => doc.type === "crm_contact")!.fields.tags =
      '[ "tag-old" ]';
    const { data: openedContact } = await f.provider.getOne("contacts", {
      id: "contact-1",
    });
    const { data: openedTask } = await f.provider.getOne("tasks", {
      id: "task-1",
    });
    concurrentChange(f, "contacts", "contact-1", { tags: ["tag-current"] });
    concurrentChange(f, "tasks", "task-1", { type: "email" });
    await f.provider.update("contacts", {
      id: openedContact.id,
      previousData: openedContact,
      data: { ...openedContact, tags: ["tag-edited"] },
    });
    await f.provider.update("tasks", {
      id: openedTask.id,
      previousData: openedTask,
      data: { ...openedTask, type: "demo" },
    });
    expect(f.md.roomDraft.write.mock.calls[0][3].fields.tags).toEqual({
      value: '["tag-edited"]',
      base: { value: '[ "tag-old" ]' },
    });
    expect(f.md.roomDraft.write.mock.calls[1][3].fields.task_type).toEqual({
      value: "demo",
      base: { value: "call" },
    });
    expect(f.md.roomDraft.write.mock.calls[1][3].fields).not.toHaveProperty(
      "type",
    );
  });

  it("still rejects a real edit to a missing reference before preparing any grouped draft", async () => {
    const f = fixture([
      ...companies(),
      [
        "contacts",
        contact("contact-1", { company_id: "company-old", status: "cold" }),
      ],
      [
        "contacts",
        contact("contact-2", { company_id: "company-current", status: "cold" }),
      ],
    ]);
    await f.provider.getList("contacts", list);
    concurrentChange(f, "contacts", "contact-1", {
      company_id: "company-current",
    });
    removeDocument(f, "companies", "company-old");
    // company-old is unchanged for contact-1 but an actual invalid edit for contact-2.
    await expect(
      f.provider.updateMany("contacts", {
        ids: ["contact-1", "contact-2"],
        data: { company_id: "company-old", status: "warm" },
      }),
    ).rejects.toThrow("missing");
    expect(f.md.roomDraft.write).not.toHaveBeenCalled();
    expect(f.md.save).not.toHaveBeenCalled();
  });

  it("cannot delete the actual concurrent reference target after an unrelated stale-form edit", async () => {
    const f = fixture([
      ...companies(),
      ["contacts", contact("contact-1", { company_id: "company-old" })],
    ]);
    const { data: opened } = await f.provider.getOne("contacts", {
      id: "contact-1",
    });
    concurrentChange(f, "contacts", "contact-1", {
      company_id: "company-current",
    });
    await f.provider.update("contacts", {
      id: opened.id,
      previousData: opened,
      data: { ...opened, first_name: "Edited name" },
    });
    const { data: currentCompany } = await f.provider.getOne("companies", {
      id: "company-current",
    });
    f.md.roomDraft.write.mockClear();
    f.md.save.mockClear();
    await expect(
      f.provider.delete("companies", {
        id: currentCompany.id,
        previousData: currentCompany,
      }),
    ).rejects.toThrow("still referenced");
    expect(f.md.roomDraft.write).not.toHaveBeenCalled();
    expect(f.md.save).not.toHaveBeenCalled();
  });
});

describe("Adversarial compound and custom mutation intent", () => {
  const attachment = {
    path: "files/existing",
    title: "Existing brief.pdf",
    type: "application/pdf",
  };
  function change(
    f: ReturnType<typeof fixture>,
    resource: string,
    id: string,
    patch: Record<string, unknown>,
  ) {
    const current = f.documents.find(
      (doc) => doc.path === `crm/${resource}/${id}.md`,
    )!;
    Object.assign(current.fields, document(resource, { id, ...patch }).fields);
    current.markdown = JSON.stringify(current.fields);
  }

  it("allows clearing note text when a concurrent untouched attachment keeps the effective note valid", async () => {
    const f = fixture([
      ["contacts", contact()],
      [
        "contact_notes",
        {
          id: "note-1",
          contact_id: "contact-1",
          date: baseDate,
          text: "Opened note text",
          attachments: [],
        },
      ],
    ]);
    const { data: opened } = await f.provider.getOne("contact_notes", {
      id: "note-1",
    });
    change(f, "contact_notes", "note-1", {
      text: "Concurrent text",
      attachments: [attachment],
    });
    await expect(
      f.provider.update("contact_notes", {
        id: opened.id,
        previousData: opened,
        data: { text: "" },
      }),
    ).resolves.toMatchObject({ data: { text: "", attachments: [attachment] } });
    expect(f.md.roomDraft.write.mock.calls[0][3].fields).toEqual({
      text: { value: "", base: { value: "Opened note text" } },
    });
    expect(f.md.call).not.toHaveBeenCalled();
  });

  it("rejects attachment removal that would empty the current note even when stale form text was nonempty", async () => {
    const f = fixture([
      ["contacts", contact()],
      [
        "contact_notes",
        {
          id: "note-1",
          contact_id: "contact-1",
          date: baseDate,
          text: "Opened note text",
          attachments: [attachment],
        },
      ],
    ]);
    const { data: opened } = await f.provider.getOne("contact_notes", {
      id: "note-1",
    });
    change(f, "contact_notes", "note-1", { text: "" });
    await expect(
      f.provider.update("contact_notes", {
        id: opened.id,
        previousData: opened,
        data: { ...opened, attachments: [] },
      }),
    ).rejects.toThrow("text or at least one");
    expect(f.md.roomDraft.write).not.toHaveBeenCalled();
    expect(f.md.save).not.toHaveBeenCalled();
  });

  it("returns current untouched names, queued timestamps, and current fetched snapshots from moveDeal", async () => {
    const f = fixture([
      ["companies", company()],
      ["deals", deal("deal-1", { name: "Opened source" })],
      [
        "deals",
        deal("deal-2", { name: "Opened destination", stage: "proposal-sent" }),
      ],
    ]);
    const { data: opened } = await f.provider.getList("deals", list);
    change(f, "deals", "deal-1", { name: "Concurrent source" });
    change(f, "deals", "deal-2", { name: "Concurrent destination" });
    const result = (await f.provider.moveDeal(
      opened[0] as any,
      "proposal-sent",
      [opened[0], opened[1]] as any,
    )) as { data: Record<string, any>[] };
    expect(result.data.map((row) => row.name)).toEqual([
      "Concurrent source",
      "Concurrent destination",
    ]);
    for (const row of result.data) {
      const write = f.md.roomDraft.write.mock.calls.find((call) =>
        call[1].endsWith(`/${row.id}.md`),
      )![3].fields;
      expect(row.updated_at).toBe(write.updated_at.value);
      expect(row._house.fields.name).toBe(row.name);
      expect(row._house.fields.updated_at).toBe(baseDate);
      expect(write).not.toHaveProperty("name");
    }
  });

  it("returns the current untouched deal name and queued timestamp when unarchiving", async () => {
    const f = fixture([
      ["companies", company()],
      [
        "deals",
        deal("deal-1", {
          name: "Opened deal",
          archived_at: "2026-10-02T10:00:00Z",
        }),
      ],
    ]);
    const { data: opened } = await f.provider.getOne("deals", { id: "deal-1" });
    change(f, "deals", "deal-1", { name: "Concurrent deal" });
    const result = (await f.provider.unarchiveDeal(opened as any)) as {
      data: Record<string, any>;
    };
    const fields = f.md.roomDraft.write.mock.calls[0][3].fields;
    expect(result.data.name).toBe("Concurrent deal");
    expect(result.data.updated_at).toBe(fields.updated_at.value);
    expect(result.data.archived_at).toBeFalsy();
    expect(result.data._house.fields.name).toBe("Concurrent deal");
    expect(result.data._house.fields.archived_at).toBe("2026-10-02T10:00:00Z");
    expect(fields).not.toHaveProperty("name");
  });

  it("returns current configuration for an unchanged stale configuration submission without queuing a write", async () => {
    const f = fixture([
      [
        "configuration",
        { id: "1", config: { title: "Opened title", currency: "USD" } },
      ],
    ]);
    const opened = await f.provider.getConfiguration();
    change(f, "configuration", "1", {
      config: { title: "Concurrent title", currency: "EUR" },
    });
    expect(await f.provider.updateConfiguration(opened)).toEqual({
      title: "Concurrent title",
      currency: "EUR",
    });
    expect(f.md.roomDraft.write).not.toHaveBeenCalled();
    expect(f.md.save).not.toHaveBeenCalled();
    expect(f.statuses.at(-1)?.phase).toBe("idle");
  });
});

it("rejects stale Kanban ordering when concurrent indices swapped before the drag save", async () => {
  const f = fixture([
    ["companies", company()],
    ["deals", deal("deal-1", { index: 0 })],
    ["deals", deal("deal-2", { index: 1 })],
  ]);
  const { data: opened } = await f.provider.getList("deals", list);
  for (const doc of f.documents.filter((item) => item.type === "crm_deal")) {
    doc.fields.index = doc.fields.id === "deal-1" ? 1 : 0;
    doc.markdown = JSON.stringify(doc.fields);
  }
  await expect(
    f.provider.moveDeal(opened[0] as any, "opportunity", [
      opened[0],
      opened[1],
    ] as any),
  ).rejects.toThrow(/order|index|refresh|changed/i);
  expect(f.md.roomDraft.write).not.toHaveBeenCalled();
  expect(f.md.save).not.toHaveBeenCalled();
});

it("treats reordered configuration object keys as a semantic no-op and returns current config", async () => {
  const f = fixture([
    [
      "configuration",
      { id: "1", config: { title: "Opened title", currency: "USD" } },
    ],
  ]);
  await f.provider.getConfiguration();
  const current = f.documents[0];
  current.fields.config = JSON.stringify({
    title: "Concurrent title",
    currency: "EUR",
  });
  current.markdown = JSON.stringify(current.fields);
  expect(
    await f.provider.updateConfiguration({
      currency: "USD",
      title: "Opened title",
    } as any),
  ).toEqual({ title: "Concurrent title", currency: "EUR" });
  expect(f.md.roomDraft.write).not.toHaveBeenCalled();
  expect(f.md.save).not.toHaveBeenCalled();
});

it("treats reordered keys inside unchanged attachment JSON as untouched and retains the current asset", async () => {
  const oldAsset = {
    path: "files/old",
    title: "Old brief.pdf",
    type: "application/pdf",
  };
  const currentAsset = {
    path: "files/current",
    title: "Current brief.pdf",
    type: "application/pdf",
  };
  const f = fixture([
    ["contacts", contact()],
    [
      "contact_notes",
      {
        id: "note-1",
        contact_id: "contact-1",
        text: "Opened note",
        date: baseDate,
        attachments: [oldAsset],
      },
    ],
  ]);
  const { data: opened } = await f.provider.getOne("contact_notes", {
    id: "note-1",
  });
  const current = f.documents.find((doc) => doc.type === "crm_contact_note")!;
  current.fields.attachments = JSON.stringify([currentAsset]);
  current.markdown = JSON.stringify(current.fields);
  const result = await f.provider.update("contact_notes", {
    id: opened.id,
    previousData: opened,
    data: {
      ...opened,
      text: "Edited note",
      attachments: [
        {
          type: "application/pdf",
          title: "Old brief.pdf",
          path: "files/old",
        },
      ],
    },
  });
  expect(result.data.attachments).toEqual([currentAsset]);
  expect(f.md.roomDraft.write.mock.calls[0][3].fields).not.toHaveProperty(
    "attachments",
  );
  expect(f.md.call).not.toHaveBeenCalled();
});

it("preserves concurrent changes to displayed defaults whose fields were originally absent", async () => {
  const f = fixture([
    ["tags", { id: "tag-current", name: "Current", color: "#00ff00" }],
    ["contacts", contact("contact-1")],
  ]);
  const current = f.documents.find((doc) => doc.type === "crm_contact")!;
  delete current.fields.tags;
  delete current.fields.has_newsletter;
  current.markdown = JSON.stringify(current.fields);
  const { data: opened } = await f.provider.getOne("contacts", {
    id: "contact-1",
  });
  expect(opened.tags).toEqual([]);
  expect(opened.has_newsletter).toBe(false);
  current.fields.tags = '["tag-current"]';
  current.fields.has_newsletter = "true";
  current.markdown = JSON.stringify(current.fields);
  const result = await f.provider.update("contacts", {
    id: opened.id,
    previousData: opened,
    data: { ...opened, first_name: "Edited name" },
  });
  expect(result.data.tags).toEqual(["tag-current"]);
  expect(result.data.has_newsletter).toBe(true);
  expect(f.md.roomDraft.write.mock.calls[0][3].fields).toEqual({
    first_name: { value: "Edited name", base: { value: "Ada" } },
  });
});

it("keeps exact original object JSON bytes as the conflict base for a real configuration edit", async () => {
  const f = fixture([
    [
      "configuration",
      { id: "1", config: { title: "Opened", currency: "USD" } },
    ],
  ]);
  const originalEncoding = ' { "currency": "USD", "title": "Opened" } ';
  f.documents[0].fields.config = originalEncoding;
  await f.provider.getConfiguration();
  f.documents[0].fields.config = '{"title":"Concurrent","currency":"EUR"}';
  f.documents[0].markdown = JSON.stringify(f.documents[0].fields);
  await f.provider.updateConfiguration({
    title: "Edited",
    currency: "USD",
  } as any);
  expect(f.md.roomDraft.write.mock.calls[0][3].fields.config).toEqual({
    value: '{"title":"Edited","currency":"USD"}',
    base: { value: originalEncoding },
  });
});

it("preserves concurrent tags when stored JSON null was displayed as an untouched empty array", async () => {
  const f = fixture([
    ["tags", { id: "tag-current", name: "Current", color: "#00ff00" }],
    ["contacts", contact("contact-1")],
  ]);
  const current = f.documents.find((doc) => doc.type === "crm_contact")!;
  current.fields.tags = "null";
  current.markdown = JSON.stringify(current.fields);
  const { data: opened } = await f.provider.getOne("contacts", {
    id: "contact-1",
  });
  expect(opened.tags).toEqual([]);
  expect(opened._house.fields.tags).toBe("null");
  current.fields.tags = '["tag-current"]';
  current.markdown = JSON.stringify(current.fields);
  const result = await f.provider.update("contacts", {
    id: opened.id,
    previousData: opened,
    data: { ...opened, first_name: "Edited name" },
  });
  expect(result.data.tags).toEqual(["tag-current"]);
  expect(f.md.roomDraft.write.mock.calls[0][3].fields).not.toHaveProperty(
    "tags",
  );
});

describe("local CSV through the actual Room provider with mocked Runtime", () => {
  it("queues synthetic company/contact/tag/deal records through unchanged generic CRUD", async () => {
    const f = fixture();
    expect(
      await importRows(
        "companies",
        [{ name: "Fictional Maple" }],
        f.provider,
        defaultConfiguration,
        null,
      ),
    ).toEqual({ created: 1, errors: [] });
    expect(
      await importRows(
        "contacts",
        [
          {
            first_name: "Ada",
            last_name: "Rivera",
            company: "Fictional Maple",
            tags: "Pilot",
            phone_work: "00123",
          },
        ],
        f.provider,
        defaultConfiguration,
        null,
      ),
    ).toEqual({ created: 1, errors: [] });
    expect(
      await importRows(
        "deals",
        [
          {
            name: "Sample workshop",
            company: "Fictional Maple",
            amount: "4500.50",
          },
        ],
        f.provider,
        defaultConfiguration,
        null,
      ),
    ).toEqual({ created: 1, errors: [] });
    const db = readCrm({ documents: f.documents }, ROOM);
    expect(db.companies).toHaveLength(1);
    expect(db.contacts).toHaveLength(1);
    expect(db.tags).toHaveLength(1);
    expect(db.deals).toHaveLength(1);
    expect(db.contacts[0].company_id).toBe(db.companies[0].id);
    expect(db.contacts[0].phone_jsonb[0].number).toBe("00123");
    expect(db.deals[0]).toMatchObject({ amount: 4500.5, index: 0 });
    expect(db.contacts[0].sales_id).toBeUndefined();
    expect(f.md.call).not.toHaveBeenCalled();
    expect(f.md.save).toHaveBeenCalledTimes(4);
  });
  it("preserves an import refusal and prepared draft without retry", async () => {
    const f = fixture();
    f.md.save.mockResolvedValueOnce({
      outcome: "refused",
      code: "read_only", retryable: false,
    } as any);
    const result = await importRows(
      "companies",
      [{ name: "Fictional Maple" }],
      f.provider,
      defaultConfiguration,
      null,
    );
    expect(result.created).toBe(0);
    expect(result.errors[0]).toContain("read_only");
    expect(result.errors[0]).toContain("Drafts have been kept");
    expect(f.md.save).toHaveBeenCalledTimes(1);
    expect(f.md.roomDraft.discard).not.toHaveBeenCalled();
    expect(f.pending.size).toBe(1);
  });
});


it('refuses stale provider reads and preserves drafts when readiness is lost during save preparation', async () => {
 const f=fixture([['companies',company()]]);let available=false;
 const provider=createHouseDataProvider(f.md as unknown as HouseRuntime,ROOM,{isAvailable:()=>available});
 await expect(provider.getList('companies',{pagination:{page:1,perPage:10},sort:{field:'id',order:'ASC' as const},filter:{}})).rejects.toThrow(/binding is not ready/);
 expect(f.md.query).not.toHaveBeenCalled();
 available=true;const before=(await provider.getOne('companies',{id:'company-1'})).data;
 f.md.roomDraft.read.mockImplementationOnce(async()=>{available=false;return null;});
 await expect(provider.update('companies',{id:before.id,data:{name:'Unsaved edit'},previousData:before})).rejects.toThrow(/binding is not ready/);
 expect(f.md.roomDraft.write).not.toHaveBeenCalled();expect(f.md.save).not.toHaveBeenCalled();expect(f.md.roomDraft.discard).not.toHaveBeenCalled();
});


it('renders newly visited donor pages synchronously from one observed local snapshot', async () => {
 const f=fixture([['companies',company()]]);
 const provider=createHouseDataProvider(f.md as unknown as HouseRuntime,ROOM,{observed:true});
 provider.setObservedSnapshot({documents:f.documents});
 const client=new QueryClient({defaultOptions:{queries:{staleTime:Infinity,refetchOnMount:false,retry:false}}});
 const projection=connectLocalQueryProjection(client,provider);
 const queryFn=vi.fn(async()=>{throw new Error('Navigation must not fetch')});
 const params={pagination:{page:1,perPage:10},sort:{field:'id',order:'ASC' as const},filter:{}};
 const listObserver=new QueryObserver(client,{queryKey:['companies','getList',params],queryFn});
 expect(listObserver.getCurrentResult().isPending).toBe(false);
 expect((listObserver.getCurrentResult().data as any).data).toHaveLength(1);
 const recordObserver=new QueryObserver(client,{queryKey:['companies','getOne',{id:'company-1'}],queryFn});
 expect(recordObserver.getCurrentResult().isPending).toBe(false);
 const unsubscribe=recordObserver.subscribe(()=>{});
 expect(queryFn).not.toHaveBeenCalled();expect(f.md.query).not.toHaveBeenCalled();
 await provider.getList('companies',params);await provider.getOne('companies',{id:'company-1'});
 expect(f.md.query).not.toHaveBeenCalled();
 const updated=structuredClone(f.documents);updated[0].fields.name='Observed change';
 provider.setObservedSnapshot({documents:updated});projection.refresh();
 expect((recordObserver.getCurrentResult().data as any).name).toBe('Observed change');
 const infinite=provider.getLocalResult(['companies','getInfiniteList',params]);
 expect((infinite.value as any).pages[0].data).toHaveLength(1);
 unsubscribe();projection.close();client.clear();
});


it('never mutates the observed replica during local Save preparation or refusal', async () => {
 const f=fixture(); const provider=createHouseDataProvider(f.md as unknown as HouseRuntime,ROOM,{observed:true});
 provider.setObservedSnapshot({documents:[]});
 f.md.save.mockResolvedValueOnce({outcome:'refused',code: 'invalid-document', retryable: false} as any);
 await expect(provider.create('companies',{data:company()})).rejects.toThrow('invalid-document');
 const view=provider.getLocalResult(['companies','getList',{pagination:{page:1,perPage:10},filter:{}}]);
 expect((view.value as any).data).toEqual([]); expect(f.md.query).not.toHaveBeenCalled();
});
