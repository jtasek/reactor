# reactor - simple design prototyping tool

Simple and easy to use prototyping tool

## Refactoring Verification

Use the pnpm version pinned in `package.json`. Install dependencies with
`pnpm install --frozen-lockfile`, then install the browser once with
`pnpm exec playwright install chromium` (Linux CI may need `--with-deps`).

- `pnpm check`: lint baseline/touched-file gate, application and test types,
  unit/store tests, then a fresh production build and Chromium smoke test.
- `pnpm lint`: full read-only ESLint report; intentionally fails while recorded
  legacy debt remains. `pnpm lint:fix` explicitly applies automatic fixes.
- `pnpm lint:baseline`: fails on any new diagnostic or any diagnostic in a
  changed/untracked file. Existing diagnostics remain visible through `pnpm lint`.
- `pnpm typecheck`: checks application code and test fixtures separately.
- `pnpm test`: unit and store tests. `pnpm test:browser`: browser tests against
  the production server, including SVG wheel input.

The lint gate compares local staged/unstaged files against `HEAD` by default.
For a committed branch or CI review, set `LINT_BASE_REF` to the comparison commit
or merge base, for example `LINT_BASE_REF=origin/main pnpm check`. That ref must
exist locally. Do not add entries to `lint-baseline.json`; reduce the baseline as
files are repaired. Whole-repository zero-warning lint remains the Phase 7 gate.

`tests/support/store.ts` creates independent Overmind stores with real document
factories and JSON-backed memory storage. Startup is opt-in via
`store.onInitialize()`; storage/routing effects are mocked and autosave is off.
Keep tests requiring autosave timers responsible for their own timer/reaction
cleanup. Browser tests use isolated browser contexts and port 4173; an occupied
port fails rather than silently testing a different server. Traces are retained
in ignored `test-results/` on failure.

See [REFACTOR_PLAN.md](./REFACTOR_PLAN.md) for phase acceptance criteria. The
browser smoke test establishes the harness; full gesture coverage belongs to
Phase 4.

## Document Storage

Documents use version 2 of the `reactor` localStorage payload. Only durable content
is saved; dates use ISO strings and derived indexes and selections are rebuilt on
load. Cloned documents have independent content but preserve internal IDs, which
are scoped to each document.

Version-1 snapshots are validated and migrated after backing up their original
bytes under `reactor:backup:*`. Repeated loads reuse identical backups. Unsupported
or malformed data remains untouched, shows a notification, and disables autosave
for that session. A backup failure also prevents migration and autosave.

Autosave is **on by default** (`config.autoSave`). It observes all documents,
debounces writes for 500 ms, flushes on pagehide or disposal, and reports storage
failures. Transient selection changes do not produce
writes. Recovery notices do not imply that new session edits have been saved.

## Camera Coordinates

Camera math and zoom bounds live in `src/app/camera.ts`. Camera position and pan
deltas use surface-local SVG units; positive deltas move content right/down.
The input adapter converts browser client coordinates through the surface CTM
before applying the camera transform. Input is ignored when that transform is
unavailable or singular.

All zoom controls share the 10%-1000% range. Ctrl-wheel pinch is continuous and
anchored at the pointer; toolbar/tool steps are discrete. Slider zoom preserves
the current pan position. Full touchscreen gesture handling remains Phase 4 work.

* create prototypes
* create diagrams
* create mockups

## Installation

1. Clone the repo:

```javascript
$ git clone https://github.com/jtasek/reactor.git
```

2. Install npm packages

```javascript
$ npm install
```

OR

```javascript
$ yarn
```

3. Run the application

```javascript
$ npm start
```

OR

```javascript
$ yarn start
```
