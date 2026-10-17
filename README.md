# reactor

A browser-based editor for prototypes, diagrams and mockups: draw shapes, links,
layers, groups and guides on a canvas, and keep documents in the browser or, signed
in, on a server that syncs them between devices and people.

## Requirements

- Node.js 22.18 or later, which runs the server's TypeScript directly
- pnpm 11, the version pinned in `package.json` (`corepack enable` provides it)
- Optional: PostgreSQL 17 for accounts and syncing, or Docker to run both with
  `compose.yaml`

## Getting started

```bash
git clone https://github.com/jtasek/reactor.git
cd reactor
pnpm install
pnpm start
```

Then open http://localhost:4000. Without a database, the editor runs signed out and
keeps documents in the browser.

## Commands

| Command | What it does |
|---|---|
| `pnpm start` | Development server with hot reload on port 4000 |
| `pnpm build` | Production build into `dist/` |
| `pnpm serve` | Production server for `dist/` (run `pnpm build` first) |
| `pnpm check` | Lint gate, type checks, unit tests and browser tests |
| `pnpm test` | Unit and store tests; `pnpm test:watch` reruns them on change |
| `pnpm test:browser` | Browser tests (Chromium) against a production build |
| `pnpm typecheck` | Type checks for the app, the tests and the server |
| `pnpm lint` | Full lint report; `pnpm lint:fix` applies automatic fixes |

`docker compose up --build` runs the production server in a container with
PostgreSQL; see Accounts below.

## Server settings

| Variable | Meaning |
|---|---|
| `PORT` | Port to listen on; 4000 by default |
| `HOST` | Address to listen on; `localhost` for the development server, `0.0.0.0` for the production server |
| `LOG_LEVEL` | Production server log level; `info` by default |
| `TRUST_PROXY` | Reverse proxies whose `X-Forwarded-*` headers the production server trusts: a hop count such as `1`, `true`, or addresses and subnets such as `loopback, 10.0.0.0/8`; none by default. Set it behind a proxy, since sign-in is rate limited per client address |

The production server stops at start with a clear message when `PORT` or
`TRUST_PROXY` is invalid; `LOG_LEVEL` must be one of `fatal`, `error`, `warn`,
`info`, `debug`, `trace` or `silent`. Account settings are listed under Accounts.

## Using the editor

Tools draw on the canvas; the control panel (top right) shows or hides the tool
bar, side bar, panels and other parts of the editor.

| Key | Action |
|---|---|
| `s` | Select tool: click a shape, or drag to select shapes a box touches |
| `r`, `c`, `e`, `l`, `p`, `t`, `i` | Rectangle, circle, ellipse, line, pen, text and image tools |
| Delete or Backspace | Delete the selection |
| Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z | Undo and redo your own changes, a drag or a paste as one step; other people's stay as they are |
| Ctrl/Cmd+D | Clone the selection; the clones become the selection |
| Ctrl/Cmd+C, Ctrl/Cmd+X, Ctrl/Cmd+V | Copy, cut and paste the selection, also between documents and tabs. A paste is centered where you last pressed on the canvas, or in the middle of the view when that place is out of sight |
| Ctrl/Cmd+G, Ctrl/Cmd+Shift+G | Group and ungroup the selection. A group is selected, moved, turned and scaled as one; click a shape in a selected group, or double-click it, to select that shape alone |
| Ctrl/Cmd+Alt+G | Remove the shapes selected inside a group from it |
| Ctrl/Cmd+Alt+L, Ctrl/Cmd+Alt+Shift+L | Move the selection to a new layer, take it off its layer |
| `h` | Highlight the selected shapes' layer: show only it, or every layer again |
| `]`, `[` | Bring the selection to the front, send it to the back |
| Ctrl while dragging, Cmd on a Mac | Move without snapping to other shapes' edges and centers |
| Shift+A, Shift+C, Shift+D | Align the selection's left edges, centers or right edges |
| Shift+W, Shift+M, Shift+S | Align the selection's top edges, middles or bottom edges |
| Shift+X, Shift+Y | Space the selection with equal gaps, horizontally or vertically; Space equally (equal distances between centers) is in the Inspector, with all the others |
| Shift+H, Alt+Shift+H | Hide the selection; show every hidden shape, group and layer |
| `k`, Shift+K | Lock and unlock the selection |
| `+` or `=`, `-`, `0` | Zoom in, zoom out, reset zoom |

