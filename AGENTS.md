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
layers, groups, rulers on a canvas). It is a **React 19 + TypeScript** SPA whose entire
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
  the session, `onConnect` the role (viewers are read-only), and content is kept in
  `document_states`. `server/assets.ts` keeps images: an editor uploads one's bytes with
  `PUT /api/documents/:documentId/assets/:hash` and a viewer reads it there. The server
  checks the type by content and the hash, stores the bytes once (`BlobStorage`), links them
  to the document (`document_assets`) and counts each workspace's images against a quota.
  `tests/server/support.ts` `serve()` runs all of it over HTTP.

### Verification baseline (do not treat as regressions)

- Type-checking and all unit and browser tests pass on a clean checkout; keep it that way.
- `pnpm lint` still reports **existing lint debt**, recorded per file in `lint-baseline.json`
  (not suppressed). `pnpm lint:baseline` fails on any finding in a file changed relative to
  `LINT_BASE_REF` (default `HEAD`, so run it before committing) and on findings beyond the
  recorded counts: fix a touched file's existing findings rather than adding exceptions.
- `pnpm build` finishes without warnings. It fails when the entry bundle exceeds 440 KiB or
  any file 240 KiB (the budget in `webpack.config.mjs`, measured at 429 and 225 KiB); raise
  it only for code the editor needs as it opens, after checking what grew.

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
  `rulers` keyed by id, plus `*Ids` arrays (derived, except `shapesIds`; see below).
- **Computed/derived** (`src/app/computed/`, `src/events/computed/`): Overmind `derived(...)`.
  `*Ids` (except `shapesIds`) and `selected*` fields are wired to these — keep derivations
  here, not in components.
  The pointer drag model lives in `src/events/computed/pointer.ts` (`topLeft`, `size`,
  `bottomRight`, `center`, `radius`, `offset`).
- **Actions** (`src/app/actions/`): one file per domain (`shape.ts`, `link.ts`, …),
  re-exported from `actions/index.ts`. Actions receive the Overmind `Context` and mutate
  state in place. `src/app/actions/shape.ts` is the canonical pattern (private
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
  test controls.
- **Server sync** (`src/app/services/serverSync.ts`, loaded only when signed in): syncs each
  document over one Hocuspocus socket through a Yjs document that mirrors the shared one, and
  passes the server's changes to `Collaboration.receive`, so they merge like any other copy's.
  The server's document list (`src/app/services/api.ts`) decides which documents exist; a
  record per account in local storage keeps the documents made here and the deletions not yet
  sent, so one the server lacks that was not made here was deleted elsewhere. It stops once
  another account is signed in. `tests/server/editorSync.test.ts` runs signed-in copies
  against the test server. Signing out (`src/app/services/signOut.ts`) warns about changes
  the server lacks, then removes the account's copy from the browser.
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
- **Renderers** (planned, not built yet; see Phase 9 in `REFACTOR_PLAN.md`): pluggable
  renderers in `src/app/renderers/` that turn a document into another format, such as JSON,
  XML, text, SVG, HTML, Canvas/PNG, PDF or ASCII.
- Entry: `src/index.tsx` creates the Overmind instance and wraps `<Shell>` in the
  overmind-react `<Provider>`. `Shell` switches between `Designer` and `Documents` pages.

## Tool lifecycle (read before touching tools)

A `Tool` (`src/tools/types.ts`) extends a `Command` with `component` (renders committed
shapes) and `designComponent` (the in-progress preview, rendered by `Stack`).

A pointer gesture is explicit state, `state.events.pointer.gesture`: `idle`, or `drawing`,
`marquee`, `moving`, `resizing` or `rotating` owned by one pointer, or a two-finger `pinching`.
`dragging` and `background` are derived from it. `src/events/drivers/usePointerAdapter.ts`
only translates DOM events into the gesture actions (`src/events/actions/pointer.ts`):

- **pointer down** → `beginGesture` decides the kind (a handle resizes/rotates; the select
  tool moves a hit shape or starts a marquee; any other tool draws) and snapshots what the
  gesture may change. Input from any other pointer is ignored until the gesture ends.
- **pointer move** → `movePointer`: drawing extends the path, marquee re-selects, and
  move/resize/rotate edit shapes live.
  A move starts only once the pointer goes beyond a click's slip (`beyondClickSlip`, 3 screen
  pixels), then follows it from where it was pressed; until then the press is a click.
- **pointer up** → `endGesture` applies the release position, runs `executeToolCommands()`
  exactly once for drawing and marquee gestures, then `resetTools()` — **synchronously**.
  React effects flush _after_ this, so anything a tool must persist on release has to happen
  inside the synchronous `execute` (not a mount/layout effect).
- **cancel** (pointercancel, lost capture, window blur, context menu, unmount) →
  `cancelGesture` never commits: it restores the snapshots and resets tools. Other copies'
  changes that arrive during the gesture update its snapshots, so canceling undoes only its own.
- Zoom is ignored during a drag. Touchscreen pinch (`beginPinch`/`updatePinch`/`endPinch`) is
  fed by Touch Events and may only replace a touch gesture that has not moved.

