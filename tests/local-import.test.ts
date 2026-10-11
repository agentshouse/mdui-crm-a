import { describe, expect, it, vi } from "vitest";
import type { ImportRow } from "../src/components/atomic-crm/dataImport/types";
import type { DataProvider } from "ra-core";
import { importRows } from "../src/components/atomic-crm/dataImport/localImport";
import { defaultConfiguration } from "../src/components/atomic-crm/root/defaultConfiguration";
const cfg = defaultConfiguration;
function fixture() {
  const rows: Record<string, any[]> = {
    companies: [],
    contacts: [],
    deals: [],
    tags: [],
    sales: [{ id: "team-1", first_name: "Sales", last_name: "Team" }],
  };
  const provider = {
    getOne: vi.fn(async (resource: string, { id }: any) => {
      const data = rows[resource].find((row) => row.id === id);
      if (!data) throw new Error("Not found");
      return { data };
    }),
    getList: vi.fn(async (resource: string, { filter }: any) => {
      const data = rows[resource].filter((row) => row.name === filter.name);
      return { data, total: data.length };
    }),
    create: vi.fn(async (resource: string, { data }: any) => {
      const row = { id: `${resource}-${rows[resource].length + 1}`, ...data };
      rows[resource].push(row);
      return { data: row };
    }),
  };
  return {
    rows,
    provider: provider as unknown as DataProvider,
    methods: provider,
  };
}
describe("local CSV mappings over ordinary House CRUD", () => {
  it("creates company with explicitly unassigned owner and preserves leading zero fields", async () => {
    const f = fixture();
    expect(
      await importRows(
        "companies",
        [
          {
            name: "Acme",
            zipcode: "02134",
            phone_number: "001234",
            tax_identifier: "0007",
            size: "11",
          },
        ],
        f.provider,
        cfg,
        null,
      ),
    ).toEqual({ created: 1, errors: [] });
    expect(f.rows.companies[0]).toMatchObject({
      sales_id: null,
      zipcode: "02134",
      phone_number: "001234",
      tax_identifier: "0007",
      size: 50,
    });
    expect(f.methods.getOne).not.toHaveBeenCalled();
  });
  it("validates explicit team label and propagates it to related company and contact", async () => {
    const f = fixture();
    expect(
      await importRows(
        "contacts",
        [
          {
            first_name: "Ada",
            last_name: "Rivera",
            company: "New studio",
            tags: "Partner, Partner",
            has_newsletter: "false",
            phone_work: "00123",
          },
        ],
        f.provider,
        cfg,
        "team-1",
      ),
    ).toEqual({ created: 1, errors: [] });
    expect(f.methods.getOne).toHaveBeenCalledWith("sales", { id: "team-1" });
    expect(f.rows.companies[0].sales_id).toBe("team-1");
    expect(f.rows.contacts[0]).toMatchObject({
      sales_id: "team-1",
      has_newsletter: false,
      company_id: "companies-1",
      tags: ["tags-1"],
      phone_jsonb: [{ number: "00123", type: "Work" }],
    });
    expect(f.rows.tags).toHaveLength(1);
  });
  it("reuses exact names and rejects ambiguous matches rather than guessing", async () => {
    const f = fixture();
    f.rows.companies.push(
      { id: "c1", name: "Acme" },
      { id: "c2", name: "Acme" },
    );
    const result = await importRows(
      "deals",
      [{ name: "Deal", company: "Acme" }],
      f.provider,
      cfg,
      null,
    );
    expect(result.created).toBe(0);
    expect(result.errors[0]).toContain("More than one");
    expect(f.methods.create).not.toHaveBeenCalled();
  });
  it("uses provider-owned live appended index and preserves decimal amounts", async () => {
    const f = fixture();
    f.rows.companies.push({ id: "c1", name: "Acme" });
    const result = await importRows(
      "deals",
      [
        {
          name: "Deal",
          company: "Acme",
          amount: "4500.50",
          expected_closing_date: "2026-10-15",
        },
      ],
      f.provider,
      cfg,
      null,
    );
    expect(result.created).toBe(1);
    expect(f.rows.deals[0]).toMatchObject({
      amount: 4500.5,
      company_id: "c1",
      sales_id: null,
    });
    expect(f.rows.deals[0]).not.toHaveProperty("index");
  });
  it.each([
    { first_name: "Ada", company: "Not created" },
    { first_name: "Ada", last_name: "Rivera", has_newsletter: "maybe" },
    { first_name: "Ada", last_name: "Rivera", first_seen: "2026-02-31" },
    {
      first_name: "Ada",
      last_name: "Rivera",
      avatar: "https://example.test/x.png",
    },
    { first_name: "Ada", last_name: "Rivera", sales_id: "someone" },
  ])(
    "rejects invalid/unsupported contact before any side effect",
    async (row) => {
      const f = fixture();
      const result = await importRows(
        "contacts",
        [row as unknown as ImportRow],
        f.provider,
        cfg,
        null,
      );
      expect(result.created).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(f.methods.create).not.toHaveBeenCalled();
      expect(f.methods.getList).not.toHaveBeenCalled();
    },
  );
  it("never infers or silently accepts an unavailable assignment", async () => {
    const f = fixture();
    expect(
      (
        await importRows(
          "companies",
          [{ name: "Acme" }],
          f.provider,
          cfg,
          "missing",
        )
      ).errors[0],
    ).toContain("Not found");
    expect(f.methods.create).not.toHaveBeenCalled();
  });
  it("reports refused parent after related creation and never retries", async () => {
    const f = fixture();
    f.methods.create.mockImplementation(async (resource, data) => {
      if (resource === "contacts") throw new Error("House writes are paused");
      return { data: { id: "new-company", ...data.data } };
    });
    const result = await importRows(
      "contacts",
      [{ first_name: "Ada", last_name: "R", company: "New studio" }],
      f.provider,
      cfg,
      null,
    );
    expect(result.created).toBe(0);
    expect(result.errors[0]).toContain("House writes are paused");
    expect(result.errors[0]).toContain("Related company/tag records");
    expect(f.methods.create).toHaveBeenCalledTimes(2);
  });
});
