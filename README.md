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

The Explorer has two views. **Objects** shows actual containment: Canvas holds top-level
frames and loose artwork, and frames contain their child frames, groups and shapes.
Frames explicitly designated as screens carry a **Screen** badge. Draw with **Frame** (`f`),
then select **Screen** in Inspector’s **Type** field. Names, geometry and artwork stay in place;
many screens and ordinary frames can coexist on the same canvas.
Component definitions stay under Components, separate from scene objects.

**Layers** lists each global layer once, across all screens. Use its **New layer** button
to create one. Drag a shape or group onto a layer to move it there, or onto **No layer**
to remove its layer membership without changing its parent frame. A group is on one
layer with all its shapes. A layer's name selects it; its **Highlight layer** action shows
only that layer and unlayered artwork. **Show all layers**, available in either view,
restores the full view. Layer Hide/Lock applies to its members across screens.

Search filters the current view; matching objects retain their frame or layer ancestry,
and matching frames include their whole subtree. Disclosure arrows collapse containers.
Switching views preserves selection and each view's collapse state while Explorer stays open.

The image tool asks for a PNG, JPEG, GIF or WebP file of 5 MB or less, then draws it
at its own proportions where you drag.

Create component, in the selection's menu and the context menu, turns the selected
shapes into a component and puts an instance of it in their place. Editing the
component's source changes every instance; an instance can override the props its
source exposes, reset them, or be detached into plain shapes. The Library control
copies another document's component here and lists the copies, to place or inspect;
a copy shows when its source has changed and is updated on request.

Select an instance inside a Screen view and choose **Select component source** to edit its
children in place, including through rotated instances and instances positioned by a stack.
The instance keeps its placement while you edit; the stack reflows when you leave. Use
**Back to canvas** or Escape to restore your original view and selection. Edits update every instance.

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

### Frames

Choose **Frame** in the tool bar, or press **F**, then drag a frame on the canvas. Select it
by its boundary or name, or from Explorer. Drag the boundary to move it; use its corner
handles to resize it. Inspector edits its name, X/Y, width and height; press Enter or leave
the field to commit. Arrow keys nudge a selected frame. Copy, Cut, Paste, Clone, Delete and
Undo/Redo work with frames, including across documents.

Use Inspector’s **Parent** control to attach selected shapes or a frame to another frame;
choose **Canvas** to release them. Explorer nests frames with their shapes and groups;
collapse a frame to hide its tree contents. Searching for artwork reveals its frame ancestors,
and searching for a frame shows its complete subtree. Membership is explicit:
drawing inside a boundary does not attach an object, and reparenting preserves its canvas
position. Reparenting a grouped shape moves the whole group into the same frame.

Moving a frame carries its nested frames and artwork. Resizing changes only the boundary;
it does not scale or lay out its contents. A locked descendant or a group split across frames blocks moving the frame; Inspector explains why.
**Delete** removes only the boundary and releases its children in place; **Cut** and **Clone**
include the subtree. Copy/paste retains groups, variables and component dependencies.
Frames and their memberships are saved and shared; selection stays local. Concurrent parent
cycles appear as roots with an Inspector diagnostic and can be repaired through Parent.

Hide a frame in Explorer to hide its nested frames and artwork everywhere, including previews.
Locking a frame prevents edits to its descendants, including reparenting; their individual
Hide/Lock flags stay intact. Inspector explains inherited restrictions. Show or unlock the
parent in Explorer to recover; **Show all** also reveals hidden frames, except inside a
locked frame. Hiding a frame unselects the shapes in it. A remote Hide or Lock
cancels a descendant drag on its next pointer event without losing that remote change.
In the selected frame's Inspector, choose **Layout → Row** or **Column** for a
stack, or **Free** for manual placement. Set **Gap**, uniform **Padding** and cross-axis
**Alignment** (Start, Center or End). Children start with fixed sizes; groups occupy one slot,
hidden items occupy none, and overflow remains visible with a warning. **Stack order** in a
child's Parent section controls its slot independently of drawing order.

