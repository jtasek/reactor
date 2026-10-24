# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

# Project guide

Guidance for Claude when working in this repository.

## What this is

**reactor** is a browser-based design / diagramming / prototyping tool (shapes, links,
layers, groups, guides on a canvas). It is a **React 19 + TypeScript** SPA whose entire
application state lives in a single [Overmind](https://overmindjs.org) store. Bundling is
done with **webpack + SWC**; it is served by **Express** in dev and a hardened static
server in production.

## Commands

The repo uses **pnpm** (`pnpm@11.5.0`, see `pnpm-lock.yaml`). Use `pnpm` for installs.

- **Dev server**: `pnpm start` — `node server.ts` (Express + webpack-dev-middleware + HMR /
  React Fast Refresh) on http://localhost:4000.
- **Type-check**: `pnpm typecheck` checks the app (`pnpm tsc`, which excludes tests), the
  tests (`tsconfig.test.json`) and the server (`tsconfig.server.json`).
- **Lint**: `pnpm lint` is read-only (`--max-warnings 0`, covers `src`, `tests`, root configs
  and `scripts`); `pnpm lint:fix` applies fixes. Flat config in `eslint.config.mjs`.
  `pnpm lint:css` runs Stylelint (`stylelint.config.mjs`) on `src/**/*.css`.
- **Tests**: `pnpm test` (Vitest, `globals: true` — no need to import `describe`/`it`/
  `expect`/`vi`). `pnpm test:watch` for watch mode. Store tests use `createTestStore`
  (`tests/support/store.ts`).
    - Single file: `pnpm test src/app/__tests__/utils.test.ts`
    - By name: `pnpm test -- -t "name of test"`
- **Browser tests**: `pnpm test:browser` (Playwright, Chromium) builds the production bundle
  and serves it with `server.prod.ts`. Shared editor helpers live in
  `tests/browser/support/editor.ts`.
- **Everything**: `pnpm check` runs the lint gate, type-checks, unit and browser tests.
- **Production build**: `pnpm build` — `NODE_ENV=production` webpack via `webpack.config.mjs`.
  Content-hashed JS/CSS, extracted CSS, generated `dist/index.html`. Overmind devtools and
  source maps off.
- **Production server**: `pnpm serve` — hardened static server `server.prod.ts` (helmet/CSP,
  compression, immutable caching, SPA fallback, `/healthz`, graceful shutdown). Never ship
  the dev `server.ts`.
- **Container**: `Dockerfile` (multi-stage, non-root `node` user) builds and runs
  `server.prod.ts`. `compose.yaml` runs it with PostgreSQL. `node scripts/smoke.mjs <address>`
  checks a running production server; CI runs it against the image, and
  `tests/browser/server.spec.ts` against the browser tests' server.
- **Server code** is TypeScript that Node (22.18 or later) runs as it is, with no build step:
  it may only use syntax Node can strip (no `enum`, namespaces or parameter properties, which
  `erasableSyntaxOnly` enforces), and relative imports name the `.ts` file. The tables' types
  are in `server/schema.ts`.
- **Accounts**: server code lives in `server/`. `startAccounts`
  (`server/accounts.ts`) turns accounts on when `DATABASE_URL` is set and both servers mount
  Better Auth at `/api/auth/*splat`; without it the editor runs signed out. Server tests
  (`tests/server/`) run Better Auth against PGlite, with email in an outbox; see README
  "Accounts" for the variables. The app's tables are Kysely migrations in
  `server/migrations.ts` (add new ones, never edit released ones), workspace queries live in
  `server/workspaces.ts`, and `server/api.ts` is the `/api` router, which checks the
  session, the `Origin` of changes and the role on every request. `server/sync.ts` serves
  documents over the `/sync` WebSocket with Hocuspocus: the upgrade checks the `Origin` and
  the session, `onConnect` and incoming messages the role (viewers are read-only),
  and idle connections recheck it with the session; content is kept in
  `document_states`. `server/assets.ts` keeps images: an editor uploads one's bytes with
  `PUT /api/documents/:documentId/assets/:hash` and a viewer reads it there. The server
  checks the type by content and the hash, stores the bytes once (`BlobStorage`), links them
  to the document (`document_assets`) and counts each workspace's images against a quota.
  A minute after it starts and then every hour it deletes the images no document links to
  any more, an hour after they were last added (`deleteUnusedAssets`). `tests/server/support.ts` `serve()` runs all of it over HTTP.

- **Sign-in pages**: `/login` is the signed-out entry point; `/signin` is an alias.
  Signed-out `/account` visitors go to login with Account as the return destination.
  Both pages share the lazy-loaded `pages/AccountFrame.tsx` frame and `pages/Account.tsx`
  forms, including invitation forms. `services/authentication.ts` resolves allowed destinations
  (Documents by default) for password, email links and OAuth; invitation callbacks remain token-free `/invite`.
  The form owns a shared pending/error state across providers, email and mode controls.
  Successful email requests show a check-email step with a 30-second resend cooldown;
  signup resends use Better Auth's verification endpoint. Authentication POST handling
  and its error messages load through `accountRequests.ts` only when needed.
  Forgot-password requests use the same check-email step. `/reset-password` accepts a token
  in the fragment, requires matching passwords, then removes the token and asks for sign-in.
  Better Auth expires reset tokens after one hour, consumes them once and revokes all sessions
  for that account. Recovery callbacks preserve only allowed destinations, including token-free
  `/invite`; the invitation secret remains in its original tab. The reset page is available
  even when signed in, and its exit navigation reloads to recheck the session.

- **Workspace invitations** (`server/invitations.ts`): admin-only creation/listing/revocation
  of pending editor/viewer invites; tokens are hashed and expire after seven days. Inspection
  and explicit acceptance require the verified recipient's session and a token in the JSON
  body. Existing roles are preserved, and consumed tokens cannot restore removed membership.
  `/sharing` lets admins create and revoke pending invitations; `/invite#<token>` lets the
  signed-in recipient inspect and explicitly accept, retaining the fragment through email
  and OAuth sign-in. OAuth continuation uses tab-scoped session storage and a token-free
  callback; email sign-in asks the person to return to their original invitation tab.
  These pages load on demand. `documentAccess` is local account state,
  populated by server sync and cached beside its record, never serialized into documents.
  Viewers use `pages/Viewer.tsx` (the existing thumbnail renderer, live, with zoom/Fit),
  without editor controls; `takesEditorInput` also blocks viewer/unknown access. Cached
  server documents without known permissions stay read-only, including new documents arriving
  from another tab before their workspace role is known; unsent local documents
  remain editable. Document rename/tag edits respect view access, and trash/restore/purge
  require admin. `server/members.ts` lets admins list members, change editor/viewer roles and
  remove memberships with their pending invitations; owner/admin memberships are protected.
  Its HTTP routes delegate membership rules and transactions to `server/services/members.ts`;
  database queries and mutations live in `server/repositories/members.ts`. Every service
  operation checks the actor's access and returns an explicit result. Post-commit connection
  cleanup failures are logged and retried once; they do not report a committed change as failed.
  Membership changes lock the workspace, as invitation creation/acceptance do, then close
  only the affected member's document connections (`sync.closeMember`). Viewer sync always
  starts from the server's state and replaces the local collaboration binding and saved
  updates; it never merges rejected offline edits. Read-only account documents ignore peer
  updates/deletions (`TabSync`'s `accepts`), while writable and signed-out tab sync stays intact.

### Verification baseline (do not treat as regressions)

- Type-checking and all unit and browser tests pass on a clean checkout; keep it that way.
- `pnpm lint` still reports **existing lint debt**, recorded per file in `lint-baseline.json`
  (not suppressed). `pnpm lint:baseline` fails on any finding in a file changed relative to
  `LINT_BASE_REF` (default `HEAD`, so run it before committing) and on findings beyond the
  recorded counts: fix a touched file's existing findings rather than adding exceptions.
- `pnpm build` finishes without warnings. It fails when the entry bundle exceeds 492 KiB or
  any file 248 KiB (the budget in `webpack.config.mjs`, measured at 491.2 and 227.8 KiB); raise
  it only for code every page needs as it opens, after checking what grew. Commands and
  tools load with the editor page, which registers them (`src/pages/registerEditor.ts`),
  not at startup: the store keeps only the tools namespace's state and actions
  (`src/tools/store.ts`).

## Architecture

The store is assembled in `src/app/index.ts` via Overmind `merge` + `namespaced`:

- Root namespace: `actions`, `effects`, `state` from `src/app/`.
- Namespaced modules: `events`, `tools`, `ui` (self-contained under `src/events/`,
  `src/tools/`, `src/ui/`, each with its own `state.ts`, `actions.ts`, `types.ts`).

So state is reached as `state.events.pointer`, `state.tools`, `state.ui`; document data is
at the root (`state.currentDocument`, `state.documents`).

Key flow: **React components → hooks (`src/app/hooks.ts`) → actions mutate store → Overmind
re-renders.** Components never mutate state directly.

- **State** (`src/app/state.ts`, `src/app/types.ts`): an `Application` holding `documents`
  keyed by id; each `Document` holds dictionaries of `shapes`, `links`, `layers`, `groups`,
  `guides` keyed by id, plus `*Ids` arrays (derived, except `shapesIds`; see below).
- **Computed/derived** (`src/app/computed/`, `src/events/computed/`): Overmind `derived(...)`.
  `*Ids` (except `shapesIds`) and `selected*` fields are wired to these — keep derivations
  here, not in components.
  The pointer drag model lives in `src/events/computed/pointer.ts` (`topLeft`, `size`,
  `bottomRight`, `center`, `radius`, `offset`).
- **Actions** (`src/app/actions/`): one file per domain (`shape.ts`, `link.ts`, …),
  re-exported from `actions/index.ts`. Actions receive the Overmind `Context` and mutate
  state in place. `src/app/shapeEdits.ts` is the canonical editor action pattern (private
  `getShape`/`putOnTop`/`deleteShape` helpers + exported actions).
- **Effects** (`src/app/effects.ts`): impure helpers (`newId`, localStorage, routing,
  `collaboration`, `openDocumentDatabase`, `openChannel`). Call them from actions (`effects.newId()`); don't import those libs
  directly in actions.
- **Tab sync** (`src/app/services/tabSync.ts`): shares each copy's changes with the other copies
  open on the device through a BroadcastChannel. A copy that missed messages, as while frozen
  or in the back/forward cache, catches up by exchanging state vectors when shown again.
  `tests/tabSync.test.ts` runs copies over a channel that can freeze one.
- **Collaboration** (`src/app/services/collaboration.ts`, `effects.collaboration`): binds the
  store to Yjs, which it loads in `initialize`; with server sync, the only app code that uses
  Yjs. It writes store changes to each shared document's Yjs document, one transaction per
  task, and applies other copies' changes through the `applyRemoteChanges` action, marked so
  they are not sent back. Objects merge field by field and member lists member by member.
  Gestures `pause` sharing until they end, so a drag is shared once. Every copy shows the same merged content: invalid entities are
  left out and references to missing shapes are dropped, as a local delete would, without
  writing these repairs back. `tests/support/collaboration.ts` runs copies over a network the
  test controls. Undo and Redo (`undo`, `redo`, `src/commands/history`) revert only this
  copy's own changes to a document's entities, through a Yjs undo manager started once the
  document is open, so opening it is never undone and other copies' changes stay; an undo is
  shared, saved and dated as an edit. Changes within half a second undo as one, as typing
  into a field, and `document.history` says what can be undone and redone.
- **Operations** (`src/app/operations.ts`, `src/app/actions/operations.ts`): changes that
  arrive as data, as a paste, go through `applyOperations`, a batch of typed operations that
  add variables, components, shapes and groups, and change or delete variables, shapes and
  groups the document has, each record in one operation at most and never a locked one.
  Variables change first, as in the editor, then shapes, and deletions come last
  (`removeVariable`, `deleteShape`). A reference names an ID the document has or the key of a
  record an earlier operation adds, never one the batch deletes; every record is read back
  with the durable readers before anything is written, so a batch applies whole or not at
  all, and the result answers the new IDs by key or the problem, naming the operation. A
  batch is one undo step of its own (`Collaboration.startBatch`), which records who made it,
  a person or an AI request (`undoAuthors`). Paste builds its batch in `pasteOperations` (`src/app/clipboard.ts`).
  `checkOperations` answers whether a batch would apply, naming the operation, without
  applying it.
- **AI** (`server/ai.ts`, `server/aiTasks.ts`, `src/ai/`): with `AI_PROVIDER`, the API's `/ai`
  gateway sends a person's request on a document they may edit to the model of its task
  through the provider the environment names (`providerFromEnv`): `anthropic`
  (`server/anthropic.ts`; edits default to Claude Haiku 5.5) or `openai`, any server speaking
  OpenAI's Chat Completions API (`server/openai.ts`). Each implements `AiProvider` with plain
  fetch, from a provider-neutral `Conversation` and the shared instructions and `TOOLS`, and
  sends a refused answer back as the model gave it. Models answer only by calling one tool per
  operation; each finished call streams back as one JSON line. The editor reads them as untrusted
  (`readOperation`), checks them with `checkOperations` and sends the problem back once
  (`/ai/requests/:requestId/repairs`, which the server answers from the conversation it kept);
  `propose` (`src/ai/client.ts`) returns the proposal, nothing applied, and aborting it stops
  the model. Each request is a row of `ai_requests` with its tokens, counted against a day's
  limits per person and per workspace (`AI_LIMITS`), one request of a person at a time.
  `state.ai` is `available` only signed in on a server with AI. `src/ai/` loads only with
  what uses it, never at startup. Edit with words (`EditWithWordsCommand`, `w`, and a button
  on the application bar only where AI is available) opens a non-modal chat for the current
  document (`state.aiEditDocumentId`) that loads with the AI client
  (`src/ui/components/EditWithWords`): it streams the proposal as a
  list of what each operation adds, changes or deletes (`describeOperation`) and the model's
  words, keeps it out of the document until Accept applies it as one undo step by the AI request, and Stop, New chat,
  Escape or closing aborts the request. The chat leaves the canvas editable. Its conversation and
  controller stay local in `src/ai/chat.ts`, surviving panel docking but cleared on close;
  keys stay in the chat only while it has focus. `documentContext` sends the selection with
  its group, variable and component dependencies, or the document without a selection,
  bounded to 32 KiB of UTF-8 JSON and 300 records before sending. Eval cases are folders of
  `tests/ai/cases/`: a fixture document with IDs of its own, a prompt, an optional image,
  checks of the document after
  applying, and a provider's recorded events for each provider (`recordings/anthropic.json`,
  `recordings/openai.json`), which the tests replay through that provider's adapter, the server
  and the editor's code; `pnpm ai:record` asks the provider `AI_PROVIDER` and the rest configure
  and records its answers. Forty cases run for each adapter offline; cases without a provider
  recording use explicit hand-authored `reference` rounds, never counted as live quality.
  `pnpm ai:eval` runs the configured provider without changing recordings and writes
  `test-results/ai-eval.json` with validity, semantic checks, latency, usage and optional cost
  and baseline comparison. The nightly workflow is opt-in (`AI_EVAL_ENABLED`); see README.
- **Server sync** (`src/app/services/serverSync.ts`, loaded only when signed in): syncs each
  document over one Hocuspocus socket through a Yjs document that mirrors the shared one, and
  passes the server's changes to `Collaboration.receive`, so they merge like any other copy's.
  The server's document list (`src/app/services/api.ts`) decides which documents exist; a
  record per account in local storage keeps the documents made here and the deletions not yet
  sent, so one the server lacks that was not made here was deleted elsewhere. It stops once
  another account is signed in. `tests/server/editorSync.test.ts` runs signed-in copies
  against the test server. Signing out (`src/app/services/signOut.ts`) warns about changes
  the server lacks, then marks the browser signed out before removing the account's copy and
  cached permissions, and returns to `/login`. Late permission responses cannot recreate those
  records after sign-out; local signed-out documents remain available.
- **Document database** (`src/app/services/documentDatabase.ts`): IndexedDB with an index of
  documents and each document's Yjs updates as records of their own; `compact` merges them in
  one transaction. Unit tests run it on `fake-indexeddb`.
- **Document sync** (`src/app/services/documentSync.ts`): started by `onInitializeOvermind`, which
  the pages wait for (`state.loading`). It loads the documents from the database (the first
  time, moving the local storage save there, backed up first), then saves each change, shares
  changes and created or deleted documents through tab sync, and keeps the document shown and
  cameras per device under `reactor:view`. A document that fails to load stays as saved. Other
  tabs' messages are taken only once loading is done; what they sent meanwhile is picked up
  from the database and by catching up.
- **Recently Deleted**: the Documents page's Delete moves a document there (`trashDocument`
  sets the shared, undated `deleted` field) and offers Undo; `restoreDocument` brings it back
  and `removeDocument` deletes it for good, as `purgeDeletedDocuments` does when the page
  opens, `RECENTLY_DELETED_DAYS` after the move (`src/app/documentList.ts`). Deleted documents
  are never the one open and lend no components.