The Explorer (in the side bar) lists the layers with their groups and shapes as a
tree. Drag a shape or a group onto a layer or a group to move it there. Press a layer's
name to see only that layer, with the shapes on no layer, on your screen; press it again,
or Show all layers, to see everything. A group is on one layer, with all its shapes. Type in the explorer's search box to list only
the layers, groups and shapes whose names contain the text. Press the arrow beside a layer or
group to collapse or expand it.

The image tool asks for a PNG, JPEG, GIF or WebP file of 5 MB or less, then draws it
at its own proportions where you drag.

Create component, in the selection's menu and the context menu, turns the selected
shapes into a component and puts an instance of it in their place. Editing the
component's source changes every instance; an instance can override the props its
source exposes, reset them, or be detached into plain shapes. The Library control
copies another document's component here and lists the copies, to place or inspect;
a copy shows when its source has changed and is updated on request.

Shortcuts do nothing while a text field has focus. The command line runs a command
by name.

Input:

- Mouse and pen draw, select, move, resize and rotate shapes; a drag commits on
  release, and is undone if it is interrupted, as by the context menu or leaving
  the window.
- The scroll wheel pans the canvas; a trackpad pinch (or Ctrl and the wheel) zooms
  at the pointer.
- On a touchscreen, one finger acts as the mouse and two fingers pinch to zoom.
  Touch input is tested with simulated touches; it has not yet been checked on a
  physical touch device.
- The editor's buttons, lists and panels can be used from the keyboard; drawing
  on the canvas needs a pointer.

## Saving

Documents are saved in the `reactor` IndexedDB database: an index of documents, and
each document's changes as Yjs updates of their own, merged into one once 100 add
up. Only durable content is saved; derived indexes and selections are rebuilt on
load. Open tabs share their changes and the documents they create and delete
through a BroadcastChannel; a tab shown again after missing messages catches up
from the others and from the database. The document shown and each document's
camera are saved per device under `reactor:view`. Cloned documents have independent
content but preserve internal IDs, which are scoped to each document.

The first start with this storage moves the version 4 `reactor` localStorage
payload into the database, backed up first under `reactor:backup:*`; the payload
itself is left as it was. Snapshots from versions 1-3 are validated and migrated
first. Loading repairs content: missing, invalid or tied draw orders get new ones,
references to missing shapes or components are dropped as deleting them would, and
a member listed twice is kept once. Repeated loads reuse identical backups.
Unsupported or malformed data remains untouched, shows a notification, and nothing
is saved that session. A document that fails to load is kept as it was saved, with
a notice, and the others load; if the database cannot be listed at all, nothing is
written over it that session, and the status bar says so. When a tab on an older version saves to local storage
after the move, the next start says so once; that save is kept but not shown.

Saving is **on by default** (`config.autoSave`); with it off, documents still load
but none are written. Runtime-only changes, such as selection, hover and measured
bounds, are never saved. The status bar shows whether changes are saved, being
saved, syncing, offline or not saved; when saving stops, a notice says why, and it goes away once
saving works again. After a write fails, a document is saved whole on its next
change.

## Accounts

Accounts are optional: without `DATABASE_URL`, the editor is used signed out and
keeps documents only in the browser. With it, the server signs people in through
Better Auth at `/api/auth`, keeping accounts and sessions in the `auth` schema of
that PostgreSQL database and creating or updating its tables on start. People
confirm their email address before signing in with a password, or sign in with a
link sent by email.

The account page, `/account`, reached from the status bar, signs in and out and
creates accounts. Signed out, the editor says once, and again at 3 documents,
that documents are kept only in this browser. Signed in, documents sync with the
server, and the browser keeps a copy of them in a database of the account's own
(`reactor-<user id>`), apart from the ones kept signed out. Signing out waits for
changes still on their way to the server, says what would be lost if some cannot
be sent, then removes that copy from the browser.

Signed in, the API at `/api` lists the user's workspaces, starting with a personal
one created on first use, and lists, creates and deletes a workspace's documents.
Reading needs the viewer role, creating editor, and deleting admin; a workspace or
document the user may not read answers as missing. A client may choose a new
document's id (a UUID), so documents made offline keep theirs; creating one again
in the same workspace returns it, and an id taken elsewhere is refused. Requests that change anything
must come from the editor's own address and send JSON. The app's tables sit next
to Better Auth's schema and are created or updated on start.

