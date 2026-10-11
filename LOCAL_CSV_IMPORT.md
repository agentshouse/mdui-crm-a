# Portable local CSV restoration

## Source evidence

Pinned donor: `marmelab/atomic-crm` commit `8b5d47ba32190c68801a427ef7682d7a6afc14e0`.

- [`misc/usePapaParse.tsx:56–91`](https://github.com/marmelab/atomic-crm/blob/8b5d47ba32190c68801a427ef7682d7a6afc14e0/src/components/atomic-crm/misc/usePapaParse.tsx#L56-L91) receives a local `File`, calls Papa Parse and passes parsed batches to the selected handler.
- [`dataImport/useCompanyImport.ts:19–42`](https://github.com/marmelab/atomic-crm/blob/8b5d47ba32190c68801a427ef7682d7a6afc14e0/src/components/atomic-crm/dataImport/useCompanyImport.ts#L19-L42) creates companies through the generic data provider. Its identity-dependent owner assignment at lines 16/39 is the nonportable part; it is replaced with an explicit Room-team-label/unassigned choice.
- Donor `contacts/useContactImport.tsx`, `dataImport/useDealImport.ts`, and `dataImport/useCompanyResolver.ts` likewise resolve/create records through generic CRUD. No donor endpoint is needed for their local CSV portion.

## Restored behavior

The donor dialog, buttons, sample templates, list/empty-state placement and layout provider pattern are retained. The CSV-only header action does not restore the donor's separate JSON dump importer. A native local-file/dropzone control preserves the dialog layout without an external file-preview path. Assignment is mandatory and explicit, remains fixed during a run, and an existing selected label is revalidated through House. It never uses `useGetIdentity` or guesses membership.

Mappings handle contacts, companies and deals. Exact existing company/tag names are reused; ambiguous names fail rather than picking one. Required/type/date/configuration values are checked before related creates. Leading zeroes survive, supported currency decimals are preserved, and deal insertion order is chosen by the existing serialized House provider. External photo/attachment URLs and CSV ownership values are refused with an explanation. Unknown ordinary columns are ignored, as in the donor.

Only the exact standalone Papa Parse 5.5.3 core is bundled, with MIT notice and SHA-pinned upstream/core sources. The wrapper reads File text and never exposes Papa's network/worker APIs. Files are limited to 5 MiB and 5,000 rows. Syntax, duplicate headers and inconsistent widths fail before any row is queued.

Rows run sequentially. Stop prevents further rows after the in-flight row settles. The first row needing attention pauses the run, preserves the exact error and does not retry. Queued counts are not a synchronization guarantee. Related company/tag creates and the parent record are separate operations; a parent refusal may leave related records or drafts, and the UI warns to inspect them before retrying. No fake transaction/rollback or fallback storage is provided.

## Verified locally

- Full typecheck and lint pass.
- 238 tests pass across 20 files, including donor cell conversion tests, local parser/mapping/lifecycle/UI tests and synthetic integration through the actual House provider with mocked Runtime transport.
- Existing stale-form/concurrency checks remain; `src/house.ts` is unchanged in this correction.
- Donor build, strict source/bundle asset audit, scanner self-tests, parser hash checks and notice freshness pass.
- Dist: 23 files, 2,298,491 bytes; seven local fonts; 186 package notices.

No actual Dev import, remote Room/schema/status/issue mutation, App allocation, push, release branch, publication or browser test occurred. Hosted import behavior and viewport acceptance remain unverified. No essential unsupported House API blocks this local CSV feature. External import services, photo URLs and JSON dump imports remain outside its boundary. The pre-existing House bridge `UNLICENSED` metadata issue remains disclosed.
