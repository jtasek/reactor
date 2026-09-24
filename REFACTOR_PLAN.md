# Repository Audit and Refactoring Plan

Audit date: 2026-09-22. Status: Phases 1-3 implemented; Phase 4 implemented pending a physical touch-device check; Phase 5 implemented; Phase 6 in progress; Phase 7 proposed (step 1 partly done); Phase 8 proposed (step 4 partly done); Phases 9-10 designed; Phase 11 in progress.

## Verified Baseline

- Working tree was clean before inspection.
- `pnpm exec tsc --noEmit`: passes. Test files are excluded from this check.
- `pnpm test`: 4 files, 63 tests pass. Coverage is concentrated in factories,
  geometry utilities, sequence generation, and persistence envelope handling.
- `pnpm exec eslint src --format json`: fails with 67 errors and 14 warnings in
  38 files. The audit did not use the mutating `lint` script.
- `pnpm run build:webpack`: passes with a 317 KiB entrypoint-size warning.
- No CI workflow exists under `.github`.
- No browser gesture test or Docker build was run. Runtime UI consequences below
  are based on tracing the current handlers, not on an interactive browser run.

## Findings

### F1 - High: persistence restores derived state as static data

`src/app/services/documentStorage.ts:12` serializes runtime documents wholesale.
`src/app/actions/startup.ts` installs the parsed documents directly. The derived
indexes and selections created in `src/app/factories.ts` are not rehydrated.
A local reproduction using the installed Overmind library and this same
serialize/restore pattern produced `shapes: [a,b]` but `shapesIds: [a]` after an
addition. This can prevent new shapes from rendering after restore. Dates also
become strings although runtime types declare `Date`.

Validation accepts any document with a string `id`, including `{id: 'd'}` without
camera or shape tables. Persistence tests explicitly use this incomplete fixture
and do not perform JSON round trips with a real store. Autosave is disabled by
default; when enabled, it observes only the current document while saving all
documents, so changes to an inactive document need not trigger a save.

### F2 - High: cancellation commits; gesture ownership is undefined

`src/events/drivers/usePointerAdapter.ts:195` aliases cancellation to pointer-up.
Completion executes the active tool. A canceled drawing can therefore create a
shape. Pointer end is skipped when the context menu is visible; Surface has no
lost-capture handler. A second pointer can reset an existing interaction because
there is no ownership check.

Only Ctrl-wheel invokes zoom. There is no touchscreen pinch implementation, and
Surface disables native touch gestures. Ctrl-wheel can also zoom during an active
drag, contrary to the previously requested behavior. Distinguish trackpad pinch
from touchscreen pinch when defining the supported input contract.

### F3 - High: zoom actions have incompatible limits

`src/commands/zoom/actions.ts:15` subtracts a step without a minimum, and its
registered command is always enabled. Repeated zoom-out can yield a negative
scale. Wheel zoom is bounded in `src/tools/actions.ts`, but that file's separate
`zoomIn`/`zoomOut` functions can overshoot bounds with a custom step. Coordinate
conversion divides by the resulting scale. Zoom behavior needs one authority.

### F4 - High: document lifecycle violates identity and ownership

`src/app/actions/document.ts:30` shallow-copies documents, sharing nested camera,
shape, group, and layer data. Edits to nested fields can affect the original.
`removeDocument` leaves `currentDocumentId` dangling when deleting the active
document. `createApplication` stores a generated document under `document-1`
although its actual `id` differs. These are action-level defects even though the
Documents page is not yet a functional document manager.

### F5 - Medium: rendering and selection disagree

`src/app/actions/shape.ts` hit-tests all unlocked shapes without checking
visibility. A hidden topmost shape can intercept selection of a visible shape.
`src/app/utils.ts:326` checks unrotated bounds although Shape renders rotation.
Group/layer visibility flags do not participate in Shape rendering. Shape deletion
also leaves membership IDs and link references behind.

### F6 - Medium: commands and UI expose unfinished behavior

- Move and Pan commands are registered and enabled but only log TODO messages.
- `src/ui/components/CommandLine/index.tsx` returns an action from its change
  callback without invoking it or passing command text.
- `src/events/drivers/useClipboardDriver.ts` contains empty handlers, exports a
  misleading `useKeyboardDriver` name, and is not wired into Shell.
- `src/ui/components/PropertyPanel/service.ts` returns the first shape's values
  for multi-selection rather than shared/mixed values.
- `src/pages/Documents.tsx` contains only a menu and heading.
- Multiple commands reuse `m` or `z` shortcuts; the keyboard adapter only updates
  keyboard state and does not dispatch these shortcuts.
