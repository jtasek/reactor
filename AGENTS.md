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
- `pnpm build` finishes without warnings. It fails when the entry bundle exceeds 432 KiB or
  any file 240 KiB (the budget in `webpack.config.mjs`, measured at 429 and 225 KiB); raise
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
name takes the next free number, as `Logo 2` (`copyName`).

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
  `asset:<hash>`, never image data, and `useImageUrl` shows it through a blob URL
  (`src/app/services/assets.ts`).
- `Text` — two-phase: select tool → click canvas to place + enter typing mode → type → Enter
  to commit (Escape cancels). The placement click starts typing inside `execute` (synchronous).
- `Select` — marquee: press + drag draws the dashed rect; `selectShapes` selects shapes whose
  (rotated) bounds overlap it (authoritative: sets `selected` true/false), and the selection
  persists on release. A click without a drag clears the selection, or, on a locked item,
  selects it (`selectClickedShapes`).

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
merges left across layers; the outline lists it under its first shape's layer. The outline
(`outline`, `src/ui/components/Outline`) is the explorer's tree of layers, their groups
and shapes: dragging a shape or group onto a layer or group moves it there. A row's menu
(`ItemMenu`, `src/ui/components/ItemMenu`) fades in under the pointer: hide and lock switch
the row's item itself, and its commands run for that item, which `runCommandOn` selects
first. Up to seven buttons are in the bar; More reveals the rest until the pointer or focus
leaves the menu. Pressing a
layer's name or star, or running the Highlight layer command for the layer of the selected
shapes (`selectionLayerId`), shows only that layer and the shapes on no layer (`showOnlyLayer`,
`document.shownLayerId`), on this screen only: it is a runtime field, neither saved nor
shared, and layers keep their own `visible`.

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
`src/app/rulers.ts`). Dragging out of the top ruler places a horizontal guide and out of
the left one a vertical guide, turning the Guides control on; dragging a guide moves it,
on whole canvas units (`guidePlace`), and dropping it on its ruler or beyond the canvas
removes it (`removesGuide`). A guide drag (`useGuideDrag`) is not a pointer gesture and
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
      selected shapes read the gesture (`useMeasuringShape`), since gestures change only
      those, so the other shapes do not render again as a gesture begins and ends.
    - Loops that only read thousands of shapes, as hit tests and snapshots on a press, read
      them with `untracked` (`src/app/untracked.ts`), skipping the store's tracking of each
      access; changes still go through the store.
    - `pnpm profile:drag [address]` times pressing, dragging and releasing a shape among
      3,000, then boxing them with a marquee, and prints the functions that took longest;
      see `scripts/profile-drag.ts`.
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
  domain hooks here rather than ad-hoc `useAppState` selectors in components.
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
  (`useScopedCommands`), so a new command needs no change to the menus; the canvas menu
  shows those its selection (`selectionScope`) can run now.
- **Commands and tools are registered by the editor page** as it loads (`registerEditor`,
  `src/pages/registerEditor.ts`), not at startup, so they stay out of the entry bundle; add
  a new one there. Until then the registry is empty (`getCommands`, `getTools`), so code
  outside the editor must not count on them. Registering one again replaces it in place,
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
  at every move. Panels are mounted only while shown (`PanelLayout`).
- **Shortcuts**: a tool or command declares `shortcut` (`r`, `mod+d`, `delete,backspace`;
  `mod` is Ctrl or Cmd, see `src/events/shortcuts.ts`). `events.pressShortcut` activates the
  tool or runs the command; the keyboard adapter skips it while a text field has focus. Keep
  bindings unique (`tests/shortcuts.test.ts` checks) and avoid plain Ctrl/Cmd browser keys,
  except a command's `clipboardEvent` shortcut, which is left to that browser event.
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
- **Style** (Prettier `.prettierrc`): 4-space indent, single quotes, semicolons, `printWidth`
  100, no trailing commas. ESLint enforces these plus `prettier/prettier: error`.
- TypeScript is `strict`; **avoid `any`**. `console.log` is a lint warning (only
  `warn`/`error`/`info` allowed) — prefer the `useLog` hook for debug output.
- `jsx-a11y/no-autofocus` is an **error**: focus inputs via a ref effect, not `autoFocus`.
- Prefer **early returns** over `else` branches.
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
