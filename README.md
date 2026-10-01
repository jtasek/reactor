# reactor

A browser-based editor for prototypes, diagrams and mockups: draw shapes, links,
layers, groups and rulers on a canvas, and keep documents in the browser or, signed
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
| Ctrl/Cmd+D | Clone the selection; the clones become the selection |
| Ctrl/Cmd+C, Ctrl/Cmd+X, Ctrl/Cmd+V | Copy, cut and paste the selection, also between documents and tabs. A paste is centered where you last pressed on the canvas, or in the middle of the view when that place is out of sight |
| Ctrl/Cmd+G, Ctrl/Cmd+Shift+G | Group and ungroup the selection. A group is selected, moved, turned and scaled as one; click a shape in a selected group, or double-click it, to select that shape alone |
| Ctrl/Cmd+Alt+G | Remove the shapes selected inside a group from it |
| Ctrl/Cmd+Alt+L, Ctrl/Cmd+Alt+Shift+L | Move the selection to a new layer, take it off its layer |
| `+` or `=`, `-`, `0` | Zoom in, zoom out, reset zoom |

The Outline panel (in the explorer) lists the layers with their groups and shapes as a
tree. Drag a shape or a group onto a layer or a group to move it there. Press a layer's
name to see only that layer, with the shapes on no layer, on your screen; press it again,
or Show all layers, to see everything. A group is on one layer, with all its shapes.

The image tool asks for a PNG, JPEG, GIF or WebP file of 5 MB or less, then draws it
at its own proportions where you drag.

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
reached, and one deleted elsewhere is removed.

| Variable | Meaning |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string; turns accounts on |
| `BETTER_AUTH_URL` | The address people open the editor at, such as `https://reactor.example.com` |
| `BETTER_AUTH_SECRET` | At least 32 random characters, used to sign sessions |
| `SMTP_URL` | SMTP server for email, such as `smtps://user:password@smtp.example.com`; required in production |
| `MAIL_FROM` | Sender address; defaults to `no-reply` at the editor's host |

Without `SMTP_URL`, the development server writes email to its log instead.
`compose.yaml` runs the editor with a PostgreSQL database: set `POSTGRES_PASSWORD`,
`BETTER_AUTH_SECRET` and `SMTP_URL`, then run `docker compose up --build`. Server
tests run against PGlite, PostgreSQL built to run inside the test process.

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

- Images on other devices: an image is kept in this browser only, so a document
  opened elsewhere shows an empty box in its place until uploads arrive
- Moving documents made signed out into an account
- Organizations, teams and sharing documents with others
- Seeing other people's pointers and selections
- Components (reusable drawings) and plugins with other renderers (SVG, PNG, PDF)

[REFACTOR_PLAN.md](./REFACTOR_PLAN.md) describes each of these and the order they
come in.

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