- Command bar buttons evaluate `canExecute` through an action call during render,
  which tracks no state, so they never re-render when the selection changes:
  Delete, Clone, Group and Layer stay disabled after shapes are selected
  (found 2026-09-23 while testing Phase 5).

### F7 - Medium: reverse-proxy hop configuration is parsed incorrectly

`server.prod.js` describes TRUST_PROXY as a hop count, but passes numeric environment
values to Express as strings. With the installed Express, setting `"1"` returned
false for `trust proxy fn('10.0.0.2', 0)`, while numeric `1` returned true. The
documented one-hop configuration therefore does not behave as advertised.

### F8 - Medium: quality gates miss large parts of the system

Lint failures include 32 unused-variable findings, 12 explicit-any findings,
accessibility errors, and hook dependency warnings. `lint` applies fixes, making
it unsuitable as a read-only CI gate. Production webpack compilation does not
run TypeScript or lint checks. Server/config files fall outside the current lint
script, and tests fall outside TypeScript checking.

### F9 - Low: inconsistent abstractions and stale scaffolding

Shape variants extend a permissive base instead of forming a discriminated union;
geometry code relies on casts and field presence. Camera math is split between
drivers, commands, and tool actions, with opposite pan sign conventions.
`dist`, `midpoint`, `worldToScreen`, and `panBy` have no current call sites outside
their definitions. Confirm intended use before removal. README documents npm/yarn
while package.json pins pnpm. Development and production maintain separate HTML
templates and different fallback behavior.

## Execution Rules

- Execute the phases below in order, as separate reviewable changes. Do not mix
  broad formatting with behavioral repairs.
- For each behavioral defect, add a regression that fails before the fix. Keep
  pure geometry tests separate from store and browser interaction tests.
- Preserve persisted user data. Back up old payloads before migration; never
  silently overwrite an unsupported or invalid payload with a blank document.
- No new suppressions, unchecked casts, or disabled rules to make checks pass.
- Each phase must pass TypeScript, tests, production build, and lint on touched
  files. Untouched lint debt may remain until Phase 7 but must not increase.
- Phase completion requires its acceptance gate and a reviewed diff. If a gate
  fails, fix that phase before proceeding. Do not mark untested behavior complete.

## Phase 1 - Establish Repeatable Verification

Completed 2026-09-22. `pnpm check` runs a non-mutating lint debt/touched-file gate,
application and test type-checks, 66 unit/store tests, and a Chromium editor/SVG
wheel smoke test against a fresh production build. The remaining lint baseline is
66 errors and 14 warnings; touched files must be clean. Thirteen incomplete Box
fixtures were repaired and one duplicate test-suite title corrected. Node server
and build configurations are linted. See README for commands and comparison refs.

Verification also confirmed that the lint gate rejects a temporary new unused
variable, and that test-harness identifiers are absent from emitted JS bundles.
Local browser/server execution required sandbox escalation. No application
behavioral fixes from later phases are included.

1. Split scripts into read-only `lint` and explicit `lint:fix`; add a `check` script.
2. Add test type-checking configuration and scoped lint configuration for Node
   server/build files. Resolve any new errors within that scope.
3. Add an Overmind test harness with real document factories, controllable storage,
   and isolated startup side effects. Add a browser test harness for SVG input.
4. Record existing lint debt without suppressing it. Require touched-file checks
   until the final repository-wide gate becomes green.

Gate: reproducible baseline commands; test fixtures are type-checked; a browser
smoke test opens the editor; no audit-only files enter the application bundle.

## Phase 2 - Repair Persistence and Document Ownership

Completed 2026-09-23. Version 2 stores validated durable data, restores dates and
live derived indexes, and migrates version-1 document keys. Original payloads are
preserved; identical migration backups are reused across reloads. Invalid data,
including a stored JSON null, cannot be overwritten by session autosave. Text
content now follows the drawing tool's `value` field.

Clones own independent nested data and retain document-scoped content IDs so
internal references remain intact. Deleting the active or final document leaves
a valid editor; shape deletion cleans memberships, links, and parent references.
Autosave observes all documents, coalesces writes, flushes on pagehide/disposal,
reports failures, and safely supports repeated disposal/replacement. With the
persistence contract verified (step 6), autosave has been on by default since
2026-09-24. Open copies load each other's saves, but edits not yet saved when
another copy saves are lost; Phase 11 merges them instead.

