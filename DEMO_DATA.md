# Reused Atomic CRM demo data

This replaces the earlier hand-authored demo as the source for new Room population under the user-adopted Master1150 rule. The old `scripts/seed-data.mjs` remains only as historical fixture/reproducibility evidence and for pre-existing provider regression tests; do not use it to populate new demos. The complete donor dataset has 2,518 schema-compatible records. Prior Room records were initially retained for preservation. Following the owner’s specific confirmation, the 87 unchanged generated originals were removed with fresh revision guards; the current Room contains only the 2,518 donor documents.

## Reproduction

From this checkout, run `npm ci --prefix scripts/donor-demo --ignore-scripts --no-audit --no-fund`, then `TZ=UTC node scripts/donor-demo/generate.mjs`. The isolated dependency lock pins the exact generator dependencies, including the upstream contact-gender module’s React/icon imports (which do not generate data); the application dependency closure is unchanged. Node 24.19.0 was used. The source snapshot under `scripts/donor-demo/upstream/` is byte-for-byte upstream source at the commit in `provenance.json`; every source file, output and dependency lock has a SHA-256 hash. The donor license and generator dependency notice are retained in `public/licenses/donor-demo-NOTICE.txt` and the source tree.

The reference clock is fixed at 2026-10-11T12:00:00.000Z, UTC; RNG seed is 1150. Date freezing and seed initialization are the only generator controls. No donor record-count parameters are reduced. Run `node scripts/donor-seed-data.mjs --room crm-port` to print a proposed changeset; it performs no network calls and must not be blindly applied to an existing Room because the schema and any existing IDs need fresh exact bases.

## Adaptation boundary

Identifiers and all relationship identifiers receive `donor-` prefixes, preserving exact cross-resource links. Primitive booleans and complex values use the existing App schema serialization. Null optional fields are omitted. Carriage returns in the donor's paragraph separator are removed, retaining newlines, because House's accepted YAML subset refuses the `\r` escape. Generated source text is otherwise retained. No fixture is imported into application source or embedded as a live-data fallback. The production UI reads actual Room documents.

All 55 companies, 500 contacts, 50 deals, 400 tasks, 1,200 contact notes, 300 deal notes, 6 sales labels, 6 tags and 1 configuration record are retained. Donor auth-only password/user_id and derived summary/acquisition fields are outside the App schema and omitted; sale labels make no authentication claim. Company logos and contact/sales portraits are omitted for honest initials. The configuration ID remains 1 to match the donor singleton; it is replaced only after verifying the Room content still exactly equals the old generated sample and using its fresh revision.

## Validation and Room evidence

`tests/donor-demo.test.ts` checks pinned source/output hashes, every entity count, safe IDs, every relationship, absent remote media and all records against the current House JSON Schema. Existing provider regression tests remain. Population uses bounded 50-record batches below 90 KB, with readback split below the House shell 32 KB cap and exact content comparison. `reports/donor-demo/room-population-initial.json` preserves the original full-body population readback and preservation evidence. `reports/donor-demo/room-verification.json` records the current donor-only totals, guarded-removal manifest and post-removal path/relationship readback.

## Initial Room population (historical)

The initial population readback on 2026-10-11 verified 2,518 adapted donor records and preserved all 87 prior non-configuration records byte-for-byte, for 2,605 documents in `crm-port` (`r_18.t`). The prior configuration at ID 1 exactly matched the old offline synthetic sample and was replaced using its observed revision; it now contains the donor singleton configuration. The current schema remains `fr_q4.3.e`. Every donor document exactly matched its prepared source after the write, and all company/contact/deal/note/task/tag/team relationships are covered by the fixture tests. No documents were removed in that initial population step. The then-retained legacy rows were not represented as donor-derived; they have since been removed as described below.

## Current donor-only Room

After the owner explicitly confirmed removal even without a documented history-recovery path, all 87 unchanged generated original documents were removed in one revision-guarded `edit/remove` batch. Each target’s exact body was compared with the preservation manifest before and after inspecting its current revision. Changed or unrelated material was not targeted, and no history-purge command was used.

The post-removal check independently read every expected donor path and all type/ID/reference/array-reference fields, matching the source-validated relationship graph. The complete entity-file count equals those 2,518 expected donor paths, proving zero additional legacy documents remain. This is a relationship/path readback, not a second full-body comparison; the earlier full-body donor readback remains preserved separately. Source fixtures, schema, runtime and license notices are unchanged by this cleanup.
