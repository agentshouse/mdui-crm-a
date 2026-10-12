# CRM

Manage companies, contacts, deals, tasks, and notes as Room documents. Local CSV import uses explicit field assignment.

Use Node.js 24.21 or newer. Install with `npm ci --ignore-scripts --no-audit`, then run `npm run dev` for development or `npm run build` for a production build. `npm run verify` checks types, lint, tests, starter documents, licenses, source safety, and the release artifact.

`starter/` contains a small existing example with its related companies, contacts, deals, tasks, salespeople, and tags at their original Room-relative paths. Starter documents are optional; the App never seeds a Room automatically.

To publish, configure `origin` as the credential-free HTTPS Git URL of your House App, commit your changes on `main`, and run `npm run publish`. It verifies a clean source tree and atomically publishes source and a parentless release. Verify the published source revision in House afterward.

License texts and notices are retained in `LICENSE.md` and `public/licenses/`.

## Portable publisher safety

The publisher accepts credential-free HTTPS House App remotes on any host, including
`https://<host>/app/new.git` for creation. Choose only a host and App you are authorized
to publish to. Host portability does not authorize publication to another environment.
For initial creation, use `npm run publish -- --name "<display name>"`; `--name` is
optional and no default display name is invented. The helper reports only complete,
explicitly returned App/Git receipt URLs and never changes `origin`. After creation,
inspect the returned canonical App in House and set its actual Git URL as `origin`
before another publication. Never retry an uncertain creation blindly.

`npm run test:publisher` runs offline local-Git regression fixtures with mocked
push/remote transport; it installs no packages and does not contact House. These
checks are included in `npm run verify` before the existing App-specific gates.
Publication requires clean committed `main`, runs exactly that full verify gate,
pins the source SHA, and atomically pushes source `main` plus a parentless dist-only
`release`. It preserves the normal index and source branch, rejects unsafe origin
rewrites, index flags, metadata mismatches, and conflicting publisher/worktree locks.
It never commits source, resets work, or substitutes a build-only verification.

Failure diagnostics suppress arbitrary subprocess output to avoid leaking credentials.
Run `npm run verify` locally for full compiler/test output; never share credential
values or verbose HTTP traces. A reported creation receipt or advertised source SHA
does not prove release admission: inspect the known App's published revision in House.
After a failed or uncertain push, inspect that state before deciding whether to retry.
