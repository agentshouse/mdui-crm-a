#!/usr/bin/env node
// Full pinned donor dataset. Offline only; never imported by the production App.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const resourceTypes = {
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
export const seedRecords = JSON.parse(
  readFileSync(new URL("./donor-demo/records.json", import.meta.url), "utf8"),
);
/** Keep all frontmatter values primitive; JSON text stays under its donor key. */
export function serializeSeedRecord(resource, record) {
  const type = resourceTypes[resource];
  if (!type) throw new Error(`Unknown CRM resource: ${resource}`);
  // Markdown reserves `type` for its document kind. Only the donor task subtype
  // needs an alias; every other field retains its exact donor name.
  const fields = Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      resource === "tasks" && key === "type" ? "task_type" : key,
      value,
    ]),
  );
  const metadata = { type, ...fields };
  const frontmatter = Object.entries(metadata)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => {
      const primitive =
        typeof value === "boolean"
          ? String(value)
          : typeof value === "object"
            ? JSON.stringify(value)
            : value;
      return `${key}: ${JSON.stringify(primitive)}`;
    })
    .join("\n");
  const title =
    record.name ??
    ([record.first_name, record.last_name].filter(Boolean).join(" ") ||
      record.id);
  const detail = (
    record.description ??
    record.text ??
    record.background ??
    ""
  ).replace(/\r/g, "");
  return `---\n${frontmatter}\n---\n\n# ${title}\n\n${detail ? `${detail}\n\n` : ""}Donor demo data reused from Atomic CRM (MIT), commit 8b5d47ba32190c68801a427ef7682d7a6afc14e0. Generated with faker 5.5.3, seed 1150, reference date 2026-10-11T12:00:00.000Z. Fictional demonstration only.\n`;
}

/** Builds the schema plus all 2,518 donor documents; prints only, no network. */
export function buildSeedChanges(room = "atomic-crm-port") {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(room)) {
    throw new Error("Room must be a lowercase, hyphen-separated slug.");
  }
  const changes = [
    {
      op: "create",
      path: `/rooms/${room}/settings/schema.yaml`,
      content: readFileSync(new URL("../schema.yaml", import.meta.url), "utf8"),
    },
  ];
  for (const [resource, records] of Object.entries(seedRecords)) {
    for (const record of records) {
      changes.push({
        op: "create",
        path: `/rooms/${room}/crm/${resource}/${record.id}.md`,
        content: serializeSeedRecord(resource, record),
      });
    }
  }
  return { changes };
}

function main(args) {
  let room = "atomic-crm-port";
  if (args.length) {
    if (args.length === 2 && args[0] === "--room") room = args[1];
    else if (args.length === 1 && args[0].startsWith("--room="))
      room = args[0].slice(7);
    else
      throw new Error("Usage: node scripts/donor-seed-data.mjs [--room slug]");
  }
  process.stdout.write(`${JSON.stringify(buildSeedChanges(room), null, 2)}\n`);
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
    process.exitCode = 1;
  }
}