Resize frames and stack rectangles/images in Inspector; images keep their aspect ratio.
Text uses its font controls and instances their source dimensions. Canvas transforms that
would conflict with stack placement are unavailable; choose another parent for free editing.
Choosing Free, detaching a child or deleting its boundary preserves visible positions.
The **Sizing** section offers independent Width/Height modes on frames and individual,
unrotated stack rectangles: **Fixed**, **Hug contents** or **Fill available**, plus optional
**Min/Max width/height** (blank means no constraint). A leaf rectangle hugs its authored size;
a frame hugs its shown children plus gaps and padding. Fill shares remaining main-axis space
equally, redistributing space at minimums/maximums; on the cross axis it fills the inner size.
Minimums take precedence over maximums and may overflow. Unsupported combinations and
conflicting constraints show diagnostics. A hug/fill sizing cycle uses authored fallback
sizes for the cyclic axes; select Fixed on one participating axis to break it. Layout sizes
are local projections, never shared writes. Switching an axis to Fixed keeps its visible size.
Images retain intrinsic aspect ratio, while text, groups and instances keep their existing
sizes; new sizing rules on these or rotated rectangles are not exposed. Drag-to-reorder,
clipping and interactive screen behavior remain later increments.

### Component roles

Select a component source or one instance and use **Inspector → Role** to choose Text, Input,
Button, List or Image. Roles are explicit; existing artwork gets none automatically. Expose
source properties first (select a source shape and use its property exposure controls), then
link each role field to a compatible exposed property. Values continue to come from those
properties, including text templates, variables and instance overrides. Diagnostics identify
missing required fields or broken links without discarding the settings.

An instance starts **From source**. Editing its role settings creates a custom configuration;
**None** removes its role, and **From source** restores inheritance while keeping its visual
property overrides. Imported library sources stay read-only; their instances may customize
roles locally. These settings are saved, copied, shared and undoable. Interactive preview is
not available yet. List currently declares its label; item data and repetition come later.

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
link sent by email. Google and GitHub sign-in are optional: configure either provider's
client ID and secret below and its button appears on the login and account pages. Provider names
are available publicly at `/api/sign-in/providers`; credentials stay on the server.

Register these callback URLs in the provider's OAuth application, using your
`BETTER_AUTH_URL` origin:

- Google: `https://reactor.example.com/api/auth/callback/google`
- GitHub: `https://reactor.example.com/api/auth/callback/github`

Use the same paths on `http://localhost:4000` for local development. Google uses
OpenID/email/profile scopes; GitHub uses read:user and user:email. A new account
takes the provider's name and profile photo, and each later sign-in refreshes only
the photo, so the account keeps its own name and email. Signing in with a provider
links to an account of the same email address only once that address is confirmed.
The account UI displays the photo with a user-icon fallback, loaded only from
Google's and GitHub's image hosts. Document attribution still stores names, so those avatars cannot yet
be matched reliably to account photos. No OAuth credentials means email sign-in
continues unchanged; configuring only one of a provider's credential pair fails startup.

The login page, `/login`, is the single authentication entry point; `/signin` redirects
there. The account page, `/account`, shows the signed-in profile and sign-out controls;
signed-out visitors are sent to login with Account as their return destination. Both
pages share the same frame and controls. Google, GitHub, password and email-link sign-in
open the requested app page, or Documents by default. Return destinations are limited
to known app pages. Invitation callbacks continue to use `/invite` without its secret.

Email, provider and mode controls share one pending/error state. Signup and email-link
requests open a **Check your email** step with an editable address and a 30-second resend
cooldown. Signup resends verification rather than creating another account; confirming
the address signs the person in automatically. Authentication POST handling loads only
when used. The editor also works without signing in.

**Forgot password?** sends a recovery email without revealing whether the address has an
account. Its link opens `/reset-password`, expires after one hour and works once. Resetting
requires a matching new password, revokes the account's sessions, and returns to sign-in.
The reset token stays in the URL fragment until success; invitation secrets stay in the
original tab and are never included in recovery requests. Recovery preserves the allowed
return destination and uses the same check-email and resend controls.

Signed out, the editor says once, and again at 3 documents,
that documents are kept only in this browser. Signed in, documents sync with the
server, and the browser keeps a copy of them in a database of the account's own
(`reactor-<user id>`), apart from the ones kept signed out. Signing out waits for
changes still on their way to the server, says what would be lost if some cannot
be sent, then removes that copy and its cached permissions from the browser and
returns to `/login`. Open your account from your name or avatar and choose **Sign out**.