Verification: 104 unit/store tests and 3 Chromium tests pass, including all drawing
tools' persisted content, restore/add/select/delete, clone isolation, last-document
deletion, inactive-document edits, migration backups, and malformed-data recovery.
Application/test types and the lint gate against `e63b55f` pass; all Phase 2 files
are lint-clean. The production build passes through the browser harness. Unrelated
lint debt remains deferred to Phase 7. Browser execution required local server
and Chromium permission. The diff was reviewed before marking this gate complete.

1. Define versioned persisted document DTOs containing durable fields only.
2. Validate nested geometry, finite positive camera scale, tables, IDs, and schema
   versions. Specify date encoding and rebuild runtime dates on load.
3. Rehydrate each document through a factory that reinstalls derived values and
   preserves identity. Explicitly migrate existing version-1 snapshots.
4. Make document keys match IDs; deep-clone durable content and rebuild derived
   state. Define the ID-remapping policy for cloned document contents.
5. On active/last-document deletion, select a valid remaining document or create
   a new one atomically. Clean dangling memberships/links when deleting shapes.
6. Observe all durable document changes for autosave; add flush/disposal behavior
   and expose save failures to the user. Retain the current default autosave
   setting until the persistence contract is verified.

Gate: create -> save -> JSON parse -> restore -> add/select/delete works in a real
store; derived indexes stay live; clone edits cannot change the original;
malformed data is recoverable; inactive-document edits persist when autosave is
enabled; deleting the final document leaves a usable editor.

## Phase 3 - Unify Camera and Coordinate Math

Completed 2026-09-23. Shared camera math lives in `src/app/camera.ts`; commands,
tool actions, the slider, and Ctrl-wheel zoom delegate to one bounded zoom action.
The range remains 0.1-10. Invalid scale/step/coordinate inputs are ignored; zero
wheel delta is a no-op. Pinch uses continuous exponential scaling while discrete
steps remove arithmetic noise. Zoom at a limit leaves the position unchanged.
The slider preserves pan rather than resetting it.

Surface-local SVG units are the common coordinate space. Positive pan deltas move
content right/down. Client points and wheel vectors use the inverse surface CTM,
including CSS/viewBox transforms. Missing, invalid, or singular transforms return
an unavailable result, and the adapter ignores those inputs. Pending frame-batched
pan is flushed before anchored zoom or pointer-down; pinch reads live camera state.

Verification: 137 unit/store tests and 5 Chromium tests pass, including custom-step
bounds, invalid input, rapid fractional zoom, matrix conversion, slider pan
preservation, and an offset/scaled SVG anchor regression. Application/test types,
touched-file lint, and the production build pass. The diff was reviewed; 62
unrelated lint findings remain deferred. Browser execution required local server
and Chromium permission. Gesture ownership, cancellation, and touchscreen pinch
remain in Phase 4.

1. Move pure camera math to a shared domain module and choose one pan sign contract.
2. Route command, wheel, slider, and tool zoom through one bounded action API.
3. Reject non-finite/non-positive inputs and make zero wheel delta a no-op. Keep
   continuous pinch scale distinct from discrete toolbar step rounding.
4. Use one surface-local/world conversion contract. Replace the current raw
   viewport-coordinate fallback with an explicit unavailable-transform result or
   a valid coordinate conversion; do not silently invent a canvas point.

Gate: all zoom entry points stay within bounds, custom steps cannot overshoot,
anchor points stay fixed across rapid zoom updates, and offset/scaled SVG
coordinate tests pass.

## Phase 4 - Make Gesture Lifecycle Explicit

Implemented 2026-09-23 in three stacked changes. The gesture is an explicit
state owned by one pointer (drawing, marquee, moving, resizing, rotating) or by
two touch contacts (pinching), with begin/move/end/cancel in actions; the adapter
only translates DOM events. Cancel, lost capture, blur, context menu and unmount
never commit: drawings are discarded, and edited geometry and selection are
restored from snapshots. Move/resize/rotate apply in actions, including the
release position. Zoom is blocked mid-drag. Touchscreen pinch uses the Touch
Events contact list with a minimal baseline (two contact ids, distance, scale,
world anchor); it may replace only an unmoved touch gesture, and a remaining
contact stays inert until all contacts lift.

Verification: unit/store tests and Chromium browser tests cover mouse and pen
drags, Ctrl-wheel (trackpad) and touchscreen pinch, cancel/lost capture, blur,
menu interruption, second contacts, fast move+release, and both pinch release
orders. Touch input is synthetic; it has not been checked on a physical touch
device, so the gate stays open until that is done.

1. Model idle, drawing, moving, resizing, rotating, and pinching interactions.
   Keep transitions and mutations in actions; adapters translate browser events.
2. Separate commit from cancel. Cancel must discard provisional drawing and
   restore the gesture snapshot for live move/resize/rotate edits.