- **Events** (`src/events/`): pointer/keyboard/clipboard input. `drivers/` are React hooks
  that translate DOM events into store actions — `useKeyboardDriver` and `useClipboardDriver`
  are mounted in `Shell` and `usePointerAdapter` in the canvas `Surface`
  (`src/ui/components/Surface/Surface.tsx`). Copied shapes are clipboard text in the format
  of `src/app/clipboard.ts`, and a paste checks them with the readers saved documents use
  and centers them where the document's canvas was last pressed (`pointer.lastPress`), or in
  the middle of the view (`effects.viewSize`) once that place is out of sight.
  The Copy, Cut and Paste commands (`src/commands/clipboard`) go through `effects.clipboard`
  (`src/app/services/clipboard.ts`): run by their shortcuts, the browser's clipboard event
  runs them (`useClipboardDriver`) with its data; run otherwise, they use the asynchronous
  clipboard and paste through the root actions it is connected to at startup.
  Shortcuts and the clipboard act only while `takesEditorInput` (`src/events/input.ts`).
- **Tools** (`src/tools/`): drawing/selection tools; tool state lives in the `tools` namespace.
- **Renderers** (planned, not built yet): `APPLICATION_PLAN.md` orders the work ahead,
  starting with SVG export and a standalone web package; it does not plan XML, Canvas or
  plugin hosting, so do not build REFACTOR_PLAN's Phase 9 plugins and renderers.