Documents sync over a WebSocket at `/sync`, which needs the session cookie and the
editor's own address. Opening a document needs the viewer role; a viewer's
connection is read-only, so the server drops the changes it sends. Each document's
content is kept in PostgreSQL as one compacted Yjs update, saved a few seconds after
changes and when the server stops. Deleting a document disconnects everyone from
it, and a socket closes within a minute of its session ending. Signed in, the
editor syncs every document over one socket: a new device shows the account's
documents, documents made or deleted offline are sent once the server can be
reached, and one deleted elsewhere is removed. It uploads the images a document
shows that the server lacks for it, and fetches the ones the browser lacks, so a
document shows its images on every device.

| Variable | Meaning |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string; turns accounts on |
| `BETTER_AUTH_URL` | The address people open the editor at, such as `https://reactor.example.com` |
| `BETTER_AUTH_SECRET` | At least 32 random characters, used to sign sessions |
| `SMTP_URL` | SMTP server for email, such as `smtps://user:password@smtp.example.com`; required in production |
| `MAIL_FROM` | Sender address; defaults to `no-reply` at the editor's host |
| `AI_PROVIDER` | Turns AI on for people signed in: `anthropic`, or `openai` for any server speaking OpenAI's Chat Completions API (OpenAI, Mistral, OpenRouter, Ollama, vLLM) |
| `AI_API_KEY` | The provider's key, kept on the server; required for `anthropic` |
| `AI_BASE_URL` | Where the `openai` provider's API is; defaults to `https://api.openai.com/v1` |
| `AI_EDIT_MODEL` | The model for edits; defaults to `claude-haiku-5-5` for `anthropic`, required for `openai` |

The original `ANTHROPIC_API_KEY` setup still works: without `AI_PROVIDER` it selects
Anthropic. An explicit `AI_PROVIDER` takes precedence, and `AI_API_KEY` overrides the
legacy key for Anthropic.

For an OpenAI-compatible endpoint, set `AI_PROVIDER=openai`, `AI_BASE_URL` to its
API base (including `/v1` when required), and `AI_EDIT_MODEL` to its model ID.
Set `AI_API_KEY` if the endpoint needs one; local endpoints may leave it empty.
The endpoint must support streamed Chat Completions with function tools, and the
chosen model must support images when a request attaches one.

With `AI_PROVIDER`, the API's `/api/ai` gateway sends a request to change a
document, by someone who may edit it, to the model and streams back the operations it
proposes, which the editor checks before showing; a problem goes back to the model once.
Each person may make 100 requests a day, and use 2 million tokens, and each workspace 500
requests and 10 million tokens, one request of a person at a time.

Edit with words (`W`, or its application-bar button) opens a movable, dockable chat
window. Messages and proposals stay in the conversation; Accept applies a proposal as one
undo step, and Discard leaves the document unchanged. The canvas stays editable beside the
chat. Stop cancels a request, and New chat clears the local conversation. With a
selection, it sends only those shapes, their groups, and the variables and component
sources they use. Without a selection it uses the document and its design system. Each
message uses the current context, which the chat shows above its composer. Context is
limited to 32 KiB of UTF-8 JSON and 300 records, including component-source shapes. If it
is too large, nothing is sent: select fewer items or shorten their text. Context stays
whole rather than being silently truncated. These are transport limits, not a count of any
provider's tokens; the gateway still accounts for provider-reported token use.

### AI evaluations

`pnpm test tests/ai/cases.test.ts` runs forty edit cases through both provider adapters,
the real gateway and two collaborating editor copies. It checks the requested result,
no changes before acceptance, sharing after acceptance and one-step undo. Separate proposal
tests check cancellation, refusals, malformed replies and the one-repair limit.
The original six cases use saved event fixtures; the other thirty-four have explicitly
hand-authored `reference` rounds in their `case.ts`. These exercise the protocol and editor,
not model quality. A provider recording, when present, takes precedence over a reference.

With the provider environment above configured, `pnpm ai:eval` makes live calls on the
forty fixtures without replacing recordings. It writes `test-results/ai-eval.json`, including
per-case diagnostics, first-try and after-repair validity, semantic pass rate, first-operation
p50 and completion p95, and provider-reported tokens across both attempts. These timings
include the local gateway and validation, exclude test setup, and preserve provider streaming.
No production documents are sent. `pnpm ai:record` also makes live calls and replaces that
provider's recordings; review them before committing.