3. Handle lost capture, context-menu interruption, blur, and unmount cleanup.
   Process cleanup even when the menu is open. Ignore unrelated pointer endings.
4. Implement trackpad pinch and touchscreen pinch as distinct inputs. Honor the
   earlier request to avoid storing full PointerEvent objects/collections. For
   touchscreen support, use the event's touch list with minimal gesture baseline
   state; define ownership so touch and pointer handlers cannot both mutate tools.
5. Keep an already-started drag in its current mode until completion; suppress
   zoom during it. Two contacts present before drag activation can enter pinch.
   Keep the remaining contact inert after pinch until the gesture fully ends.
6. Eliminate stale hook dependencies and ensure final coordinates are consumed
   before commit, including fast move/up sequences.

Gate: browser tests cover mouse/pen drag, trackpad pinch, touchscreen pinch,
cancel/lost capture, menu interruption, second contact during drag, and release
orders. A canceled gesture creates no shape, zoom never occurs during a drag,
and one gesture produces at most one commit.

## Phase 5 - Align Geometry, Selection, and Visibility

Implemented 2026-09-23 (#5-#8). Steps 1-2: shapes are a discriminated union with per-type required
geometry (lines/pens no longer carry an unused `position`), and move/resize are
exhaustive per-type operations in `src/app/geometry.ts`, pinned by a per-type
move/resize/rotate characterization suite. Step 3: one visibility rule mirrors
the lock rule (a shape is hidden by its own flag or any hidden group or layer)
and applies to rendering, presses, marquee, live edits and the selection that
commands act on; locked shapes show no resize/rotate handles. New groups and
layers start visible, and schema v3 shows v1/v2 groups and layers, whose
visibility never hid shapes. Step 4: presses hit shapes where they are drawn —
in their rotated frame, closed shapes by area and lines/pens by stroke, within
half the stroke plus 4 screen pixels — and marquees use rotated bounds; a click
without a drag clears the selection. Clone: one action copies a shape's geometry
(offset by 10, including lines and pens) with fresh identity, timestamps and
measurement; the command delegates to it.

Verification: store tests cover bounds, move, resize, rotate and clone for every
shape type, visibility/lock policy and migration, and hit-testing; browser tests
cover hidden layers, locked handles, and rotated and line presses. Clone has no
browser test yet: the command bar cannot enable it (F6), which Phase 6 fixes.

1. Convert shapes to a discriminated union with per-type required geometry.
2. Extract geometry operations from the large shape action module into pure
   functions; use exhaustive type dispatch instead of casts/field guessing.
3. Share visibility and lock policies between rendering, selection, hit-testing,
   and editing. Include group/layer visibility and define overlapping membership.
4. Transform hit-test points into unrotated shape space. Define expected
   hit-testing for line, pen, ellipse, and rectangle rather than relying on every
   shape's bounding rectangle.

Gate: hidden shapes cannot intercept selection; rotated shapes select at their
rendered location; lock/visibility policies agree across canvas and panels; all
supported shape types pass move, resize, rotate, and clone regressions.

## Phase 6 - Resolve Incomplete Features

In progress. Steps 1-2 (without shortcuts): commands run through one guarded
`runCommand`; guards only read state, so the command bar re-evaluates them as the
selection changes; its buttons are native buttons. The command line runs a
command by id or name on Enter and reports unknown or unavailable commands. The
Move and Pan stubs, which only logged a TODO, are removed rather than wired: as
bar buttons they have no target or distance, and dragging already moves shapes.
Shortcuts: every tool and command has a unique binding (tools by letter; Delete
or Backspace, Ctrl/Cmd+D, Ctrl/Cmd+G, Ctrl/Cmd+Shift+G, +/=, -, 0), dispatched
from the keyboard adapter except while a text field has focus or text is being
typed. Step 3: the property panel lists the properties every selected shape
shares (from one table, `src/app/properties.ts`) in sections such as Shape and
Text, shows "Mixed" where values differ, and edits all selected shapes through
typed fields; locked shapes only take metadata edits. Width and height are
read-only for now. Step 4: the documents page lists every document with its
shape count and creation date, and opens, clones and deletes documents, asking
before a delete. A new document takes the lowest unused `document-N` name, and a
clone is named after its original. Shortcuts act only in the designer, so keys
pressed on the documents page cannot change shapes that are not shown.
Remaining: steps 5-6.

1. Consolidate command registration, parsing, guards, and execution. Connect Move
   and Pan to the existing interaction actions and give shortcuts unique bindings.
2. Make the command line parse and execute on explicit submission, reporting
   invalid arguments. Do not execute mutations on every input change.
3. Implement shared/mixed property values with typed editable fields.
4. Build document listing/switch/create/clone/delete using Phase 2 actions.
5. Implement and wire clipboard operations with explicit serialization, or remove
   the inactive scaffold and keep the feature unadvertised in this refactor.
   Treat clipboard implementation as separate scope unless needed for release.
6. Remove confirmed orphan exports and stale commented code; rename misleading
   files/exports. Keep a feature inventory distinguishing shipped from deferred.

Gate: every enabled control/command performs its advertised operation; invalid
commands are harmless; shortcuts respect text inputs; multi-selection reports
mixed values; no TODO/no-op is presented as an available feature.

## Phase 7 - Enforce Accessibility and Repository Hygiene

Step 1 partly done (#11): the command bar's actions are native buttons, disabled
while their command cannot run. Action anchors remain in the toolbar, navigation
bar and context menu.

1. Replace action anchors and click-only elements with native buttons; add labels,
   valid ARIA state, focus behavior, and keyboard interaction. Note that
   `CommandBar/styles.css` declares `.commandBarButton button, div`, which styles
   every `div` in the app; scope it only with a visual check of the whole editor.
2. Remove unused imports/parameters and replace remaining any types with explicit
   types or unknown plus narrowing. Address hook dependencies without disabling
   rules. Separate debug logging from normal production interaction.
3. Update README for pnpm, runtime prerequisites, dev/build/serve commands,
   persistence behavior, input support, and deferred features.

Gate: whole-repository lint has zero errors and warnings; keyboard-only operation
of the main editor controls works; type-checking includes tests and Node configs
receive the appropriate lint checks.

## Phase 8 - Validate Servers and Automate Release Gates

Step 4 partly done (#10): the `Check` workflow runs `pnpm check` (lint gate, types,
unit and browser tests on a production build) for pull requests and `master`. Its
first runs exposed and fixed unapproved dependency builds under pnpm 11 and a
minimap directory that did not resolve on case-sensitive file systems. The Docker
build and smoke test, zero-warning lint and bundle budget remain.

1. Parse and validate TRUST_PROXY hop counts explicitly while preserving supported
   boolean/address forms. Document examples and test forwarding behavior.
2. Unify dev/prod HTML source and missing-asset fallback rules. Validate dev port
   input and close webpack/HMR resources with a bounded shutdown.
3. Test production health, deep links, missing assets, cache headers, CSP-compatible
   rendering, startup errors, and shutdown. Build and smoke-test the Docker image.
4. Add CI for frozen install, lint with zero warnings, application/test types,
   unit/store tests, browser regressions, and production build/server smoke tests.
5. Record the bundle baseline and introduce an explicit budget. Reduce the 317 KiB
   entrypoint only after inspecting the module graph; avoid arbitrary splitting.

Gate: a clean checkout passes the full CI pipeline and container smoke test.
Release is blocked by any failed gate, unresolved high-severity finding, or
regression in the Phase 4 input matrix.

## Phase 9 - Plugins and Renderers

Designed 2026-09-24; not started. This is feature work built on the refactored
core, not part of the release gate in Phase 8.

There is no standard for web application plugins. The design uses standard
building blocks: ES modules with dynamic `import()`, `<iframe sandbox>` with
`postMessage`, CSP, SemVer and JSON Schema.

Design:

- Two trust levels. In-process plugins get full access to the editor, so only the
  plugins the deployment itself serves and lists (the built-ins and any
  first-party additions) load in-process; nothing a user or a document supplies
  does. They may contribute tools and shape types, which run synchronously on the
  gesture and rendering hot path. Every other plugin runs in an opaque-origin
  `<iframe sandbox="allow-scripts">`. A Worker loaded from the app's origin or a
  blob: URL is not a sandbox on its own: it shares that origin's IndexedDB, caches
  and same-origin requests.
- Functions cannot cross `postMessage`, and the UI evaluates command guards and
  reads properties synchronously while rendering, so sandboxed plugins describe
  both as data: a command is enabled by a `when` condition over fixed context
  keys, and a property is a typed field of the plugin's
  `extensions` data, which the core reads and writes. Their code runs only behind
  async calls: running a command, rendering (plain data in and out) and a
  permission-checked document API.
- A manifest (`id`, `version`, `engine` SemVer range, `main`, `permissions`) is
  validated with a JSON Schema; incompatible engine ranges are refused.
- `activate(context)` receives a versioned `PluginContext`: `registerTool`,
  `registerCommand`, `registerShapeType`, `registerProperty`, `registerRenderer`,
  `onSelectionChange` and `runCommand`. Every registration returns a `Disposable`;
  deactivating a plugin removes all of its contributions.
- Custom shapes add one variant to the `Shape` union,
  `{ type: 'custom'; kind; position; size; data }`. The core owns the frame
  (`position`, `size` and the base `rotation`) and the plugin draws `data` relative
  to it, so moving a shape never needs the plugin. Exhaustive switches delegate
  that case to the registered definition (bounds, hit test, resize, primitives,
  component, data validator). A document whose plugin is missing keeps the data and
  draws the frame as a placeholder, which can be selected, moved, rotated and
  deleted but not resized or edited, because only the plugin knows how its data
  changes.
- Plugin data on shapes lives in an `extensions` record keyed by plugin id. Plugin
  properties name their property panel section (`group`), e.g. Events or Data.
- Renderers turn a document into an output format. Model serializers (JSON, XML,
  text) start from the validated persistence data, so they never drift from what
  is saved. JSON is lossless, and so is XML if its schema maps every field; text is
  a readable summary, not a format to re-import. Picture renderers (SVG, HTML, PDF,
  Canvas, PNG, ASCII) start from a display list: the visible shapes as primitives
  (rect, ellipse, polyline, text, image) in z-order with rotation applied, never
  the editor's React components. Each registered renderer adds an "Export as ..."
  command; its output is downloaded or copied. PNG draws the display list on an
  `OffscreenCanvas`; PDF needs a library. Cross-origin images without CORS headers
  make PNG and PDF export fail and must be reported for the shape concerned.

Steps:

1. Make the tool and command registries reactive and disposable, and register the
   built-ins through them as a core plugin. Report shortcut conflicts at runtime,
   replacing the uniqueness test's role for contributed bindings.
2. Add the renderer contribution point, the display list and built-in JSON, SVG,
   text and PNG renderers with export commands. XML, HTML, ASCII and PDF follow the
   same interface.
3. Add plugin properties and the `extensions` record, with validation, saved
   through Phase 11.
4. Add the `custom` shape variant and the shape-type registry, with placeholders
   for missing plugins.
5. Load the listed plugins from their manifests with a native
   `import(/* webpackIgnore: true */ url)` from the app's origin, which
   `script-src 'self'` requires. Without that comment webpack replaces the call
   with an empty context that rejects every URL with "Cannot find module". Check
   the engine range, isolate and report activation failures, put each plugin's UI
   behind an error boundary, and disable a misbehaving plugin.
6. Only if third-party plugins are wanted: the sandbox bridge (the iframe, RPC,
   permissions), starting with renderers, whose input and output are plain data.
   The production headers block every way to host the frame today: with no
   `frame-src`, `default-src 'self'` refuses blob:, data: and cross-origin frames;
   a srcdoc frame inherits `script-src 'self'`, which blocks inline script; every
   response carries `frame-ancestors 'none'`, so the app cannot frame even its own
   pages; and with helmet's default `Cross-Origin-Resource-Policy: same-origin`
   and no CORS headers, an opaque-origin frame cannot load the app's scripts.
   Serve the frame and its scripts from a route with their own headers, and
   confirm in a browser test that they load and run in the opaque origin.

Gate: built-in tools, commands and renderers work only through the public
registries; registering and disposing a contribution updates the toolbar, command
bar, shortcuts, property panel and export commands without a reload; every
renderer is tested: text formats (JSON, XML, text, SVG, HTML, ASCII) against fixed
expected output, PNG and the live Canvas by screenshot comparison, and PDF by
rasterizing its pages (for example with pdf.js) and comparing them the same way;
a document saved with a plugin's shapes and data reloads without the plugin, keeps
them as placeholders in their frames, and renders them again once the plugin
returns.

## Phase 10 - Components

Designed 2026-09-24; not started. This is feature work outside the Phase 8
release gate. It does not depend on Phase 9 and may be done first.

A component is a reusable drawing made of shapes and other components. It has
one source and any number of instances that draw it. Editing the source updates
every instance in the document. Today `Component` is only a saved list of shape
ids (`shapesIds`) with an unused `parentId`, and its lock and visibility toggles
do nothing.

Decisions: the source stays on the canvas; instances can override the props the
source exposes; instances can be moved and rotated but not resized; other
documents use a component through a copy that is updated on request.

Design:

- Source: the existing `Component` and its shapes, edited where they are with
  the normal tools. A shape belongs to at most one source.
- Instance: a new `Shape` variant,
  `{ type: 'instance'; componentId; position; overrides }`. It draws the source's
  shapes by reference, so nothing is copied or synced. The shapes keep their
  drawing order, and the top-left corner of their drawn box is placed at
  `position`. An instance is selected, moved, rotated, duplicated and deleted as
  one piece: its parts cannot be selected, it shows only the rotation handle, and
  its width and height are read-only.
- Props: the source exposes chosen `text`, `fontSize` or `visible` properties of
  its shapes, each with a label. The source's values are the defaults. An
  instance stores only the props it overrides and applies them when it draws,
  never to the source. An overridden prop no longer follows the source until it
  is reset.
  The property panel lists props in a Component section, shows "Mixed" where the
  selected instances differ, and can reset an override.
- Propagation: changes to the source's shapes reach every instance, including
  their arrangement, size and text, and their color and behavior once shapes
  have them. Overridden props are the only exception. An instance's position,
  rotation, lock and visibility are its own, so moving the source moves no
  instance. Behavior runs per instance: an action inside an instance changes
  that instance, never the source.
- Nesting: a source may contain instances of other components. A component can
  never contain itself, directly or through other components: this is refused
  while editing, a cycle produced by a merge is repaired by Phase 11's merge
  rules, and drawing stops at a depth limit. This replaces `parentId`. The outer
  component does not expose the props of the instances nested in it.
- Visibility and lock: `component.visible` and `component.locked` hide and lock
  only the source. Instances use each shape's own `visible` flag (or their
  override), never `isShapeVisible`, so hiding the source, or a layer or group
  that holds it, does not hide them.
- Membership: when a shape leaves the source, its props and their overrides are
  removed. A component that has instances is never left without shapes: deleting
  it, or deleting or removing its last shapes, is refused with a notification.
- Commands: Create component (from the selection), Insert instance (choose a
  component in the list, then click the canvas), Add to component, Remove from
  component, Select source, Reset overrides and Detach instance. Detaching
  replaces an instance with a group of plain shapes copied from the source, with
  the instance's overrides and rotation applied, in the instance's layers and
  groups. Nested instances stay instances.
- Libraries: to use another document's component, a document copies it with its
  shapes and nested components, keeping their ids. The copy records the document
  it came from and a hash of the component's saved data. It is read-only, and its
  shapes live inside the component, so they are neither drawn nor selectable.
  When the hash no longer matches, the document shows that an update is
  available and applies it on request, keeping the overrides whose props still
  exist. Copies keep working if the library document or component is deleted.
- Other phases: Phase 9's display list expands instances into their shapes, and
  its serializers keep them as references. Component props and plugin properties
  add rows to the property panel in the same way. Plugin shapes may be source
  shapes. Cloning a document (Phase 6 step 4) remaps `componentId`, membership
  and prop targets when it renews ids.

Steps:

1. Add the `instance` variant: its geometry, a hit test on its box in its
   rotated frame, duplication, and only the rotation handle in `Resizable`.
   Derive one record per component, shared by all its instances: its shapes in
   drawing order (`shapesIds` is in membership order), their drawn box, and a key
   built from their geometry and measured bounds, nested components included.
   Draw each source shape through a memoized child that reads the shape by id and
   renders its primitive (`getComponentByType`) with its rotation, not through
   `Shape.tsx`. Measure instances like other shapes, because only the DOM can
   size an overridden text: add the component key to their measurement key, and
   measure them when a gesture ends, not during it. Placing or duplicating an
   instance sets its `bounds` from the component's box. The minimap draws
   instances as boxes. Save instances and component props with the rest of the
   document's content (Phase 11), dropping `parentId` when documents are
   converted. An instance of a missing or empty component, a shape in two
   sources and a cycle can come from a merge, so they are repaired by Phase 11's
   merge rules instead of rejecting the document; stale props and overrides are
   dropped. Test with geometry, store and persistence tests, and with browser
   tests on seeded saves, including one that drags a source shape and checks that
   no instance is measured before the drag ends.
2. Add the `instance` tool, the commands, the source rules and unique shortcuts,
   and outline a source with its name while one of its shapes is selected.
   Browser tests cover source edits reaching instances, hiding or locking a
   source without affecting them, nesting, detaching, and refusing cycles or
   anything that would empty a source that has instances. Measure the cost of
   dragging with many instances before optimizing further.
3. Add props and overrides with the property panel's Component section, and test
   that source edits change only the props an instance has not overridden.
4. After document switching (Phase 6 step 4), add library copies: using a
   component from another document, reading a copy's shapes in the component
   record, showing available updates when a document is opened, and applying
   them. Test that a copy changes only when an update is applied and keeps
   working after its library is deleted.
5. Later, if wanted: scaling instances, sources kept off the canvas with their own
   editing mode, swapping an instance's component, and `<symbol>`/`<use>` for
   instances without overrides.

Gate: source edits, including size, reach every instance except overridden props;
moving a source moves no instance; nothing done to an instance changes its
source; hiding or locking a source leaves its instances unchanged; an instance's
parts cannot be edited on their own; no command leaves a component that has
instances without shapes; no cycle can be created, and one produced by a merge
is repaired the same way in every copy; saving and reloading keep sources,
instances and overrides; a library copy changes only when an update is applied.

## Phase 11 - Collaboration

Designed 2026-09-25; in progress. Several people can edit the same document live,
and open copies of the editor on one device share their changes. Steps 1-3 come
before Phases 9 and 10, since both add saved data.

Done: draw order. Each shape has an `order` (a fractional index); new shapes and
clones go on top, and saves without one keep their saved order.

Decisions: documents become CRDT documents (Yjs, starting on the stable v13.6
line), so concurrent changes merge instead of one overwriting another; each user
keeps their own view.

Design:

- Content: each document is a Yjs document holding everything saved today except
  the camera. View state (camera, selection, hover, measured bounds) is never
  shared; the camera is saved per device.
- Order: draw order is an explicit fractional index on each shape, because the
  key order of a Yjs map does not merge. The migration assigns indexes in today's
  order, and reordering a shape changes only its index. If items later nest (for
  example groups in groups), an item's parent and index are stored as one value,
  so a move never leaves them disagreeing.
- Store binding: the Overmind store stays the app's state. Changes to saved fields
  are written to the Yjs document in one transaction per action, from the mutation
  paths autosave already receives and an explicit list of saved fields per entity
  type. Remote changes reach the store through one action and are marked as
  remote, so they are not sent back. Only the binding uses the Yjs API, so a
  later move to Yjs v14 stays inside it.
- Merge rules: a merge can produce what each copy refuses on its own: today a
  group, layer, link or parent that refers to a shape deleted in another copy,
  and with Phase 10 a component cycle, a shape in two sources, or an instance
  whose component was deleted or emptied. After each merge and on load, the
  binding repairs these by fixed rules based on ids: references to deleted shapes
  are dropped, and an instance without a usable component draws a placeholder.
  Every copy reaches the same result without a server, and the load checks that
  reject such references today become these repairs.
- Storage: each Yjs document is saved in IndexedDB on its own, with a small index
  of documents. A document that fails to load affects only itself.
- Open copies on one device sync through a BroadcastChannel. A copy that was
  hidden, or restored from the back/forward cache, catches up by exchanging what
  each copy has already seen.
- Network: a WebSocket endpoint on the server relays changes and stores each
  document. Edits made offline merge when the connection returns.
- Presence: each user has a name and color, anonymous until accounts exist.
  Pointers and selections are shown to others and never saved.
- Cancelling a gesture undoes only that gesture's own changes, so it never
  reverts someone else's edit made meanwhile.
- A status indicator shows saved, syncing, offline or not saving, instead of
  one-off notices.
- Migration: the local storage payload is backed up and converted into Yjs
  documents once; later loads read IndexedDB.

Steps:

1. Add Yjs and the store binding for documents in memory. Test with a simulator
   of three bound copies making random concurrent edits, including different
   shapes, different fields of one shape, a delete against an edit, a reference
   to a shape deleted elsewhere and concurrent reorders, and check that all
   copies converge. Phase 10 adds its component rules to the same simulator.
2. Save documents in IndexedDB with the index, migrate the local storage payload
   (backed up first), and sync open copies on one device, including catch-up.
   This replaces autosave's whole-state save and tab sync.
3. Save the camera per device, make gesture cancel undo only its own changes, and
   add the status indicator.
4. Add the WebSocket endpoint to the production and dev servers, with storage per
   document on the server and `connect-src` allowing it, and connect documents to
   it.
5. Add presence: names, colors, remote pointers and selections.
6. Later, if wanted: accounts and sharing permissions, and undo per user. Undoing
   records into the redo history and redoing into the undo history, so undo then
   redo returns the same document even while others edit.

Gate: when two open copies or two browsers edit at once, every edit survives
unless both changed the same field (then one value wins in every copy), and all
copies end in the same state, including draw order and repaired merges; a copy
that was hidden, offline or restored from the back/forward cache catches up;
view state is never shared; a document that fails to load affects only itself;
the migration keeps the original payload; the bundle stays within Phase 8's
budget.

## Scope Boundaries

No framework/state-library replacement, broad dependency upgrade, authentication,
or new undo-history system is required by this plan. Gesture rollback
is scoped to cancellation. Investigate performance with measurements after the
correctness gates; do not add memoization preemptively.