- Entry: `src/index.tsx` creates the Overmind instance and wraps `<Shell>` in the
  overmind-react `<Provider>`. `Shell` switches between `Designer` and `Documents` pages.

## Tool lifecycle (read before touching tools)

A `Tool` (`src/tools/types.ts`) extends a `Command` with `component` (renders committed
shapes) and `designComponent` (the in-progress preview, rendered by `Stack`).

A pointer gesture is explicit state, `state.events.pointer.gesture`: `idle`, or `drawing`,
`marquee`, `moving`, `resizing`, `rotating` or `rounding` owned by one pointer, or a
two-finger `pinching`.
`dragging` and `background` are derived from it. `src/events/drivers/usePointerAdapter.ts`
only translates DOM events into the gesture actions (`src/events/actions/pointer.ts`):

- **pointer down** → `beginGesture` decides the kind (a handle resizes, rotates or rounds;
  the select tool moves a hit shape or starts a marquee; any other tool draws) and snapshots
  what the gesture may change. Input from any other pointer is ignored until the gesture ends.
- **pointer move** → `movePointer`: drawing extends the path, marquee re-selects, and
  move/resize/rotate edit shapes live.
  A move or a marquee starts only once the pointer goes beyond a click's slip
  (`beyondClickSlip`, 3 screen pixels), then follows it from where it was pressed; until then
  the press is a click.
  A move snaps (`src/app/snapping.ts`): the moved shapes' box, taken when the drag began,
  is pulled so the nearest of its edges and center lies on another shown shape's edge or
  center within 6 screen pixels, on each axis on its own, and the lines it snapped to show
  (`SnapLines`): each from the first to the last point lined up on it, with a cross on
  every corner, edge middle and center of the box and of the other shapes there
  (`snapMarks`, from where along each line the targets' points lie), and the distance along
  it to the nearest other shape on it measured (`snapDistances`, loaded with the editor). On
  an axis where it is nearer, the box is pulled instead to be as far from a neighbor in its row
  as that neighbor is from the next, or midway between its two neighbors, and kept so only if
  it is still in that row once moved on both axes; its gap and those equal to it leading on
  from it are measured, with their length (the moving gesture's `equalGaps`). Neighbors are
  found from the targets' boxes sorted by where they start and end. Held Ctrl, or Cmd on a Mac, where Ctrl at the press is a right-click
  (`free`), it does not snap. The lines are taken when the drag passes the click's slip, kept
  sorted out of the store (`effects.dragTargets`), and searched by halves on each move.
  A resize snaps too (`snapResize`): the edges its handle moves (`movedEdges`) are pulled onto
  those lines within the same reach, swapped across and down for a quarter turn. At a corner
  of a shape or group kept in proportion (`keepsAspectRatio`), whose size follows the axis pulled
  further, the resized box's nearer moving edge snaps instead. The lines an edge then lies on
  show (`linesOnEdges`). A shape or group turned out of upright does not snap, and neither does
  a free resize; the lines are taken on the resize's first move.
  With Alt held over a shape outside the selection, and no gesture, the distances between the
  selection's box and that shape's show as measures (`measuresBetween`, `useMeasuredBoxes`,
  `Measures`): the gap when they are apart, else the distances between their edges. A window
  that loses focus lets go of the modifiers (`releaseModifiers`).
- **pointer up** → `endGesture` applies the release position, runs `executeToolCommands()`
  exactly once for drawing and marquee gestures, then `resetTools()` — **synchronously**.
  React effects flush _after_ this, so anything a tool must persist on release has to happen
  inside the synchronous `execute` (not a mount/layout effect).
- **cancel** (pointercancel, lost capture, window blur, context menu, unmount) →
  `cancelGesture` never commits: it restores the snapshots, removing fields the gesture added,
  and resets tools. Other copies' changes that arrive during the gesture update its
  snapshots, so canceling undoes only its own.
- Zoom is ignored during a drag. Touchscreen pinch (`beginPinch`/`updatePinch`/`endPinch`) is
  fed by Touch Events and may only replace a touch gesture that has not moved.

A tool adds what it drew with `drawShape`, which selects it alone; `addShape` leaves the
rest of the selection as it is. A shape added without a name is named `type-N`, as
`rectangle-3`: the next number in its document's sequence for its type (`nextShapeName`),
one past the highest that type's names have, so tools leave the name to the store, and a
clone takes the next one too (`shapeNamer`). A pasted shape keeps its name unless the
document has it already; then a name in a type's sequence goes on in it, and any other
name takes the next free number, as `Logo 2` (`copyName`). An instance is named after its
component instead, when added, cloned or pasted: the component's name while it is free, else
with the next free number, as `Card 2` (`instanceName`).

`executeToolCommands` (`src/tools/actions.ts`) runs `execute(context)` for each active tool
when `canExecute(context)` is true. `resetTools` deactivates a tool when its
`shouldDeactivate(context)` returns true (return `true` = deactivate now).

Examples worth modelling new tools on:

- `Rect` — canonical simple tool using `pointer.topLeft` / `pointer.size`. A rectangle's
  `cornerRadius` rounds its corners, drawn at most half its shorter side (`limitCornerRadius`).
  It is set in the inspector's Radius field, or by the radius handles (`RadiusHandles`), one
  inside each corner: the `rounding` gesture grows it, for all four corners, by how far a
  handle is dragged in along its corner's diagonal (`cornerRadiusAfterDrag`,
  `CORNER_INWARD`), and a badge shows it meanwhile. The handles stay in their corners'
  quarters, clear of the middle a press moves the shape by. A group's resize scales it with
  the rectangle.
- `Image` — rect-like, but preserves the image's **intrinsic** aspect ratio. Choosing the
  tool runs its `activate`, which asks for a file (`effects.assets.pickImage`); the image is
  checked by its content, kept in the document database under the SHA-256 of its bytes, and
  set as `state.tools.imageToPlace` with its measured ratio. The shape's `source` is
  `asset:<hash>`, never image data, and `useImageUrl` (`src/app/imageHooks.ts`) shows it
  through a blob URL (`src/app/services/assets.ts`). Signed in, server sync shares images
  (`src/app/services/assetSync.ts`, loaded with it): each time a document the server has
  changes or links, a second after, it uploads the images its shapes and imported library
  components show that the server lacks for it (`GET /api/documents/:documentId/assets` lists
  them, once a session), so a pasted or cloned shape's image is uploaded for its new
  document too; one refused is offered again ten minutes later. An image this browser lacks
  is fetched for its document and kept, asked for again a few times, and then less and less
  often while its shape shows, as another copy may upload it later. Uploads and downloads run
  three at a time.
- `Text` — two-phase: select tool → click canvas to place + enter typing mode → type → Enter
  to commit (Escape cancels). The placement click starts typing inside `execute` (synchronous).
- `Select` — marquee: press + drag draws the dashed rect; `selectShapes` selects shapes whose
  (rotated) bounds overlap it (authoritative: sets `selected` true/false), and the selection
  persists on release. A click without a drag clears the selection, or, on a locked item,
  selects it (`selectClickedShapes`).

## Frames

Free-positioned frame boxes are separate `document.frames` records, not rectangle shapes or
whole-selected groups. `selectedFrameId` is local runtime state. The Frame tool (`f`) commits
synchronously on release; boundaries/labels start `editingFrame` gestures, with owning-pointer
capture, click slip, cancel and rebasing over remote changes. `frameEdits.ts` loads through
editor helpers; only a small root action delegates to it. Keep frames out of component-source
editing. No geometric containment creates membership in this increment.

Schema v12 adds `Frame.kind` (`frame` or `screen`; absent input defaults to frame). Inspector
converts in place; the frame ID remains the navigation destination. New frames are ordinary.
Legacy saved documents and Yjs updates without the designation migrate roots to screens and
nested frames to ordinary frames, using safe `frameParents`. Multiple screens and frames share
one canvas. `screenFrames` selects only visible screens on Canvas for Preview and target pickers.
Nesting retains screen identity but makes the destination unavailable; Inspector explains it.
Demotion/deletion preserves authored target references for diagnostics. Separate screen/view
records are deferred to R4.2. Tests: `screenDefinitions.test.ts` and browser counterpart.

The durable reader checks finite positions, nonempty names and sides at least `MIN_FRAME_SIZE`.
Frames participate in persistence, shared undo, operations, clipboard, reset, thumbnails and
the read-only viewer. `framesIds` is derived with the other entity ID lists.
Frame clipboard payloads are validated independently of shape payloads, then pasted through
operations. `clipboardEdits.ts` also loads with the editor: do not move its shape/frame copy,
cut or paste implementations back into startup actions. `tests/frameEditing.test.ts` exercises
production copies and `tests/browser/screens.spec.ts` exercises the canvas UI.

Shapes and frames may name `parentFrameId`, with geometry in canvas coordinates. Reparenting
preserves position, applies to whole groups in the editor, and rejects cycles. The local
`frameParents` projection omits cycle edges without rewriting shared data. Missing frame
references are repaired like missing shape references, including in collaboration referrers.
Move carries descendants; resize changes only the boundary. Deletion releases immediate
children; cut removes only the captured subtree. Frame clipboard payloads carry nested frames
and shape membership/state, reusing the shape clipboard for artwork and dependencies. Keep
source-only component masters out of frames; their instance keeps the former parent.
`tests/frameMembership.test.ts` and `tests/browser/frameMembership.spec.ts` exercise these paths.
Frame Hide/Lock applies to the subtree through the local derived `frameStates` projection
(`frameState.ts`), using the same cycle roots as membership. Never materialize inherited flags
into descendants or persist/share the projection. Hidden descendants leave hit testing,
selection, snapping and previews; inherited locks gate properties, flag edits, reparenting and
operation batches. Explorer retains ancestors' Show/Unlock controls and Inspector explains the
restriction. Hiding a frame, here or in another copy, unselects the shapes it holds
(`unselectHiddenFrameShapes`). Show all reveals frames too, but leaves what a locked frame
holds hidden; a frame's own lock does not stop it. Ancestor Hide/Lock during a gesture cancels it on
the next local pointer event, outside remote apply so rollback is shared. Group and selection visibility editing also
load through editor helpers (`groupEdits.ts`, `visibilityEdits.ts`). Shape actions delegate to
`shapeEdits.ts`, also provided by the editor; keep the clipboard entry guards in startup.

Frames may have fixed `stack` rules (row/column, gap, padding, cross-axis align). `layoutOrder`
on a child is separate from z order. `frameLayout.ts` derives offsets from authored canvas
fallbacks without writing them to shared data, using cycle roots from `frameParents`. Groups
are one slot, hidden slots are omitted, overflow remains visible, and split groups diagnose
and leave that frame free. Use `renderedShape`/`renderedFrame` or read-only `layoutDocument`
for drawing, extents, hit tests, measurements and previews. Never mutate these views.
Measurements translate back to authored bounds; geometry keys use authored shapes to avoid
remeasuring every reflow. A deliberate membership/grouping change, component conversion, Free or boundary deletion bakes the visible
geometry through `stackEdits.ts`; ordinary reflow never does. Inspector's Stack order is a place among the
shown slots (`layout.slots`); moving there writes one order between the new neighbors
(`orderAtPosition`), which may be negative. Frame and rectangle/image sizing
is available in Inspector, images retain their ratio. Canvas transforms of projected content
are disabled; remote layout takeover cancels an active transform. Source-only masters stay
outside frames. Stack rules/order survive schema v8, copy, operations, sync and undo; v7 loads.
`tests/stackLayout.test.ts` includes production-copy convergence/undo and no feedback; browser
coverage is `tests/browser/stacks.spec.ts`.

Schema v9 adds optional per-axis `sizing` (Fixed/Hug/Fill and min/max) on frames and shapes,
with controls for frames and individual unrotated stack rectangles. `stackSizing.ts` evaluates
an iterative dependency graph; cyclic axes retain constrained authored fallbacks and produce
local diagnostics, never repairs. Acyclic dependents still resolve. Minimums win conflicting
maximums, keeping concurrently merged rules editable. Unsupported contexts retain intrinsic
geometry with diagnostics. `frameLayout` carries projected sizes too; measurement must not
write projected rectangle sizes back into authored bounds. Explicit detach/Free/deletion bakes
visible sizes as well as positions, and drops the sizing rules of shapes it takes out of
stack control, as grouping does. Only stack placement stops a frame's canvas move; Hug, Fill or a
clamped size stops only its canvas resize (`frameSizedByLayout`). Preserve sizing rules through readers, operations, copy,
collaboration and undo. Tests are `tests/stackSizing.test.ts` and `tests/browser/stackSizing.spec.ts`.
Gesture implementations (`src/events/pointerEdits.ts`) load through `editorHelpers().pointer`;
startup delegates retain a safe no-op cancellation before editor loading.

## Groups and layers

A group is one object. Pressing or boxing any of its shapes selects it, which selects all
of its shapes (`withTheirGroups`, `src/app/membership.ts`), so moving, deleting, cloning
and copying act on all of it. A group counts as selected (`selectedGroupsIdsOf`) when every
shown shape of it is; it then draws one box with handles (`GroupSelection`) turned by its
own `rotation`, and its shapes draw none. Its frame (`groupFrame`) is the box around its
shapes as drawn, in the group's turned frame. Rotating turns every shape about the group's
center; resizing scales them in proportion (`rotateGroup`, `resizeGroup`, through the
`rotatingGroup` and `resizingGroup` gestures). Clicking a shape of a group that is already
selected, or double-clicking it, enters the group (`enteredGroupId`, `enterClickedGroup` on
a release that did not move): its shapes are then pressed or boxed one by one until a press
outside. The pointer highlights a grouped shape alone only inside its group;
outside it, the group's box is highlighted (`hoveredGroupsIds`). A group's box counts
as the group: a press anywhere in it, also between its shapes, selects and drags the group
(`groupAtPoint`), and the pointer anywhere in it highlights it, unless a shape outside the
group is under it or it has left the canvas (`pointer.inside`). Frames are cached per
document (`groupFrames`, derived), so a pointer move does not recompute them. Shapes of selected groups are found once, in `Shapes`, so a selection change does
not re-render every shape.

Align and Space (`src/commands/align`) move the selection's items, a group selected as
one whole, by the boxes they are drawn in (`drawnExtent`); locked items stay and do not
count (`movableSelectedItems`, derived, so their ten guards share one list). They are in
the Inspector's Align section (`AlignSection`), for two items or more, not in the command
bar: their `places` name only the inspector (`commandsIn`). The offsets come from pure functions in `src/app/alignment.ts`.

A shape is in one group and on one layer at most: Group and Layer take the selected shapes
out of their groups or layers first, Group needs two shapes, and a group these commands
leave with one shape, or a layer left empty, is removed. Deleting one shape keeps its
groups, so member lists merge as collaboration expects; deleting or cutting a selection
(`removeShapes`) removes the groups it empties. Commands act on
`editableSelectedShapesIds`: shown, selected and not locked, derived, so their guards share one
list as the selection changes. Layers only show and hide.
Hide and Lock act on `selectedItems`: a group selected as one as a group, by its own flag,
and the other selected shapes by theirs.

A group is on one layer, with all its shapes (`putShapesOnLayer`, `putShapesInGroup`): Group
puts its shapes on the topmost one's layer, a group moved to a layer moves whole, and a shape
moved without the rest of its group leaves it. Loading does not repair a group other copies'
merges left across layers; the explorer lists it under its first shape's layer. The explorer
(`src/ui/components/Explorer`, from `explorerTree` and `outline`) has Objects/Layers
views (`config.explorerView`, kept per device like the Documents layout), loaded on demand
with the panel; only the shown view's tree is built. Objects shows actual containment under Canvas: frames
nest immediate artwork and child frames, unparented artwork stays on Canvas, and explicitly designated screens have a Screen badge. Global
layer wrappers never appear in Objects. Split groups retain actual parent placements. Keep
source-only members under Components, use safe `frameParents` cycle roots, and never rewrite
memberships from this projection. Layers lists each global layer once with all scene members,
plus No layer for unlayered artwork. New layer belongs in that view. Layer controls affect
members across frames; dropping on a layer or No layer changes only layer membership.
Pressing Canvas or No layer selects the canvas (`surfaceSelected`). Dropping on a frame row
moves the dragged objects into that frame, and on Canvas out of frames, like the Parent picker
(`reparentShapes`: groups move whole, canvas positions stay); locked frames take no drops. Group drops keep existing group/parent behavior. Search uses the document's runtime
`filter` (neither saved nor shared), retains ancestors, and includes a matching frame's subtree;
layer names match only in Layers. Selection survives switching views. Collapse keys distinguish
frame branches from the Layers view; search temporarily reveals collapsed matches without
forgetting them. A row's menu
(`ItemMenu`, `src/ui/components/ItemMenu`) opens inside the hovered or focused row: hide and lock switch
the row's item itself, and its commands run for that item, which `runCommandOn` selects
first. Four buttons fit in a row; More swaps to the remaining actions until Back is pressed or the pointer or focus
leaves the row. Pressing a
layer's star, or running the Highlight layer command for the layer of the selected
shapes (`selectionLayerId`), shows only that layer and the shapes on no layer (`showOnlyLayer`,
`document.shownLayerId`), on this screen only: it is a runtime field, neither saved nor
shared, and layers keep their own `visible`.

## Variables

Dimensions and modes are opt-in: new documents have empty `dimensions`, and a variable
needs no dimension. `VariableDimension` entities have stable IDs, named/ordered modes and a
default mode. A color variable may opt in with `dimensionId`; `values.default` is its base
and other keys are mode IDs. The default mode's colors are the base values, so it has no
override: making another mode the default moves its colors into the base and into the shapes
(`promoteDefaultMode`). `variableContext` holds the locally selected modes other than defaults;
`themeColors` projects bound fill, stroke and fontColor without writing shared shape values.
Root `previewModes` is local, keyed by document then dimension, saved only in `reactor:view`.
Geometry and templates stay at base until context-aware measurement is implemented.
Definitions use the ordinary shared entity/undo path. Keep all values and dimension IDs
through serialization, clipboard, operations and alias detachment. Legacy Light/Dark data
migrates into an editable Theme dimension, never into a dimension for otherwise plain documents,
also when another copy sends it (`Collaboration.migrate`, shared but never undone). A pasted
variable keeps a dimension this document already has, as edited here, and only its modes'
colors; a merge that leaves mode colors without their dimension reads as the base alone.

A variable (`Variable`, `document.variables`, listed by name in `variablesIds`) is a named
color, number, text or boolean. A shape property the inspector can change may follow one of
its kind (`shape.bindings`, by property key): binding, and every change of the variable
(`setVariableValue`), writes its value into the shape as if typed into the field, so
nothing else reads variables. Values and templates are resolved by `resolveVariable` and
`resolveTemplate`, with lookup by id or name, in `src/app/variableResolver.ts`, which uses
neither the store nor the renderer. Definition editors and serialization read the raw
`values.default`, so they keep templates. A binding holds while writing the value would
leave the shape as it is, numbers to a thousandth (`bindingHolds`, `src/app/variables.ts`);
a value the property refuses (`accepts`), as a blank name, is not shown as followed but
keeps the binding. Inspector edits, `updateShape`, operation updates and shape visibility/lock
commands detach the properties they explicitly write even when the value is unchanged.
`unbindEditedProperties` maps stored text fields to the text binding and position vectors to
both coordinate bindings; an operation may explicitly rebind through `changes.bindings`.
Measurements and handle clicks within a click's slip do not detach bindings. Translation
actions detach only moved axes (`unbindMovedProperties`), even if a drag later returns to its
starting value. Resize detaches X or Y only when it may move that top or left edge, both for a
turned shape, circle or ellipse, and font size; group/component scaling names position and
corner radius, while container rotation names position and rotation. Radius writes on
circles/ellipses detach X/Y, and text font-size writes detach Y. A canceled gesture restores
its rebased snapshot, including bindings; undo restores committed bindings with their values.
Variable changes still drop bindings that no longer hold, including old or merged edits.
Deleting a variable leaves the values. A variable may have an `alias` holding the ID of a
same-type source; `values.default` then retains a fallback. `setVariableAlias` validates the
source graph or detaches to the resolved literal; `setVariableValue` replaces an alias with
a literal. Resolution bounds aliases and templates together. Local source deletion converts
its direct aliases to resolved literals; a concurrently missing source drops the alias in
the local view and retains its fallback, without writing repairs back. Concurrent cycles
stay represented, resolve safely and show diagnostics. Clipboard dependencies include aliases,
ordered before their dependents; operations validate the final alias graph atomically.
Names are unique, trimmed and without `{`, `}` or `$` (`isVariableName`); one shared after
a merge means the variable with the lowest id (`variableNamed`). Copied shapes carry the
variables they follow, and a paste uses one of the same name and type or adds it.
The Variables panel (`src/ui/components/Variables`, off by default and loaded when shown)
creates, renames, edits and deletes them, asking first when one is used. In the inspector
each field that can change has a variable picker beside its label, and a field every
selected shape takes from one variable shows its name with a button that stops using it,
so its value changes only in the panel. Their hooks are in `src/app/variableHooks.ts`,
which loads with the editor page rather than with `hooks.ts`.

A text's content and a text variable's value may be templates: `${Name}` shows that
variable's value (`resolveTemplate`), `\${` stays as written, and a name of no variable or
a text variable leading back to itself stays as written and is noted under its field
(`templateProblems`, in `src/app/editorVariables.ts` with what else only the editor shows,
following references as `resolveText` does).
A template holds variables by id, with the name each had, as `${id$name}`, and shows them
by name (`templateWithIds`, `templateWithNames`), so renaming changes no text and one
deleted by another copy still shows its name. A text keeps its template in `template` and
the text it makes in `value` (`writeText`); every variable change writes again what
bindings and templates make (`applyVariableChanges`), dropping a template whose text was
set otherwise but keeping one a blank value left as it was, and deleting a variable
writes its value into the templates that hold it. The Variables panel counts these
templates as uses too.

## Design-system packages

Dimension-editing implementations (`src/app/variableDimensionEdits.ts`) are provided through
`editorHelpers().dimensions` with the editor, preserving the startup budget.
`src/app/designSystemPackages.ts` is loaded with the optional Variables panel. Native v1 JSON
packages contain variables and dimensions, with durable `source: { packageId, tokenId }`
identity on imported records. Keep this identity through local definition edits and durable
readers. Imports preview identity matches before name conflicts, then explicitly reuse, replace
or fork independent copies. The planner emits ordinary variable operations and `setDimension`;
`stageBatch` validates before `applyOperations` writes one shared undo step. Dimension default
changes require updates for all assigned variables; incompatible modes reject. Exports include
only definitions and no runtime state. The UI applies one conflict policy to the full package.

`src/app/designTokenInterchange.ts` is a pure DTCG 2025.10 subset adapter, loaded only with
Variables. Convert supported files into native packages and reuse their planner/operations;
never mutate documents from the adapter. Color imports explicitly quantize opaque sRGB to
8-bit hex. Unsupported types, units, modes and metadata must fail visibly before writes or
file downloads, rather than being dropped. The namespaced Reactor extension preserves source
identity and alias fallbacks. Keep the supported subset documented in
`design/design-token-interchange.md`; richer native types require actual consumers.

## The selection's menu

`SelectionMenu` (`src/ui/components/SelectionMenu`) is HTML over the canvas, so the zoom does
not change its size, and reuses `ItemMenu`; its buttons run commands on the selection.
`placeSelectionMenu` (`src/app/selectionMenu.ts`) puts it above the top left corner of the
selection's box (`document.selectionExtent`, derived), over the rotate handle when it would
cover it, or under the box without room above. It shows while the pointer is over the box,
the menu or the way between them, and is not rendered during a drag.

Locked items get the same menu, by the same rule: a click selects a locked shape or group
(`selectClickedShapes`), and its menu offers Unlock; a selection it is in stays, as for an
unlocked shape, and a group's hidden shapes are not selected. A press still
passes through a locked item: an unlocked shape under it takes the press, and a drag from it
draws a marquee, which skips locked shapes, so a locked item never moves.

## Rulers and guides

The Rulers and Guides controls are off by default, and their code loads, as one chunk, the
first time either is turned on (`src/ui/components/Rulers`, `src/ui/components/Guide`).
The rulers run along the canvas's top and left edges in canvas units (`rulerMarks`,
`src/app/rulers.ts`). While they are shown, the command bar sits below the top ruler
(`--ruler-size`), so a guide can be dragged out of it anywhere along it. Dragging out of the top ruler places a horizontal guide and out of
the left one a vertical guide, turning the Guides control on; dragging a guide moves it,
on whole canvas units (`guidePlace`), and dropping it on its ruler or beyond the canvas
removes it (`removesGuide`). Guides are drawn in `--primary-action-color`, apart from the grid's
greys, and a dragged guide shows its position in canvas units beside it. A guide drag (`useGuideDrag`) is not a pointer gesture and
does not start during one or while the context menu is open. One runs at a time; it takes
its pointer's events and the keys before the canvas does and changes the document once, on
release, so Escape or a lost pointer leaves it as it was. Guide lines are drawn over the shapes and what grabs
them under the shapes, so a shape, or a highlighted group, on a guide takes the press.
Hidden guides are not drawn and locked ones do not move.