A tool adds what it drew with `drawShape`, which selects it alone; `addShape` leaves the
rest of the selection as it is.

`executeToolCommands` (`src/tools/actions.ts`) runs `execute(context)` for each active tool
when `canExecute(context)` is true. `resetTools` deactivates a tool when its
`shouldDeactivate(context)` returns true (return `true` = deactivate now).

Examples worth modelling new tools on:

- `Rect` — canonical simple tool using `pointer.topLeft` / `pointer.size`.
- `Image` — rect-like, but preserves the image's **intrinsic** aspect ratio. Choosing the
  tool runs its `activate`, which asks for a file (`effects.assets.pickImage`); the image is
  checked by its content, kept in the document database under the SHA-256 of its bytes, and
  set as `state.tools.imageToPlace` with its measured ratio. The shape's `source` is
  `asset:<hash>`, never image data, and `useImageUrl` shows it through a blob URL
  (`src/app/services/assets.ts`).
- `Text` — two-phase: select tool → click canvas to place + enter typing mode → type → Enter
  to commit (Escape cancels). The placement click starts typing inside `execute` (synchronous).
- `Select` — marquee: press + drag draws the dashed rect; `selectShapes` selects shapes whose
  (rotated) bounds overlap it (authoritative: sets `selected` true/false), and the selection
  persists on release. A click without a drag clears the selection.

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

A shape is in one group and on one layer at most: Group and Layer take the selected shapes
out of their groups or layers first, Group needs two shapes, and a group these commands
leave with one shape, or a layer left empty, is removed. Deleting one shape keeps its
groups, so member lists merge as collaboration expects; deleting or cutting a selection
(`removeShapes`) removes the groups it empties. Commands act on
`editableSelectedShapesIds`: shown, selected and not locked. Layers only show and hide.

A group is on one layer, with all its shapes (`putShapesOnLayer`, `putShapesInGroup`): Group
puts its shapes on the topmost one's layer, a group moved to a layer moves whole, and a shape
moved without the rest of its group leaves it. Loading does not repair a group other copies'
merges left across layers; the outline lists it under its first shape's layer. The outline
(`outline`, `src/ui/components/Outline`) is the explorer's tree of layers, their groups
and shapes: dragging a shape or group onto a layer or group moves it there. Pressing a
layer's name shows only that layer and the shapes on no layer (`showOnlyLayer`,
`document.shownLayerId`), on this screen only: it is a runtime field, neither saved nor
shared, and layers keep their own `visible`.

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
      and one listed as keeping bounds must update `shape.bounds` with the geometry.
    - `setShapeBounds` writes idempotently (epsilon compare) and `selectShapes` only writes
      `selected` when it changes — both avoid render loops / churn. Preserve these guards.

## Conventions

- **`useAppState(select)`** runs `select` after overmind-react starts tracking the component;
  overmind-react's own selector runs before, which subscribes the component rendered before
  it instead, so a selector computing a value never re-rendered its component.
- **Access state only through hooks** in `src/app/hooks.ts` (`useAppState`, `useActions`,
  `useEffects`, domain hooks like `useShapes`, `useCurrentDocument`, `useCamera`). Add new
  domain hooks here rather than ad-hoc `useAppState` selectors in components.
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
- **Commands**: run a command with `runCommand(command)` (`actions/commands.ts`), which checks
  its `canExecute` guard first; never call `execute` directly. Guards are `CommandGuard`s that
  only read `state`, so UI evaluates them while rendering (`useCommandEnabled`) and stays in
  sync. The command line submits text through `submitCommandLine`.
- **Property panel**: fields come from `SHAPE_PROPERTIES` (`src/app/properties.ts`), which
  says how each property is read, written and typed, and which section (`group`, e.g. Shape,
  Text) lists it; add properties there, not in the panel. Edits go through
  `setShapesProperty`, gated by `canEdit`.
- **Shortcuts**: a tool or command declares `shortcut` (`r`, `mod+d`, `delete,backspace`;
  `mod` is Ctrl or Cmd, see `src/events/shortcuts.ts`). `events.pressShortcut` activates the
  tool or runs the command; the keyboard adapter skips it while a text field has focus. Keep
  bindings unique (`tests/shortcuts.test.ts` checks) and avoid plain Ctrl/Cmd browser keys,
  except a command's `clipboardEvent` shortcut, which is left to that browser event.
- **Path alias** `src/*` → `./src` (in `tsconfig.json` and `webpack.config.mjs`). Mixed
  relative and `src/...` imports both appear; keep them consistent within a file.
- **CSS Modules**: `*.css` with generated `*.css.d.ts` typings. Don't hand-edit the `.d.ts`.
- **Style** (Prettier `.prettierrc`): 4-space indent, single quotes, semicolons, `printWidth`
  100, no trailing commas. ESLint enforces these plus `prettier/prettier: error`.
- TypeScript is `strict`; **avoid `any`**. `console.log` is a lint warning (only
  `warn`/`error`/`info` allowed) — prefer the `useLog` hook for debug output.
- `jsx-a11y/no-autofocus` is an **error**: focus inputs via a ref effect, not `autoFocus`.
- Prefer **early returns** over `else` branches.
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
