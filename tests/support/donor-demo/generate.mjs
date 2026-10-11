// Offline reproduction of the unchanged, vendored Atomic CRM generator.
import { build } from "esbuild";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";
import { createHash } from "node:crypto";
const root = fileURLToPath(new URL(".", import.meta.url));
const require = createRequire(import.meta.url);
const referenceDate = "2026-10-11T12:00:00.000Z";
const seed = 1150;
const RealDate = Date;
globalThis.Date = class extends RealDate {
  constructor(...args) {
    super(...(args.length ? args : [referenceDate]));
  }
  static now() {
    return RealDate.parse(referenceDate);
  }
};
require("faker/locale/en_US").seed(seed);
require("faker/locale/en").seed(seed);
const result = await build({
  entryPoints: [
    join(
      root,
      "upstream/src/components/atomic-crm/providers/fakerest/dataGenerator/index.ts",
    ),
  ],
  bundle: true,
  platform: "node",
  format: "cjs",
  write: false,
  packages: "external",
  loader: { ".svg": "text" },
});
const module = { exports: {} };
new Function("require", "module", "exports", result.outputFiles[0].text)(
  require,
  module,
  module.exports,
);
const donor = module.exports.default();
globalThis.Date = RealDate;
// Schema projection removes donor server-derived/auth-only values, never records.
const allowed = {
  companies: [
    "id",
    "name",
    "logo",
    "sector",
    "size",
    "linkedin_url",
    "website",
    "phone_number",
    "address",
    "zipcode",
    "city",
    "state_abbr",
    "sales_id",
    "created_at",
    "description",
    "revenue",
    "tax_identifier",
    "country",
    "context_links",
  ],
  contacts: [
    "id",
    "first_name",
    "last_name",
    "gender",
    "title",
    "company_id",
    "email_jsonb",
    "phone_jsonb",
    "background",
    "avatar",
    "first_seen",
    "last_seen",
    "has_newsletter",
    "status",
    "tags",
    "sales_id",
    "linkedin_url",
  ],
  deals: [
    "id",
    "name",
    "company_id",
    "contact_ids",
    "category",
    "stage",
    "description",
    "amount",
    "created_at",
    "updated_at",
    "expected_closing_date",
    "sales_id",
    "index",
    "archived_at",
  ],
  tasks: [
    "id",
    "contact_id",
    "type",
    "text",
    "due_date",
    "done_date",
    "sales_id",
  ],
  contact_notes: [
    "id",
    "contact_id",
    "text",
    "date",
    "sales_id",
    "status",
    "attachments",
  ],
  deal_notes: ["id", "deal_id", "text", "date", "sales_id", "attachments"],
  sales: [
    "id",
    "first_name",
    "last_name",
    "email",
    "secondary_emails",
    "administrator",
    "disabled",
    "avatar",
  ],
  tags: ["id", "name", "color"],
  configuration: ["id", "config"],
};
const records = Object.fromEntries(
  Object.entries(donor).map(([resource, rows]) => [
    resource,
    rows.map((row) =>
      Object.fromEntries(
        Object.entries(row)
          .filter(
            ([key, value]) => allowed[resource].includes(key) && value != null,
          )
          .map(([key, value]) => {
            if (key === "id")
              return [
                key,
                resource === "configuration" ? "1" : `donor-${value}`,
              ];
            if (
              ["company_id", "contact_id", "deal_id", "sales_id"].includes(key)
            )
              return [key, `donor-${value}`];
            if (["contact_ids", "tags"].includes(key))
              return [key, value.map((id) => `donor-${id}`)];
            if (["avatar", "logo"].includes(key)) return [key, {}];
            return [
              key,
              typeof value === "string" ? value.replace(/\r/g, "") : value,
            ];
          }),
      ),
    ),
  ]),
);
const output = JSON.stringify(records, null, 2) + "\n";
writeFileSync(join(root, "records.json"), output);
const files = [];
function walk(dir) {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, item.name);
    if (item.isDirectory()) walk(p);
    else files.push(p);
  }
}
walk(join(root, "upstream"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const manifest = {
  repository: "https://github.com/marmelab/atomic-crm",
  commit: "8b5d47ba32190c68801a427ef7682d7a6afc14e0",
  license: "MIT",
  seed,
  referenceDate,
  timezone: "UTC",
  dependencies: JSON.parse(readFileSync(join(root, "package.json"), "utf8"))
    .dependencies,
  counts: Object.fromEntries(
    Object.entries(records).map(([k, v]) => [k, v.length]),
  ),
  outputSha256: sha256(output),
  lockSha256: sha256(readFileSync(join(root, "package-lock.json"))),
  sources: Object.fromEntries(
    files
      .sort()
      .map((p) => [
        relative(join(root, "upstream"), p),
        sha256(readFileSync(p)),
      ]),
  ),
};
writeFileSync(
  join(root, "provenance.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
process.stdout.write(
  JSON.stringify({ counts: manifest.counts, sha256: manifest.outputSha256 }) +
    "\n",
);
