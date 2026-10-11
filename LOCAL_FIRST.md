# Local replica navigation slice

Master1415/1420: retain the donor SPA and renderer while deriving every page from the continuously observed House replica.

The host waits for first sync and the first typed document snapshot once. A synchronous QueryCache projection seeds donor React Query observers when they are created, before their first result; list, record, reference and infinite-list pages use the same local snapshot. Later House observations update derived queries directly. No route starts another Runtime query, a REST request, or a page-code download. The derived projection is not an independent content store; Save preparation clones it so refused changes cannot mutate the displayed replica.

All App code is in the initial JS asset. Internal navigation retains the donor client router. Explicit attachment downloads and lazy visible images remain separate. Provider service-mode write-halted pauses uploads, not local Save; Action uploads still honor provider refusal.

Tests cover synchronous first query results, no query function/runtime-query invocation during navigation, observed updates, and unchanged projection after refused Save. Full type/lint/test/build/release audits must pass at the final source commit. Hosted acceptance remains pending actual installed-release activation.

At the preceding navigation-only checkpoint, per-keystroke drafting was still open. The business-field integration below supersedes that limitation.

## Business-field draft integration

The donor's ordinary Forms now stage every changed business field directly on the actual document's shared RoomDraft. Configuration's flattened controls map to the existing `config` field; nested array/object changes reapply their changed path over the current shared value. Numeric controls keep raw incomplete text in that actual numeric field's draft and normalize complete numeric text only for explicit Save. The donor form layout/renderer remains.

The Runtime draft survives close/navigation/remount. Other tabs redraw from the shared observation, while pending newer input is protected from older replies. An open creation follows the actual saved document if another tab saves it; later typing writes ordinary field parts. Observed document updates advance newly opened field bases while the Runtime retains each already-drafted part's first base. Explicit Save validates the newest shared draft and names its exact revision; a change racing Save is preserved and refused rather than silently overwritten. Local Save works during provider upload halt; attachment Actions retain their provider gate.

All ordinary company/contact/deal/task/note/settings forms use this lifecycle. Transient import/merge selectors and tag-popup half-input remain ordinary transient UI, as explicitly accepted by Master1425. There are no UI-state schema types, buffer documents, recovery copies, content localStorage or unsaved-navigation prompts. Room image previews defer their actual attachment read until visible; only checked raster bytes create temporary revoked object URLs.

Local verification includes pure Runtime/first-base/refusal tests, mounted donor text/number/Settings forms, invalid numeric remount restoration, cross-tab edits, ordinary creation remount, and an already-open creation after another tab saves. These tests and static release closure are not hosted acceptance.

### Form ownership and repeated editing

Only an explicit donor Form Save carries its current, per-open-form token through the installed React Admin mutation middleware (or the inline note submit callback). Closing a form revokes that token. Ordinary task completion, deal archive and other provider actions cannot discover or consume an unfinished form draft by record ID; an existing shared draft still produces the ordinary preservation/refusal result. Two open forms for the same record retain independent tokens and share the same Runtime draft.

Successful inline note creation remounts the donor composer for a genuinely new creation. A different tab saving an already-open creation instead keeps that editor attached to its now-existing business document. Contact/deal note creation resumes only within the exact parent scope, including an unselected parent. Settings Reset defaults explicitly stages the real configuration field, with no UI-only buffer. Numeric values are normalized in the exact prepared parts even when they equal the original number.

Attachment reference checks at Save use only the installed Runtime's local `Rooms.attachments` metadata for the selected Room, or an already-validated upload/read acknowledgement. They compare declared size/media type without fetching bytes. Missing or inconsistent local metadata refuses with the draft retained. Lazy visible image/download reads still verify the Provider's Room scope, exact reference, Blob size and SHA-256 before use. No attachment Action is a precondition for local Save.

If writing one field to the local draft fails, later successful writes of other fields cannot make Save consume an older version of the failed input. The open form retains that input, reports the failure, and refuses submission until that field is successfully written again. This is a local persistence error, not an unsaved-navigation prompt or a substitute storage layer.