Signed in, the API at `/api` lists the user's workspaces, starting with a personal
one created on first use, and lists, creates and deletes a workspace's documents.
Reading needs the viewer role, creating editor, and deleting admin; a workspace or
document the user may not read answers as missing. A client may choose a new
document's id (a UUID), so documents made offline keep theirs; creating one again
in the same workspace returns it, and an id taken elsewhere is refused. Requests that change anything
must come from the editor's own address and send JSON. The app's tables sit next
to Better Auth's schema and are created or updated on start.

Open **Sharing** from the application bar or Documents page to invite someone as
an `editor` or `viewer`. Only workspace admins can create and revoke invitations.
Choose the workspace, recipient email and access level, then copy and send the
invitation link. The recipient signs in with the invited email, reviews the workspace
and role, and explicitly accepts. Google and GitHub sign-in retain the invitation in
tab-scoped storage, with token-free authentication callbacks. After email sign-in,
return to the original invitation tab or reopen the invitation link.
Invitations cover all documents in the workspace, including future documents, and
expire after seven days. The API does not send invitation emails.

All paths below start with `/api` and require a session. POST and DELETE requests
also require the editor's Origin; POST bodies are JSON.

| Request | Body / result |
|---|---|
| `POST /workspaces/:workspaceId/invitations` | `{ "email": "person@example.com", "role": "editor" }`; returns the invitation summary and a secret `token` once, replacing any pending invitation for that email |
| `GET /workspaces/:workspaceId/invitations` | Admin-only list of pending, unexpired invitations, without tokens |
| `DELETE /workspaces/:workspaceId/invitations/:invitationId` | Admin-only revocation of a pending invitation; does not remove an accepted membership |
| `POST /invitations/inspect` | `{ "token": "…" }`; shows the workspace name and invited role only to the signed-in, verified recipient, without granting access |
| `POST /invitations/accept` | `{ "token": "…" }`; grants membership and returns `workspaceId`, the effective `role` and `alreadyMember` |

Treat tokens as secrets: they are stored only as hashes and sent in request bodies,
never URL paths or query strings. Acceptance preserves an existing member's role.
A consumed token cannot restore removed membership, and an invitation stops working
if its creator is no longer an admin. Inspecting a consumed token also requires the
original accepting account to remain a member; matching the email alone is insufficient.
The Members section of Sharing lists names, profile photos and access. Admins can
switch an editor to viewer (or back) and confirm removal from the whole workspace.
Owner and admin memberships are protected here. Removing a member also revokes
pending invitations for their email; a new invitation can grant access again.

| Request | Body / result |
|---|---|
| `GET /workspaces/:workspaceId/members` | Admin-only member list with `id`, `name`, `email`, `image`, effective `role` and `owner` |
| `PATCH /workspaces/:workspaceId/members/:userId` | `{ "role": "viewer" }` or `editor`; changes an existing non-admin member, returns 204 |
| `DELETE /workspaces/:workspaceId/members/:userId` | Removes a non-admin member and their pending invitations, returns 204 |

These paths start with `/api` and use the same session/Origin rules as invitations.
Changes disconnect only the affected member's document connections on this server.
Incoming messages recheck membership, and idle connections recheck it at least every
minute. After a downgrade, the viewer reloads the server snapshot, discarding edits
that were made offline but no longer permitted, including their cached updates.
Other tabs cannot reintroduce those edits into a viewer's document.

Admin promotion, ownership transfer, document invitations, viewer links and presence
remain separate roadmap steps. Viewer documents open in a live,
read-only preview with zoom and Fit controls, without
editor commands or property panels. Rename, tag editing and deletion are unavailable
for viewers. Editors may edit, while document deletion stays admin-only. Cached viewer
permissions survive offline restarts; server documents with unknown access, including
those newly received from another tab, stay read-only until permissions can be checked. Permission state is local to the account,
never shared document data, and the server still independently enforces access.

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
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Optional Google OAuth credentials; both required to enable Google sign-in |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | Optional GitHub OAuth credentials; both required to enable GitHub sign-in |
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

