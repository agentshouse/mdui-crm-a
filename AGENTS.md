# CRM port development

This checkout is the ordinary House CRM port of Atomic CRM. Read README.md and the source LICENSE.md before modifying it. DONOR_GUIDE.md preserves the upstream development notes; its Supabase, external-service/JSON import, authentication, Storybook and browser commands do not apply to this scoped port.

## Commands
- npm install --ignore-scripts (honor .npmrc; do not override dependency-age safeguards)
- npm run typecheck
- npm run lint
- npm test (Node/happy-dom only)
- npm run build (donor tsc && vite build)
- npm run release:check

All application Runtime calls belong in src/house.ts. Preserve exact Room draft bases, grouped save semantics and refusal handling. A save receipt means queued, not synchronized. Never create a production fallback store or call donor services. Room assets/identity methods may only be adopted from a documented platform contract.

Local CSV imports use the pinned Papa core and ordinary data-provider CRUD. Keep explicit assignment, sequential stop/refusal reporting and no network/worker CSV entry point. Check LOCAL_CSV_IMPORT.md before changing this boundary.

The artifact contains only local scripts, CSS, fonts and illustrations. Preserve MIT/OFL/dependency notices, and the bridge’s own published MIT grant. Review any changed React Router version/source hash before updating the narrow unused-framework-loader transform.

This checkout has no App allocation or remote. Publication and a release branch require the explicit platform go in the Porting Room; Tasks is first. Do not start browsers from this checkout while the current stop instruction remains in force. Passing unit/static checks is not hosted acceptance.
