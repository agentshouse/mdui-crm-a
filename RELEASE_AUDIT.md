# CRM release asset and license audit

The release checker is a local static audit. It does not claim browser acceptance,
runtime request interception, live publication, or end-to-end House behavior.

## Reproduce

From the CRM directory, after installing the lockfile-pinned dependencies:

```sh
node scripts/check-release.mjs --self-test
npx vitest run tests/release-transform.test.ts tests/room-assets.test.tsx tests/room-assets-safety.test.tsx
npm run build
mkdir -p reports
node scripts/check-release.mjs > reports/release-audit.json
node scripts/generate-notices.mjs --check
```

The build pre-hook copies authoritative `app.json` and `schema.yaml` into `public`
and generates notices. Vite packages those files into `dist`. The JSON report
records the exact output file count, byte count, SHA-256 of every file, local asset
references, reachable source files checked, and license closure status.

## Checks

- Root `index.html` entry and byte-identical root manifests; no symlinks, source
  maps, TypeScript source files, or escaping asset paths in the release.
- Complete release limits: at most 2,000 regular files and 20 MiB.
- All emitted JavaScript, HTML/SVG, and CSS; static/dynamic imports, Vite preload
  dependency lists, stylesheet imports, fonts, image URLs, and worker references
  must resolve to local files. Embedded SVG is decoded and checked; active markup
  event handlers and embedded documents are rejected.
- Reachable first-party source import graph. Browser network APIs, external
  resource URLs, service/telemetry dependencies, arbitrary dynamic imports, and
  data-derived JSX image/asset URLs are rejected. Local imported assets and literal
  asset values are accepted at reachable `src`, `srcSet`, and `poster` attributes.
  The sole dynamic-image exception is the exact SHA-256-reviewed
  `src/components/atomic-crm/misc/RoomAssets.tsx` module's `src={url}`. Its URL is
  constructed locally from a guarded raster Blob resolved via the selected Room;
  changing any helper bytes requires a fresh review and fails the static audit.
  A copied helper elsewhere or a source URL masquerading as a Blob is rejected.
- The only permitted browser `fetch` is the exact SHA-pinned Vite 8.3.2 module
  preload polyfill, whose referenced local links are independently resolved. A
  changed wrapper or added request fails the positive/negative self-tests.
- React Router's unused framework/SSR arbitrary `import(route.module)` helper is
  replaced by an explicit unsupported-operation error before bundling. This
  checks version 7.18.2, the original function's SHA-256, and exactly one match;
  focused tests prove all surrounding dependency source is preserved and changed
  source/version/match count fails closed. No House bridge/runtime code is patched.
- Inert strings are distinguished from requests: SVG/XML namespaces, React error
  documentation, license/schema documentation, URL scheme normalization for text
  fields, and React Router's bounded URL-parser fallback are not remote resources.
  Network APIs and image-resource sinks still reject these URLs if used to load.

The dynamic-source review also checked that external website and email fields are
inert text. Illustrations use Vite-imported donor `empty.svg`. Company logos,
contact avatars, and note files use documented `attachments/upload` and
`attachments/get` Calls only through `src/house.ts`; opaque `at_` references are
validated before UI dispatch and resolved within the selected Room. No supplied
`src`, `url`, data URI, or external service URL is rendered or fetched. Preview
Blobs require an allowed raster MIME type, matching format signature, and at most
10 MiB; SVG and HTML are never previewed. URLs are revoked on cleanup/decode error,
and stale asynchronous image responses are discarded. Missing Blob results do
not trigger any URL fallback. Downloads use only locally created Blob URLs with
sanitized filenames. Explicit file selection uploads first; the form's ordinary
save links the returned opaque descriptor. Pending uploads block save/reselection.
VCard downloads likewise use a locally generated Blob. Markdown escapes raw HTML
and removes links/images before an attribute-free DOMPurify allowlist. Static checks are conservative pattern/AST checks, not a
formal proof against all possible JavaScript data-flow behaviors. Nonbrowser
resource-guard tests exercise URL/data/Blob masquerades, invalid references,
no-Blob fallback refusal, raster/MIME/size restrictions, stale/unmounted results,
download filenames, decode-error revocation, and pending-upload form behavior.

The attachment Call/result and reference-linking contract was supplied by Master;
the installed public package documentation does not itself enumerate that binary
contract. Protocol tests use mocked Runtime Calls. No live binary upload/download,
remote asset retrieval, or hosted image rendering has been verified. Saved bare
`at_` references are tracked by the platform within text/frontmatter, including
JSON-encoded descriptors, so the port does not create duplicate Markdown links.

## Local CSV core and import safety

The local CSV feature is restored without network import services. `src/vendor/papa-local.js` contains the exact standalone `Parser`, `escapeRegExp`, and `isFunction` functions from MIT Papa Parse 5.5.3, with only the local bad-delimiter constant and an ES module export wrapper. `scripts/prepare-local-csv.mjs` pins both the installed upstream file and extracted core hashes. Prebuild and the release checker verify them. The mature parser receives only local File text; the upstream download/network/worker/stream/jQuery wrappers are absent from the bundle, not merely disabled by configuration.

The source graph scanner resolves local `.d.ts` declarations to their executing JavaScript siblings, so the actual CSV core is audited. Missing implementation siblings fail closed; positive/negative self-tests cover this resolution. No network sink exception was added for CSV. Sample download uses a generated local Blob URL and revokes it; no file preview is navigated or fetched.

The dialog requires an explicit unassigned or existing Room-team-label choice and freezes it for the run. Inputs are bounded to 5 MiB/5,000 rows. All cells initially remain strings; known numeric/boolean/date columns are parsed explicitly. Invalid syntax, duplicate headers and shape errors refuse the file before creates. Row mappings use generic `getOne/getList/create` on the existing House data provider, never a donor endpoint. One row is processed at a time, Stop drains that row, and the first failed row pauses with an error. Related company/tag creation is not atomic with the parent record and possible partial effects/drafts are visible, with no automatic retry. CSV URL photos, ownership columns and JSON dump importing are unavailable. Local fixture tests cover this boundary; no Dev Room import or browser acceptance occurred.

## Licensing

Donor: `marmelab/atomic-crm` at
`8b5d47ba32190c68801a427ef7682d7a6afc14e0`, MIT. The generator verifies and copies
the original donor license unchanged. It retains installed production-package
license identifiers and full distributed notice files, plus Tailwind's emitted
preflight/theme CSS notice, Inter's SIL Open Font License, and upstream notices
for vendored shadcn/ui and Shadcn Admin Kit components. Missing package-root texts
are supplemented from hash-pinned upstream license snapshots, with their
provenance disclosed in the notice file.

`react-remove-scroll-bar` 2.3.8 declares MIT but does not distribute its license
text. The supplied original upstream notice is pinned to the repository snapshot
retrieved on 2026-10-11; the npm publication gitHead was unavailable from GitHub.

The current `@agentshouse/app-bridge@0.1.0-ce524f6608238` declares MIT and
distributes its original LICENSE. That exact text is included in generated notices.
The old unlicensed-package exception has been removed: any missing grant now
fails the generator. This closes the old installed-package gap, without declaring
the combined bundle wholly MIT-licensed or changing the platform issue status.