Inspector and AI edits of a property, and the hide, show, lock and unlock commands, stop it
following its variable, even when the written value is unchanged. Dragging, arrow keys and
Align/Space detach only the axes they move, and dragging back does not restore a binding.
Resize detaches X or Y only when it moves the left or top edge, both on a turned shape, circle
or ellipse, and text size; group/component scaling detaches positions and corner
radius, and rotation detaches the angles and member positions it writes. Radius edits on
circles/ellipses detach X/Y; text-size edits detach Y because its baseline changes. A handle
click and measurements preserve bindings. Cancel restores the gesture's bindings and values,
including concurrent edits; Undo restores the binding together with a completed edit.
An AI operation can explicitly bind the property again in the same update.

Choose a variable's **Source** to follow another of the same type by ID. Renaming the source
keeps the alias; the panel shows its chain, resolved value and uses. Choose **Literal value**
to detach while keeping the resolved value. Cycles, incompatible types and missing sources
are rejected. Deleting a source locally converts its direct aliases to resolved literals.
If a concurrent edit leaves a missing source, the alias uses its retained fallback; a cycle
introduced by concurrent edits is bounded and reported in the panel. Copy/paste carries alias
dependencies and retains the existing name-and-type matching policy.

Dimensions and modes are **opt-in**. New documents have none, and each variable starts
with a single **Base** value. Open **Dimensions and modes (optional)** in Variables to
create a dimension such as Appearance or Brand. Add, rename, reorder or delete its modes
and choose its default. Assign a color or number variable using **Vary by**; missing mode overrides
use its base value. **Use base** removes an override.

Each document remembers your selected mode per dimension locally. Aliases follow their
source's dimension; shapes, components and thumbnails use the same context. Renaming a mode
does not break values or selection because references use IDs. Deleting a mode removes its
overrides; deleting a dimension returns its variables to base-only values. These definition
changes can be undone and are shared; preview selections are not shared.

Select a Screen, Screen view, frame or component instance to set **Modes** in Inspector.
Each dimension starts at **Inherit**. The effective mode and its source appear below the field;
choose a mode to override that dimension, or Inherit to reset it. Screen choices apply to all
its views; view choices let Home · Mobile and Home · Desktop show different palettes at once.
Frames and nested instances can override their inherited modes. These authored choices are
saved, shared and undoable; the Variables panel's preview remains local. A missing mode stays
listed with a diagnostic and uses the dimension's default until you choose another or reset it.
Opening Preview from a view captures its screen-root modes and viewport for that session. Later canvas
simulation/view changes do not change the session, while descendant overrides still apply.

Number modes currently affect **Screen views and Preview**: fixed rectangle dimensions and
frame width/height, stack gap and padding. Select a frame and use **Layout variables** in
Inspector to bind its numeric inputs. Existing rectangle Width/Height variable controls work
inside stacks. Layout resolves each view before drawing and hit testing; nested stacks and
min/max constraints use the same sizing rules. Missing/invalid numeric inputs use authored
fallbacks with diagnostics. Copy/paste and native packages retain numeric definitions.
Standalone Canvas geometry, other numeric properties and component-source geometry keep
their base values. Text/font mode measurement and wrapping are the next R4.4 increment.

Existing Light/Dark documents migrate to an editable Theme dimension, including their local
Dark preference. Plain documents stay base-only. Text templates and geometry still use base
values for unsupported consumers; text and boolean mode overrides remain gated. This changes
artwork, not the editor's interface theme.

Values and template diagnostics share a pure central resolver; saved definitions and clipboard
transfers retain modes and aliases. The operations API accepts an existing `dimensionId` and
color or number `modeValues` keyed by mode ID; older `darkValue` inputs remain readable for compatibility.
Design-system packages follow in the
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

### Design-system packages

Open **Variables → Design-system import / export** to download a versioned
`design-system.reactor.json` file or import one. Packages contain variables, aliases, text
references and optional dimensions/modes; they exclude shapes, accounts and local preview state.

Review the matches, then choose **Reuse existing**, **Replace existing**, or **Import separately**.
Identity matches survive renames. Names alone are shown as conflicts and never trigger an
unreviewed update. Replace keeps local variable IDs so bound shapes update; separate creates
independent copies with unique names. One policy applies to all matches in this first version.
Apply imports as one undo step; cancel or an invalid package leaves the document unchanged.
Packages are limited to 1 MiB and 1,000 variables/dimensions. Unsupported versions, incomplete
references and incompatible types or modes are rejected with a message. Reusing a dimension
requires compatible mode IDs; import separately when its modes differ. Replacing its default
requires updating every variable assigned to it, so unrelated values cannot silently change.