Live gates require 90% first-try validity, 97% validity after one repair, 97% of cases satisfying
the requested edit, first-operation p50 at most 2 seconds, and completion p95 at most 5 seconds.
Any atomicity, collaboration or undo failure fails the run independently of these rates.
Set `AI_EVAL_BASELINE` to a previous live report to fail on a semantic pass-rate drop greater
than three percentage points. It must cover the same provider and case suite; the model may
change. Without a baseline, the absolute gates still run and the report says `baseline: null`.
For a flat-rate cost estimate, supply both `AI_EVAL_INPUT_USD_PER_MILLION` and
`AI_EVAL_OUTPUT_USD_PER_MILLION`. Missing usage or prices produces an unknown cost, not zero.
This estimate does not account for cache discounts or other provider fees.

The **AI evaluation** workflow runs nightly at 03:20 UTC, or manually, only after the repository
variable `AI_EVAL_ENABLED=true` is set. Configure repository variables `AI_PROVIDER`,
`AI_EDIT_MODEL`, optional `AI_BASE_URL` and the optional prices, plus secret `AI_API_KEY` when
required by the endpoint. Its report is retained as the `ai-eval` artifact. After establishing
a baseline, set `AI_EVAL_BASELINE_RUN` to that workflow run's ID. Baselines expire after 90 days;
renew the pin deliberately, and establish a new baseline when the case suite changes.
Run live evaluations again before changing the model or system instructions. Offline results
do not establish the R2 model-quality gate or replace testing with people outside the team.

Without `SMTP_URL`, the development server writes email to its log instead.
`compose.yaml` runs the editor with a PostgreSQL database: set `POSTGRES_PASSWORD`,
`BETTER_AUTH_SECRET` and `SMTP_URL`, then run `docker compose up --build`. Server
tests run against PGlite, PostgreSQL built to run inside the test process.

## Variables

The Variables panel creates named colors, numbers, text and booleans. Inspector fields can
follow a variable, and text can include `${Name}` templates. Renaming a variable preserves
its references; deleting one leaves the shapes' values in place.

Values and template diagnostics share a pure central resolver. This first foundation step
keeps existing bindings and saved documents unchanged. Typed aliases, independent Theme and
Density dimensions, and design-system packages follow in the
[variable roadmap](./APPLICATION_PLAN.md#variable-foundation-v1v5-incremental).

## Camera Coordinates

Camera math and zoom bounds live in `src/app/camera.ts`. Camera position and pan
deltas use surface-local SVG units; positive deltas move content right/down.
The input adapter converts browser client coordinates through the surface CTM
before applying the camera transform. Input is ignored when that transform is
unavailable or singular.

All zoom controls share the 10%-1000% range. Ctrl-wheel pinch is continuous and
anchored at the pointer; toolbar/tool steps are discrete. Slider zoom preserves
the current pan position. Touchscreen pinch zooms the same way; see Input above.

## Not yet available

- Images on other devices when signed out: an image is kept in this browser only
- Moving documents made signed out into an account
- Organizations, teams and sharing documents with others
- Seeing other people's pointers and selections
- Exporting a drawing, and running a prototype

[APPLICATION_PLAN.md](./APPLICATION_PLAN.md) describes the work ahead and its order;
[REFACTOR_PLAN.md](./REFACTOR_PLAN.md) keeps the earlier audit and its phases.

## Development

`pnpm check` is what CI runs, with a second job that builds the Docker image,
runs it and checks it with `node scripts/smoke.mjs <address>`. The production build fails when
the bundle outgrows its budget in `webpack.config.mjs`. Install the test
browser once with `pnpm exec playwright install chromium` (Linux may need
`--with-deps`).

The lint gate (`pnpm lint:baseline`) fails on any finding in a file that changed
and on any finding beyond those recorded in `lint-baseline.json`. It compares with
`HEAD` by default; set `LINT_BASE_REF` to compare a branch, for example
`LINT_BASE_REF=origin/master pnpm check`. Remove entries from `lint-baseline.json`
as files are repaired; never add them.

`tests/support/store.ts` creates independent stores with in-memory storage,
IndexedDB (`fake-indexeddb`) and channels; startup is opt-in with
`store.onInitialize()`. Browser tests use port 4173 and fail rather than test
another server that holds it; traces of failures are kept in `test-results/`.
