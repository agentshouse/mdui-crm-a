# CRM · House port

Master1150 demo-data correction: the full pinned upstream demo generator is now reproduced offline and adapted to the current Room schema. See [DEMO_DATA.md](DEMO_DATA.md) for counts, exact source/dependency hashes, field mapping, and readback evidence. The Room now contains exactly 2,518 donor documents and zero legacy fixtures after owner-confirmed removal of 87 unchanged generated documents. Earlier synthetic-seed and additive-population counts below are historical. No demo records are bundled as live App fallback data.

Current bridge migration: Master’s 2026-10-11 live go has been applied locally. The port pins the published MIT bridge `0.1.0-ce524f6608238` and uses the exact host-provided client from `connectHouseBridge().runtime`. Runtime imports/construction are removed. Earlier dated check counts and old bridge-gap findings below are historical; see the current migration result at the end. That earlier publication wait is historical; publication and Room binding have since been independently verified, with current release references recorded in the Porting status.

Locally prepared ordinary House App based on [Atomic CRM](https://github.com/marmelab/atomic-crm/tree/8b5d47ba32190c68801a427ef7682d7a6afc14e0), pinned to main commit `8b5d47ba32190c68801a427ef7682d7a6afc14e0` (2026-10-05). MIT donor and vendored UI/dependency notices are retained.

## Retained interface

The donor React/shadcn CRM interface remains: desktop dashboard, mobile dashboard/navigation, companies, contacts, search/filter/sort, contact editing/merging/tags, deals with Kanban and archive, tasks with due-date groups, formatted notes, activity history and CRM configuration. Inter is bundled locally. Team labels are ordinary manually assigned CRM records, with no claim of authentication or authorship.

The donor server, Supabase, authentication/account management, email sending, external import services, telemetry, donor product logos, remote images are removed. Room-backed note attachments, company logos and contact photos use the documented attachment Calls. Note Markdown permits text formatting only: raw HTML is escaped before parsing, links are inert, and no images/embedded resources are loaded. CSV/vCard exports are local; CSV omits Runtime metadata and neutralizes formula-leading text cells.

## Local CSV import

The donor local CSV dialog is restored for contacts, companies and deals where their resources are registered, including donor list/empty states and desktop/mobile layouts. This is local file parsing plus ordinary House CRUD, separate from removed external import services. Users must explicitly choose an existing Room team label or leave records unassigned; no current identity is inferred. Column mapping follows the donor, preserving leading zeroes and supported decimal amounts. Missing companies/tags are resolved by exact current Room names and created through the same provider.

The bundled parser contains only hash-pinned Papa Parse 5.5.3 standalone core functions. Network, worker, jQuery and stream wrappers are not bundled. All parsing occurs on local File text, with a 5 MiB/5,000-row limit. Duplicate headers and malformed rows fail before writes. Processing is sequential; Stop drains the active row and prevents the next. A refusal pauses the run and displays its reason without retry. Progress counts queued records, not synchronization.

An import is not a multi-record transaction. A failed contact/deal row may leave related companies, tags or prepared drafts; the UI says to inspect them before retrying. CSV photo/attachment URLs, ownership columns and the donor JSON dump import remain unsupported and are explicitly explained. Samples are synthetic. See `LOCAL_CSV_IMPORT.md` for pinned source evidence and checks. This correction was local-only: no actual Dev import or Room/schema/status/issue change occurred.

## Room storage

Private Room: `crm-port` (`r_18.t`). Its accepted synthetic dataset was independently read back: 8 companies, 24 contacts, 16 deals, 16 tasks, 12 contact notes, 6 deal notes, 3 team labels, 2 tags and 1 configuration record (88 records). The Room schema was updated at revision `fr_q4.2.c` for attachment-only notes and independently compared with the local schema. Every company, contact and activity is fictional. Seed generation is offline (`node scripts/seed-data.mjs --room crm-port`); the generator does not send data or run in the production App.

One document per entity; typed schemas and writable `crm` slot are in root `schema.yaml` and `app.json`. Scalars remain useful schema fields. Nested values are JSON strings. Boolean values use supported string enums; optional null text values are represented as empty strings and normalized at the provider. Task `type` is stored as `task_type` because document frontmatter `type` is reserved.

`src/house.ts` is the single react-admin-compatible data provider and bridge/Runtime boundary. It reads Room queries, derives summary/activity views, filters/sorts/paginates, and writes Room drafts with exact field/Markdown bases. It refuses conflicting existing drafts, invalid references and stale deletion. Deal ordering, notes/contact status, task/contact activity, contact merging and bulk tagging use grouped saves. Returned drafts are preserved. Saves are labelled queued; the Runtime observation determines sync state. TanStack Query and React Admin UI caches are in memory, not a content persistence substitute. Stale full-form saves project only the actual changed fields onto current Room records before whole-record/reference validation and response decoration. Semantically unchanged JSON/default fields do not become writes; real edits retain exact opened bases. The same rule protects compound note validity and custom deal/configuration results; stale Kanban order is refused.

Current application pin: `@agentshouse/app-bridge@0.1.0-ce524f6608238`. The isolated boundary awaits `bridge.runtime`, without a direct Runtime import or dependency. Documented `attachments/upload` and `attachments/get` Calls are isolated there too, using exact result objects clarified by Master. Uploads store SHA-256/version/byte metadata and an opaque Room reference. The UI renders only raster-validated temporary object URLs from returned Room Blobs; it revokes them and never uses a stored arbitrary URL. Unavailable bytes display the file name. Saved `at_…` references inside JSON-string fields count for House attachment tracking, as confirmed in Master's `20261011T0115Z-master-attachment-link.md`; no duplicate Markdown link is added. No credentials or direct provider calls are embedded.

## Build and checks

- `npm run typecheck`: all retained application and test TypeScript
- `npm run lint`: blocking donor ESLint rules
- `npm test`: focused provider, schema, DOM behavior, donor utility, Markdown/export and transform tests; no browser
- `npm run build`: donor `tsc && vite build`, with manifest/license preparation
- `npm run release:check`: size/count, manifest, asset closure, source/bundle network-sink audit and notice freshness

Final local checks: typecheck and lint pass; 240 tests pass across 21 files; donor build and release audit pass. The artifact has 23 files, 2,299,981 bytes (2.193 MiB), seven local fonts and 186 dependency notices. See `reports/verification.json` and `reports/release-audit.json`.

The release root contains `app.json`, `schema.yaml`, `index.html`, scripts, styles, seven local Inter fonts and license notices. The build removes one unused React Router framework dynamic module loader through `scripts/strip-framework-loader.ts`: exact package version, function SHA-256 and match count are checked, and its code is replaced with an explicit unsupported error. Local declared CRM routes are unchanged. This is frontend bundle pruning, not a House protocol change.

The retained donor pure tests and adapted nonbrowser tests are not the complete donor regression suite. Static/happy-dom checks do not establish viewport rendering, navigation, runtime network isolation or hosted CRUD behavior. The Vite >500 kB chunk advisory is non-failing.

## Remaining gates

No App allocation, remote push, release branch, publication, Room binding, screenshot or browser acceptance has occurred for this CRM. Master’s live go is recorded; Tasks must publish first and the platform schema replacement fix is pending. CRM remains blocked, not review-ready.

- `issues/crm-runtime-assets.md`: the published package docs omit the attachment Call contract. Master supplied the exact Calls/result objects; Room-backed attachment/photo UI is implemented locally. Master also confirmed reference tracking. Live App upload/get verification remains pending. Operator CLI upload is a separate facility and has not been substituted for live App verification.
- The old bridge license gap is closed locally by installing the published MIT bridge and retaining its original LICENSE. This does not alter the platform issue status.
- Hosted desktop/360 px verification and live reload/sync/conflict checks are pending the permitted published route.

License reports are generated from the pinned installed production closure, with additional upstream notices for vendored UI and fonts. `public/licenses/` contains provenance for recovered license texts.

## Local dependency hardening (2026-10-11)

DOMPurify is pinned to 3.4.16 for [GHSA-55q2-fjhq-7xh7](https://github.com/cure53/DOMPurify/security/advisories/GHSA-55q2-fjhq-7xh7) and [GHSA-6688-9rhm-gjv2](https://github.com/cure53/DOMPurify/security/advisories/GHSA-6688-9rhm-gjv2). The existing string-input Markdown sanitizer, escaped raw HTML, restrictive formatting tags, empty attribute list and inert links/media are unchanged; IN_PLACE and removal hooks are not enabled. This is dependency-version hardening, not evidence of an exploitable CRM path. Two added regressions verify the exact dependency closure and adversarial rawtext/subtree-shaped Markdown. Typecheck, lint, all 240 tests, build, static source/network/release audit, scanner self-tests and notice freshness pass. Local CSV and concurrency behavior remain covered and unchanged. All original notices remain, including the unresolved UNLICENSED bridge gate. No npm audit, dependency-graph upload, remote write, browser or publication occurred.

## JSON Schema migration (2026-10-11)

All nine App types now use the Master-announced draft-2020-12 properties/required form. IDs, dates, JSON strings and scalar exact-match metadata use unconstrained patterns to preserve accepted values; human text remains prose. No stored field, required name or enum value was removed. @agentshouse/mdmodel 0.1.0-c68e2039f1ca8 is pinned for development schema/fixture validation; production runtime pins and behavior are unchanged.

Typecheck, lint, all 241 tests (including all 88 fictional seed records), build and release audit pass. Original schema/seed results remain historical evidence. The Room schema has not yet been replaced: the platform conversion refusal reported in Porting issues/tasks-schema-replacement.md blocks that path. reports/schema-migration preserves the observed schema/base and a prepared exact-base replacement; re-read it before applying after the Master fix. No App allocation/publication or browser acceptance occurred.

## Current bridge Runtime migration (2026-10-11)

Applied Master’s `20261011T0440Z-master-live-go.md` locally. The only application House dependency is exact `@agentshouse/app-bridge@0.1.0-ce524f6608238`. `src/house.ts` derives its client type from `connectHouseBridge()` and returns `bridge.runtime` unchanged. The existing retry-on-rejection and cached connection remain. No Runtime protocol or client is imported, constructed or copied into application source. The bridge still lists Runtime/model packages transitively for its declarations, so the conservative installed-production-closure notices include their original licenses.

The official package test host now checks missing-host failure, rejected-client failure, retry, deferred delivery, exact client identity, connection reuse and the tab title. All existing concurrency, exact bases, refused/queued save, editor and attachment tests are retained. Current results: typecheck, lint, 243 tests, build, static release/network checks and license checks pass. Release: 23 files / 2,297,889 bytes, 7 local font files. Full check results and immutable release hashes are under `reports/runtime-migration/`.

The newly installed bridge actually declares MIT and includes its own original LICENSE; that text is now distributed verbatim. The old installed bridge gap is closed locally, and license completeness reports no unresolved gap. Original donor, font and supplemental notices remain. Historical gap statements above describe earlier package versions and checks. This does not change a platform issue’s status or establish blanket legal clearance.

No remote schema or document write, App allocation, binding, release branch, push, browser or hosted acceptance was performed. Publication remains in Tasks-first order, with the schema replacement defect pending the platform fix. Existing identity and fidelity limitations are unchanged.
