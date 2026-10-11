# Master 12:25: restore ordinary CRM chrome

Instruction: Porting `messages/20261011T1225Z-master-crm-room-label.md` (2026-10-11).

Donor audited: Atomic CRM pinned `8b5d47ba32190c68801a427ef7682d7a6afc14e0`, donor `src/App.tsx`, `src/components/atomic-crm/root/CRM.tsx` and component tree. The House Room picker and always-visible sync row were added by the port. Donor content-level offline/error handling (including InfinitePagination and contact views) is distinct and remains intact.

Removed the added Room-name selector, ambient sync/queued row and port-only team-label hint. The single-slot App uses only the sole Room returned by the official host runtime, with a configuration error instead of choosing first when multiple bindings are exposed. No Room ID/handle is hardcoded and no runtime filtering workaround is added. Refusals, errors, returned drafts, storage loss and write-halt warnings remain visible. No provider, schema, manifest, Room contents or authentication changes.

Independent command readback: `get_app_bindings` for `a_s.g` returns `crm` → `r_18.t`, admitted and compatible, release `01a12ada-f944-7000-9186-79a680226be8`. Source receives `observe('rooms')` unchanged from `connectHouseBridge().runtime`; no slot name or binding identity exists on the documented AppRoom shape. The reported admin viewer's `/private` observation is not reproduced by this local test. It is separately tracked in Porting `issues/crm-runtime-room-resolution.md` and must not be claimed fixed by hiding the label.

Verification: typecheck, lint, all 247 tests (25 files), production build and release:check pass. New DOM coverage proves exact sole binding use, absence of ambient Room/sync chrome, multiple-binding refusal and recovery, and preserved refusal/returned-draft/storage/read-only notices. No hosted browser claim. Source tests do not prove the admin viewer's runtime reach.