### DTCG design-token interchange

In **Variables → Design-system import / export**, choose **DTCG (colors / numbers)** to
import or export the supported [DTCG 2025.10](https://www.designtokens.org/tr/2025.10/format/)
subset. Opaque sRGB colors convert to Reactor's 8-bit hex values; unitless numbers and aliases
retain their meaning. Imports still require a preview and confirmation and undo in one step.

Use **Reactor (all definitions)** for modes, text or boolean variables. The first DTCG adapter
rejects unsupported definitions, including units, transparency, other color spaces, composite
tokens, descriptions/deprecation and unknown extensions, rather than producing a partial file.
See [the supported subset](design/design-token-interchange.md) for details and identity rules.

### Interactive prototype preview

Designate frames as **Screen** in Inspector, keep them visible directly on **Canvas**, then
press **Preview** (the play icon on the application bar). Ordinary frames remain containers.
Nested screens keep their identity but must be moved to Canvas to become destinations. Older
documents retain their existing screen destinations automatically. Give a
component or instance an Input or Button role in Inspector and link its exposed properties.
For a button, **Navigate to** chooses a target screen. Inputs and navigation are local to the
preview, never saved or synchronized. **Reset preview** clears input edits and returns to the
first screen. Closing the panel clears its runtime state. Broken role links, hidden/missing
navigation targets and layout problems retain the last valid preview with a diagnostic.
Preview supports shape/component SVG artwork, stored raster images and native inputs/button
overlays. Images are read in the editor from its document database or authorized asset sync,
verified by content/hash and decoding, and sent as a deduplicated raster table. The sandbox
cannot fetch images. Missing, invalid or oversized resources retain the last valid preview;
**Retry preview** tries again after an image arrives. Images keep their intrinsic aspect ratio,
transforms and opacity, including in nested/library components. Import external images into
Reactor first. Each image can be up to 5 MiB and a preview's images up to 8 MiB together, counted
as image file sizes; the drawing has its own 8 MiB limit. Each image is sent to the preview once. Diagram
connector links are not rendered. List roles are labeled containers; record repetition,
validation and shared preview links come later.

The runtime is a separate static server. It must be on a **different registrable domain** from
the editor, on an app subdomain, without the editor's cookies. Configure the same
`PREVIEW_ORIGIN` and `EDITOR_ORIGIN` on both processes, and run `pnpm serve:preview` on that
origin (the same image can run `node server.preview.ts`). Public origins require HTTPS.
The origin guard conservatively requires different final two hostname labels, so sites using
multi-label suffixes must also use a preview domain with different final two labels.
Deploy the editor and runtime from the same release; an outdated runtime shows an update notice
before any projection is sent. `pnpm build` builds both the editor (`dist`) and static runtime
(`dist-preview`). For development,
`pnpm build:preview` builds the runtime independently. It serves no accounts, documents, APIs or
external assets; its sandbox disallows same-origin access, forms, popups and top navigation.
The editor sends a validated projection over a dedicated channel; changes cannot travel back
into the document. Without configuration, Preview explains that hosting is unavailable.

Local testing uses distinct loopback origins with an explicit opt-in. In one terminal:

```sh
PREVIEW_ORIGIN=http://127.0.0.1:4001 EDITOR_ORIGIN=http://127.0.0.1:4000 PREVIEW_ALLOW_LOCALHOST=true pnpm start
```

After `pnpm build:preview`, start the runtime in another terminal:

```sh
PORT=4001 HOST=127.0.0.1 PREVIEW_ORIGIN=http://127.0.0.1:4001 EDITOR_ORIGIN=http://127.0.0.1:4000 PREVIEW_ALLOW_LOCALHOST=true pnpm serve:preview
```

Use `http://127.0.0.1:4000` for the editor, matching `EDITOR_ORIGIN` exactly. The runtime does
not hot-reload; rebuild/reopen Preview after changing its implementation. Browser tests start
both origins automatically and verify native controls, live updates, recovery and isolation.
