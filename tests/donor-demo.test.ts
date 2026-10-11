// @vitest-environment node
import { test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { verify, validate } from "@agentshouse/mdmodel";
// @ts-expect-error Offline JavaScript fixture CLI.
import { seedRecords, buildSeedChanges } from "../scripts/donor-seed-data.mjs";
const hash = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");
test("full pinned Atomic CRM generator output preserves all records and references", () => {
  const manifest = JSON.parse(
    readFileSync(
      new URL("./support/donor-demo/provenance.json", import.meta.url),
      "utf8",
    ),
  );
  expect(manifest.commit).toBe("8b5d47ba32190c68801a427ef7682d7a6afc14e0");
  expect(manifest.counts).toEqual({
    sales: 6,
    tags: 6,
    companies: 55,
    contacts: 500,
    contact_notes: 1200,
    deals: 50,
    deal_notes: 300,
    tasks: 400,
    configuration: 1,
  });
  expect(
    hash(
      readFileSync(
        new URL("./support/donor-demo/records.json", import.meta.url),
      ),
    ),
  ).toBe(manifest.outputSha256);
  expect(
    hash(
      readFileSync(
        new URL("./support/donor-demo/package-lock.json", import.meta.url),
      ),
    ),
  ).toBe(manifest.lockSha256);
  for (const [path, expected] of Object.entries(manifest.sources))
    expect(
      hash(
        readFileSync(
          new URL(`./support/donor-demo/upstream/${path}`, import.meta.url),
        ),
      ),
    ).toBe(expected);
  const ids = Object.fromEntries(
    Object.entries(seedRecords).map(([resource, rows]) => [
      resource,
      new Set((rows as any[]).map((row) => row.id)),
    ]),
  );
  for (const [resource, rows] of Object.entries(seedRecords))
    for (const row of rows as any[]) {
      expect(row.id).toMatch(
        resource === "configuration" ? /^1$/ : /^donor-\d+$/,
      );
      for (const [key, target] of Object.entries({
        company_id: "companies",
        contact_id: "contacts",
        deal_id: "deals",
        sales_id: "sales",
      }))
        if (row[key] != null)
          expect(
            ids[target].has(row[key]),
            `${resource}.${row.id}.${key}`,
          ).toBe(true);
      for (const id of row.contact_ids ?? [])
        expect(ids.contacts.has(id)).toBe(true);
      for (const id of row.tags ?? []) expect(ids.tags.has(id)).toBe(true);
      for (const key of ["avatar", "logo"])
        if (row[key]) expect(row[key]).toEqual({});
      expect(row).not.toHaveProperty("password");
      expect(row).not.toHaveProperty("user_id");
    }
  const { changes } = buildSeedChanges("crm-port");
  expect(changes).toHaveLength(2519);
  const result = verify(changes[0].content);
  expect(result.verdict).toBe("accept");
  if (result.verdict !== "accept") throw Error("schema refused");
  const library = Object.fromEntries(
    changes
      .slice(1)
      .map((change: any) => [
        change.path.replace("/rooms/crm-port/", ""),
        change.content,
      ]),
  );
  expect(validate(library, { binaryTargets: [] }, result.model)).toEqual({
    verdict: "accept",
  });
});