## Bounding boxes & selection

- `Shape` (`src/app/types.ts`) is a discriminated union on `type`; each variant carries only
  its own geometry (lines `start`/`end`, pens `points`, the others `position`). Dispatch with an
  exhaustive `switch (shape.type)` ending in `assertNever` — never casts or field sniffing.
  Per-type move/resize live in `src/app/geometry.ts`; create shapes from a `ShapeInput` via
  `createShape`.
- Shapes are drawn and hit-tested in `shapesIds` order: by each shape's `order` (a fractional
  index, see `src/app/drawOrder.ts`), then by id. Only the store assigns orders: `createShape`
  takes one, `addShape` and `cloneShapes` put new shapes on top, `bringShapesToFront` and
  `sendShapesToBack` reorder, and loading repairs missing, invalid and tied orders. A merge
  can tie orders; tied shapes are drawn by id. `shapesIds` is document state, not derived, so
  reading it stays
  cheap: whatever adds, removes or reorders shapes must update it, and components read it
  through `useShapesIds`. Never rely on the key order of `shapes`.
- `getBoundingBox(shape)` (`src/app/utils.ts`) computes an **analytic** box per shape type.
- Each rendered shape is also **measured** with `getBBox()` in `src/ui/components/Shape/Shape.tsx`
  (the shape's primitive is wrapped in a `<g ref>`), and the result is stored as `shape.bounds`
  via the `setShapeBounds` action. `getBBox` returns canvas-space coords, unaffected by the
  camera pan/zoom transform on ancestor groups.
- **Always read bounds via `getShapeBounds(shape)`** (measured `bounds` when present, analytic
  fallback otherwise). Consumers: `Selectable`, `Resizable`, `Label`, plus `hitTestShape` and
  `shapeIntersectsBox` (`src/app/geometry.ts`), which hit-test presses and marquees where a shape
  is drawn: in its rotated frame, closed shapes by area and lines/pens by stroke.
- Performance rules for the hot path:
    - The measurement effect is keyed on `shapeGeometryKey(shape)` so toggling `selected` during
      a marquee drag does **not** force a reflow. Keep it that way.
    - A gesture that keeps bounds itself as it edits shapes is listed in `KEEPS_SHAPE_BOUNDS`
      (`src/events/gestures.ts`): while it lasts no shape is measured, and when it ends only
      the shapes whose geometry changed are. A new gesture kind must be added to the list,
      and one listed as keeping bounds must update `shape.bounds` with the geometry. Only
      selected shapes read ordinary gestures (`useMeasuringShape`). Framed shapes also check
      whether a frame gesture owns them, since a frame moves unselected descendants. Keep
      unframed, unselected shapes out of this subscription.
    - Loops that only read thousands of shapes, as hit tests and snapshots on a press, read
      them with `untracked` (`src/app/untracked.ts`), skipping the store's tracking of each
      access; changes still go through the store.
    - `pnpm profile:drag [address]` times pressing, dragging and releasing a shape among
      3,000, then boxing them with a marquee, and prints the functions that took longest;
      see `scripts/profile-drag.ts`.
    - `document.componentMembersIds` (derived) holds the shapes of the document's own
      components, so hover and selection need not gather them on every pointer move. Each
      instance works out its own component's source (`useComponentSource`): a component
      reading a derived value subscribes to every path that value read, so a source shared
      in one derived record would render every instance again when any component changed.
    - `setShapeBounds` writes idempotently (epsilon compare) and `selectShapes` only writes
      `selected` when it changes — both avoid render loops / churn. Preserve these guards.

## Conventions

- **`useAppState(select)`** runs `select` after overmind-react starts tracking the component;
  overmind-react's own selector runs before, which subscribes the component rendered before
  it instead, so a selector computing a value never re-rendered its component.
- A component that passes store objects to children without hooks of their own reads the
  fields they show itself and passes plain values: what such a child reads while rendering
  is not reliably tracked for any component, so it may not render again when it changes.
- **Access state only through hooks** in `src/app/hooks.ts` (`useAppState`, `useActions`,
  `useEffects`, domain hooks like `useShapes`, `useCurrentDocument`, `useCamera`). Add new
  domain hooks here rather than ad-hoc `useAppState` selectors in components. Hooks only the
  editor page uses go in a module that loads with it, so they stay out of the startup bundle:
  `src/app/componentHooks.ts` for components, `src/app/variableHooks.ts` for variables,
  `src/app/contextMenuHooks.ts` for the context menu and `src/app/imageHooks.ts` for images.
  A component takes what it shows through the narrowest hook (`useLayersIds`, `useGesture`,
  `usePointerPosition`) rather than a whole store object, and what changes on every pointer
  move is read by a component of its own, as the status bar's `MouseInfo`, so the rest does
  not render again.
- **Async work and state**: in production Overmind, a change an action makes after an
  `await` reaches components only with a later top-level action, and actions called through
  an action's own `actions` never count as top-level. Keep async work (requests, IndexedDB)
  outside actions, in services, and apply its results through synchronous actions called on
  the root actions (`useActions()` in components, `instance.actions` in startup). A change
  while a lazily loaded page first renders can miss its components, so startup applies what
  the pages first show (documents, the account) before `loading` ends.
- **Accounts**: `effects.accounts` talks to `/api/auth`; `state.account` is `loading`,
  `unavailable` (server without accounts), `signedOut` or `signedIn`. Signing in or out
  reloads the editor (`effects.reload`), so everything shown belongs to the new account;
  `shareAccount` makes the other open tabs reload too.
- **Action typing**: use the aliases in `src/app/types.ts` — `Action`, `ActionWithParam<T>`,
  `ActionGuard`, and `ActionWithResult<R>` or `ActionWithParamAndResult<T, R>` for an action
  that answers its caller. Destructure what you need from context (`{ state }`, `{ state, effects }`).
- **Commands in menus**: a command lists the items whose menus offer it in `scopes`
  (`shape`, `group`, `layer`, or `selection` for several items) and its place there in
  `menuOrder`. Menus take them from the registry with `commandsFor(scope)`
  (`useScopedCommands`), so a new command needs no change to the menus; the selection menu
  shows those its selection (`selectionScope`) can run now. The context menu
  (`src/ui/components/ContextMenu`) lists all of them, greyed out when they cannot run, with
  the `arrange` category in an Arrange submenu and Delete last; a row takes its name, icon
  and shortcut (`shortcutLabel`) from its command. It adds the clipboard, Remove from group,
  an instance's commands, the inspector's align and space commands in an Align submenu, and,
  on the canvas, zoom and the grid, guides and rulers controls.
- **Commands and tools are registered by the editor page** as it loads (`registerEditor`,
  `src/pages/registerEditor.ts`), not at startup, so they stay out of the entry bundle; add
  a new one there. Until then the registry is empty (`getCommands`, `getTools`), so code
  outside the editor must not count on them. So with the code only the editor's actions
  run: snapping, aligning, the clipboard's format, alias edits and applying operations
  (`src/app/operationBatches.ts`) are provided by `registerEditor`
  (`provideEditorHelpers`, `src/app/editorHelpers.ts`), and actions reach them through
  `editorHelpers()`; `createTestStore` provides them for store tests. The editor takes no
  input before they are provided (`editorLoaded`, in `takesEditorInput`), and a lint rule
  keeps the store's code from importing these modules again. The store does not track
  `editorLoaded`, so a hook reading it renders again when they are provided
  (`subscribeToEditorHelpers`), as `useTakesEditorInput` does. Registering one again replaces it in place,
  as a hot update does.
- **Commands**: run a command with `runCommand(command)` (`actions/commands.ts`), which checks
  its `canExecute` guard first; never call `execute` directly. Guards are `CommandGuard`s that
  only read `state`, so UI evaluates them while rendering (`useCommandEnabled`) and stays in
  sync. The command line submits text through `submitCommandLine`.
- **Inspector**: fields come from `SHAPE_PROPERTIES` (`src/app/properties.ts`), which
  says how each property is read, written and typed, and which section (`group`, e.g. Shape,
  Text) lists it; add properties there, not in the inspector. A number property with a
  `range` also gets a slider (`Slider`), as the Style section's Opacity, which is kept as a
  fraction (`opacity`) and shown in percent. A `color` property is a color picker with a None
  button, as Fill and Stroke (`colorProperty`), kept as `#rrggbb` (`isHexColor`) for closed shapes
  (`isClosedShape`) and outlined ones (`isStrokedShape`), and drawn through the `--shape-fill` and
  `--shape-stroke` custom properties each shape's group sets; a selected shape keeps its stroke.
  A text's fields that change its size sit with its geometry, as `fontSize`; its Font color
  (`fontColor`, the letters' fill) is a style field, read only for texts, so it is not measured. Edits go through `setShapesProperty`, gated by
  `canEdit`.
  During a gesture it keeps the values it showed as the gesture began and shows the new
  ones on release (`useSelectedShapesProperties`), so a drag or a marquee does not render it
  at every move. Panels are mounted only while shown (`PanelLayout`). Each opens
  `--control-width` wide, its content filling it, except the side bar, which fits its tools;
  the grips in its bottom corners (the one away from the edge it is docked to) resize it
  by drag or arrow keys, Delete or a double click restores the default, and the size is
  saved with its placement (`PanelPlacement.size`): the height only once a corner moves up
  or down, and shrunk to fit a smaller window. A panel docked to a side takes its column's
  width, and its grips change only its height; its own width applies again once it floats.
  Panels docked to a side sit at the top of their zone, under the corner dock above them.
  Panels docked together keep the order they were dropped in (`PanelPlacement.order`): a drop
  goes above the first panel whose middle is below the pointer, a line shows where while
  dragging, and Alt with an up or down arrow on a docked panel's header moves it among them.
- **Shortcuts**: a tool or command declares `shortcut` (`r`, `mod+d`, `delete,backspace`;
  `mod` is Ctrl or Cmd, see `src/events/shortcuts.ts`). `events.pressShortcut` activates the
  tool or runs the command; the keyboard adapter skips it while a text field has focus. Keep
  bindings unique (`tests/shortcuts.test.ts` checks) and avoid plain Ctrl/Cmd browser keys,
  except a command's `clipboardEvent` shortcut, which is left to that browser event.
  The command bar's info shows a command's shortcut as a key cap after its description
  (`shortcutLabel`: `Ctrl+D`, or `⌘D` where `usesCommandKey`).
  The arrow keys move the editable selection by `config.arrowKeyStep` canvas units or, with
  none, pan the view that many screen pixels towards the arrow, as scrolling does, so the
  content moves the other way (`src/commands/move`). They are the canvas's only while focus
  is on the page or in the canvas, not on a control (`takesArrowKey`). A held key's changes
  are shared once, when it is released (`keyboard.repeating`, `releaseKeys`).
- **Optional features**: a feature whose control is off by default loads its code when the
  control is turned on (`lazy` behind the control's check), not with the editor; only the
  control's state and the document's data stay in the store.
- **Path alias** `src/*` → `./src` (in `tsconfig.json` and `webpack.config.mjs`). Mixed
  relative and `src/...` imports both appear; keep them consistent within a file.
- **CSS Modules**: `*.css` with generated `*.css.d.ts` typings. Don't hand-edit the `.d.ts`.
- **Design system**: the Reactor design system (https://claude.ai/artifact/GHP3rx2aZGuHx3b13DieV6)
  names the colors, type, spacing, radii and shadows and says how the controls look and
  behave; read its `project/README.md` and `project/tokens.json` before changing UI. Its
  tokens are the custom properties in `:root` of `static/styles/site.css`, by the same name:
  use `var(--name)` rather than a literal color or shadow, and add a value there, and to the
  design system, before using it. `design/tokens.json` is a copy of the design system's
  tokens: change both together. `tests/designTokens.test.ts` fails when `:root` and it
  disagree, and `pnpm lint:css` (Stylelint) when a component's color, fill, stroke,
  background or box-shadow is not a variable; a line marked `no design token yet` is debt.
  Never remove an outline without drawing the focus ring (`--focus-ring-width` in
  `--focus-ring-color`) on `:focus-visible`.
  A panel's frame (`PanelLayout`) draws the glass; its content does not draw it again but
  sits on lighter cards (`--control-background`, `--radius-md`, `--panel-gap` from the frame)
  with `--hairline-color` between rows, as the Inspector and the Explorer do.
- **Style** (Prettier `.prettierrc`): 4-space indent, single quotes, semicolons, `printWidth`
  100, no trailing commas. ESLint enforces these plus `prettier/prettier: error`.
- TypeScript is `strict`; **avoid `any`**. `console.log` is a lint warning (only
  `warn`/`error`/`info` allowed) — prefer the `useLog` hook for debug output.
- `jsx-a11y/no-autofocus` is an **error**: focus inputs via a ref effect, not `autoFocus`.
- Prefer **early returns** over `else` branches and nested conditionals.
- Use braces for conditionals; do not write inline `if` statements. Separate logical code
  sections with blank lines, including before a return that follows another statement.
- Prefer `const`. When a mutable temporary accumulates a computed result, consider extracting
  a function that returns that result instead; retain mutation where it makes the code clearer.
- Extract **magic numbers into named constants** that explain their purpose. When TypeScript
  and CSS need the same value, define it once and share it through CSS custom properties.
- Listen to store mutations through the `addMutationListener` that `onInitializeOvermind`
  passes on (`listenToMutations`, `src/app/services/mutations.ts`), not the instance's own:
  Overmind drops a derived value's listener while calling listeners, which skips the one after.

## Workflow expectations

- Make surgical, complete changes; don't fix unrelated pre-existing issues unless the task
  requires it.
- Validate with the **smallest** targeted command first (`pnpm tsc`, `eslint <file>`, a single
  Vitest file), then a build if the change affects bundling/runtime.
- Commits use Conventional Commit prefixes (`fix(...)`, `feat(...)`, `perf(...)`) and end with:

    ```
    Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
    ```


## Component roles

Schema v10 adds optional `interaction: { role, props }` settings to component sources and
instance shapes. Instances without settings inherit the source; `none` explicitly opts out.
A custom instance replaces the complete role configuration, while visual overrides remain
independent. Role fields refer only to existing exposed component property IDs, never copied
values or new control-tree nodes. `componentRoles.ts` resolves types and values through the
existing component-prop/override system. Missing/incompatible references remain durable and
produce local diagnostics; never delete a component or instance because a role link is stale.
The initial list role has a label only, not item data/repetition. Roles are explicit authoring metadata, executed only in the opt-in sandboxed preview. No runtime behavior or role inference is implicit.
Role edits load through `editorHelpers().roles`; `roleHooks.ts` and the Inspector role fields
load with the editor. Role settings survive readers, operations, clipboard, clone, library
fingerprints/snapshots, sync and undo. Library hashes sort semantic map keys. Coverage lives
in `tests/componentRoles.test.ts` and `tests/browser/componentRoles.spec.ts`.


## Interactive preview

Schema v11 adds optional `RoleSettings.navigateTo`, naming a screen frame ID for button navigation.
Missing/hidden targets stay durable and diagnosable; never repair them into another screen.
The lazy `src/preview/project.ts` reads geometry through `layoutDocument`, visibility and resolved
component overrides. `src/preview/hooks.ts` reads it inside `useAppState` to track dependencies;
`overmind.json` alone bypasses tracking. Only the validated `PreviewApplication` DTO crosses the
MessageChannel. The iframe has `sandbox="allow-scripts"`, no same-origin access; bootstrap checks
both the parent Window and configured editor origin. The static `server.preview.ts` runtime
requires a configured separate site, with an explicit two-loopback-origin opt-in for local tests.
Keep its CSP network-free and its server free of account/API routes. Do not move its code into
the startup bundle. Runtime screen/input state never reaches document data. Invalid updates retain
the last valid preview. `projectPreview` returns a drawing with image hash references;
`createPreviewResources` prepares its deduplicated image table before `readPreview` validates
and allowlists the complete payload. Use `effects.assets.read` for local/authorized sync bytes,
never arbitrary URLs. Verify content/hash, per-file bounds and decoding; keep the 8 MiB bound on
decoded image bytes (`MAX_PREVIEW_IMAGE_BYTES`), separate from the drawing's 8 MiB JSON bound.
Each channel sends an image once; later updates refer to it and `readPreview(value, known)` resolves it. Cache only for the open panel, prune unused entries, retry missing resources and
abort stale preparations. The sandbox receives only raster data URLs, with no new CSP origins. Its version handshake
must succeed before the editor sends any application data; mismatches show an update notice.
The canvas and runtime share the default outline token; text keeps the canvas font fallback.
List repetition and shared links remain later increments. See README for hosting configuration.
