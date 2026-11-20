# Reactor delivery log

What each roadmap step delivered, moved here from [APPLICATION_PLAN.md](APPLICATION_PLAN.md) so
the plan keeps only what is still to do. Each entry is dated by when it was last written in the
plan; the step's pull requests carry the details. New steps add an entry here and leave one
line in the plan.

## R2 AI gateway and edit with words

_Recorded 2026-10-16._

Implementation status: the gateway, chat, bounded context and mutation operations are merged
in #178–#182. Forty cases now exercise both adapters offline, with a live evaluation command
and an opt-in nightly workflow. The additional reference answers are hand-authored fixtures;
their passing results do not establish model quality. Live validity, semantic accuracy, latency
and cost still need measurement with a configured provider, and the external-user gate below
remains open. Component creation as an AI operation is also not implemented; existing component
instances and source shapes can be edited.

## R4 Responsive screens, canvas views and invoked prototypes

_Recorded 2026-11-02._

Implementation status: a first layout spike, `tests/frames.test.ts` and
`tests/spikes/frameLayout.ts`, proves the layout algorithm on two Yjs copies merged in the
test. Its cases cover fixed row/column layout, nested/free frames, independent rule edits,
concurrent resize/reorder/reparent/delete, parent cycles, unreadable rules and local undo.
Derived positions stay outside the shared rules. It does not go through the production
`Collaboration` service, so stacks laid out again after merges across two production copies
are now covered by the production stack tests described below. [Spike findings and integration boundaries](design/frame-layout-spike.md)
record the coordinate-conversion work still needed.

First canvas increment implemented: draw independent frame boxes with the Frame tool (`f`),
select by boundary, name or Explorer, move and resize on the canvas, and edit names/geometry
in Inspector. Frames have their own validated durable table; save/reload, tab/server sync,
shared undo, operations, copy/cut/paste/clone, deletion/reset, thumbnails and viewer rendering
retain them. Selection stays local. Existing shapes and group selection remain independent;
being geometrically inside a frame does not create membership. Frame gestures cancel without
losing remote edits or resurrecting deleted frames. `tests/frameEditing.test.ts` and
`tests/browser/screens.spec.ts` cover these paths. Clipboard editing code loads with the editor
to preserve entry/file bundle budgets.

Explicit membership increment implemented: shapes and frames store optional `parentFrameId`
references, with Parent controls in Inspector and nested frame rows in Explorer. Geometry
remains in canvas coordinates; reparenting preserves it. Moving a frame carries its subtree,
resizing only changes its boundary, and deletion releases immediate children without moving
them. Frame copy/cut/clone includes nested artwork, groups, variable and component dependencies;
shape-only copies remain detached. Local edits reject cycles and preserve group membership;
concurrent cycles are roots in the local projection, with diagnostics and no shared repair.
Production-copy tests cover deletion concurrent with insertion, cycle creation, local undo and
canceling a subtree drag across remote membership edits. Durable schema v7 accepts v6 documents.
`tests/frameMembership.test.ts` and `tests/browser/frameMembership.spec.ts` cover this increment.

Inherited visibility/locking increment implemented: Hide excludes the frame's subtree from
canvas interaction, snapping and previews; Lock blocks descendant edits and reparenting,
including operation batches, without rewriting individual flags. Inspector explains inherited
restrictions and Explorer retains parent recovery controls. The cached local projection uses
the same cycle roots as membership and is never saved or shared. Remote ancestor Hide/Lock
cancels a running descendant gesture on its next pointer event, preserving remote flags and
sharing the rollback. Show all reveals hidden frames too. Group and selection visibility editing load with the editor
to preserve startup bundle budgets. Their editing code shares a bounded, separately cached chunk. Tests cover deep hierarchies, atomic rejection, production
copies, undo, reload and normal/narrow browser layouts.

Fixed stack increment implemented: Inspector offers Free/Row/Column, nonnegative uniform
padding and gap, and Start/Center/End cross-axis alignment. Stack order is authored separately
from z order. The pure local `frameLayout` projection places fixed-size shapes and nested
frames, treating a group as one slot, excluding hidden slots and reporting visible overflow
or groups split across frames. Rendering, selection, hit tests, snapping and previews use the
same offsets. Stored coordinates remain authored canvas fallbacks; only explicit membership/grouping,
component conversion, Free or boundary deletion commits the visible positions. Concurrent missing-parent recovery
uses the authored canvas fallback, including a child inserted unseen by the deleting copy.
Schema v8 preserves v7 documents. Production-copy tests cover independent rule/size edits,
local undo, convergence without layout writes, and cancellation across remote layout changes.

This increment sizes frames plus stack rectangles/images in Inspector (images retain their
aspect ratio); text keeps its font controls and instances keep their source dimensions.
Projected canvas transforms are disabled with an Inspector explanation; choose another parent
to edit other geometry freely. Reorder with Stack order. Direct drag-to-reorder,
clipping, automatic containment and interactive roles remain separate increments. Shape editing
loads with the editor to keep the existing entry/file budgets. Coverage:
`tests/stackLayout.test.ts` and `tests/browser/stacks.spec.ts`.

Sizing increment implemented: frames and individual unrotated stack rectangles have independent
Fixed/Hug/Fill axes and optional min/max constraints. Frames hug their shown slots; rectangles
hug their authored dimensions. Fill shares remaining main-axis space, redistributing at
constraints, or fills the cross-axis inner size. Minimums win conflicting maximums and may
overflow; conflicts stay editable. The iterative sizing dependency graph diagnoses actual
cycles per axis and falls back to constrained authored sizes only for participating nodes;
acyclic dependents still resolve. Unsupported contexts diagnose and keep authored dimensions.
Sizes join positions in the local projection and are never written by reflow. Explicit detach,
Free and boundary deletion preserve visible geometry. Schema v9 preserves v8 documents and
rules through operations, clipboard, collaboration and undo. Gesture implementations load
with the editor to retain bundle budgets. Coverage: `tests/stackSizing.test.ts` and
`tests/browser/stackSizing.spec.ts`, including deep chains, production-copy merges and cycle recovery.
Text, images, groups, instances and rotated rectangles retain their existing sizing behavior;
text wrapping and image aspect-ratio dependencies need separate measured support.

Role authoring increment implemented: components and instances explicitly choose Text, Input,
Button, List or Image roles. Typed role fields link to existing exposed component property IDs,
so source values, templates, variable bindings and instance overrides remain the single value
system. Instances inherit source settings unless explicitly customized, may choose None, and
can restore inheritance without clearing visual overrides. No roles are inferred. Missing or
incompatible links show local diagnostics and remain durable for repair. Schema v10 retains v9
files and role settings through persistence, operations, clone/copy/paste, library snapshots,
collaboration and undo. Library hashes include roles with stable property-map ordering.
This increment authors and resolves semantics; it does not execute controls. List currently
has an accessible label; its item data and repetition belong to the later data/list increment.
Coverage: `tests/componentRoles.test.ts` and `tests/browser/componentRoles.spec.ts`.

First sandboxed preview increment implemented: Preview opens a lazy-loaded, dockable panel.
In that initial implementation, visible top-level frames are screens; nested frames retain the
shared stack/visibility projection. R4.1 now replaces this inference with explicit screen identity.
Button roles may name a target screen, with source inheritance and instance customization.
Native input values and screen navigation live only inside the runtime, survive valid graph
updates, and clear on Reset or closing the preview. Invalid role links, missing/hidden targets,
layout problems and unsupported image resources show diagnostics while retaining the last valid
projection. The sandbox receives only an allowlisted drawing/control DTO over a MessageChannel,
never the store, credentials or executable expressions. It runs without same-origin access on
an explicitly configured separate site; local development/tests opt into two loopback origins.
The static-only runtime has no auth/API endpoints and cannot fetch network resources. Schema v11
preserves optional navigation targets and opens v10 documents. Component artwork remains SVG;
inputs use native fields and buttons use keyboard-accessible overlays. List roles remain labeled
containers without repetition. Images and diagram links are not rendered in this first increment;
image-bearing screens fail visibly rather than silently losing artwork. Hosting is opt-in, so the
editor remains usable without preview configuration. Coverage: `tests/preview.test.ts`,
`tests/previewConfiguration.test.ts`, `tests/browser/preview.spec.ts`.

Image/artwork increment implemented: image primitives reference a deduplicated raster table,
prepared asynchronously in the editor from its document database or authorized asset sync.
Content signatures, SHA-256, the existing per-image size limit and browser decoding are checked
before a complete projection is sent; images are bounded at 8 MiB of decoded bytes, apart from the
drawing's own 8 MiB bound, and each image crosses a preview channel once.
Only required, shown images are read, including nested component/library artwork. Valid images
are cached for the open panel, unused entries are discarded, failures can be retried, and stale
preparation is cancelled. Loading or failed image preparation retains the last valid preview;
a Retry action recovers after a missing asset arrives. Runtime requests remain blocked: the
sandbox receives raster data URLs, never editor blob URLs or external image addresses. A version
handshake rejects outdated runtimes before sending the projection. SVG
image boxes preserve intrinsic aspect ratios, transforms, opacity, draw order and visibility.
Default outlines now share a design token with the canvas; text uses the same fallback font
and native SVG default fill. Coverage includes resource validation/cache/cancellation and real
browser decoding, geometry/style parity, missing-image recovery and normal/narrow visual checks.
Diagram connector links remain absent, as in the current canvas; this does not introduce them.

#### Increments: R4.1–R4.10 implemented for supported consumers

Do these in order. Each numbered increment is independently usable and reviewable; do not merge
an intermediate format that the editor cannot open and edit. Test filenames below record
acceptance coverage for the delivered increments. The existing Preview continues working through
adapters to the shared screen/context projection alongside the standalone Prototype player.

1. **R4.1 — Explicit screen identity (implemented).**
   A frame explicitly declares Frame or Screen in Inspector. Its existing ID is the stable
   navigation destination; its name, viewport, artwork, canvas position and selection remain
   on the existing frame record. Draw with the Frame tool, then choose Screen to designate it.
   Multiple screens, ordinary frames and loose artwork remain on one shared canvas. Explorer
   badges use this designation, not inferred top-level membership. Only visible screens on
   Canvas are prototype destinations; nested screens retain their identity and explain how to
   make them available. Demoting or deleting a target preserves authored navigation references
   with a diagnostic. Schema v12 and shared-update migration designate legacy roots as screens
   and nested frames as ordinary frames without moving artwork or remapping IDs. New frames
   default to ordinary frames. Readers, operations, clipboard, collaboration and undo preserve
   the designation; thumbnails and the viewer continue drawing the same frame content.
   **Acceptance:** `tests/screenDefinitions.test.ts` and `tests/browser/screenDefinitions.spec.ts`:
   migration, conversion, save/reload, copy, local undo, concurrent deletion, explicit identity,
   multiple screens on the canvas and existing Preview navigation.
   **Scope refinement:** separate screen definitions, view records and screen-local transforms
   move to R4.2, where multiple placements of one screen first require that distinction.

2. **R4.2 — Multiple editable canvas views (M).**
   Extract screen definitions from the explicit screen frames, retaining destination IDs and
   visible geometry. Create an initial Screen view and screen-local transforms; every placement
   is an equal Screen view, with no primary, secondary or default designation. Distinguish
   Delete view from Delete screen, with a way to reveal a screen with no remaining views.
   Add Create view of screen, independent placement and viewport size, and Edit screen versus
   Edit view controls. Display, for example, Home at 390 and 1440 pixels beside Checkout. Reuse
   the same canvas and camera for all views and ordinary frames; never replace the canvas with
   a single active screen. Additional views of the same screen are optional. Reuse
   one definition and resolve existing layout separately per view. Content edits through either
   Home view update both; view resizing does not resize the source or the other view. Explorer
   identifies the screen reference and viewport; selection/gestures address the projected path.
   Keep source editing reachable when a projection is invalid. Bound projected-node counts
   across views and measure against the existing projection budget without raising it.
   **Acceptance:** `tests/screenViews.test.ts` and `tests/browser/screenViews.spec.ts`: two views
   with distinct geometry, hit tests, selection, cancel, view-only resizing, edit propagation,
   copy/delete semantics, reload, undo and two collaborators using different local selections.
   **Implemented:** Screen definitions retain stable destination IDs and shared artwork, while
   every canvas placement is a separate, equal Screen view. A frame converted to a screen
   receives an initial view. Migration extracts earlier combined definitions/placements once,
   preserving geometry and references. Every view has its own label, position, viewport,
   visibility and lock state. Labels combine the screen and view names, such as **Home · Mobile**
   and **Home · Desktop**; renaming the screen updates every label. Delete any view, including
   the initially created one, without deleting the screen or other views. Delete all views and
   the screen remains in Explorer's Screens list for placement again; reload and sync do not
   recreate a deleted view. Canvas/Objects shows the shared contents beneath each view;
   definitions remain in Screens. Drawing creates source artwork, dragging free artwork edits
   that source, and stack-managed artwork retains its layout rules. Hit tests, group boxes,
   marquee selection and snapping use the pressed view's resolved geometry. Cancellation,
   shared undo, concurrent edits, text placement, cloning, thumbnails and the viewer are covered.
   Projection across placed views stays bounded to 5,000 nodes. Tests:
   `tests/equalScreenViews.test.ts`, `tests/screenViewGestures.test.ts` and browser counterparts.
   **Shape handles implemented:** free shapes expose the existing resize/rotate handles inside
   every editable Screen view. Pointer positions translate back to shared source geometry;
   snapping stays in view coordinates. Locked and stack-managed shapes remain selectable without
   transform handles. Cancellation, remote edits and shared undo are covered by
   `tests/screenViewHandles.test.ts` and `tests/browser/screenViewHandles.spec.ts`.
   **Selection overlays implemented:** selection menus and instance badges anchor to the active
   Screen view, including Explorer selection. Existing menu commands edit shared artwork; Alt
   distances compare shapes only within that view, resize snapping uses placed bounds, and
   dimension labels show the resolved size in each view.
   Overlays follow viewport/camera changes and disappear for unavailable views or mixed
   selections. `tests/screenViewOverlays.test.ts` and its browser counterpart cover these paths.
   **Container handles implemented:** selected groups and local component containers expose one
   proportional resize/rotate handle set in each editable view. Gestures edit shared source
   artwork, including hidden members, and retain snapping, cancellation and shared undo.
   Locked, mixed-screen and stack-positioned containers have no transform handles. Instances
   retain their existing rotation-only controls. `tests/screenViewContainerHandles.test.ts` and
   its browser counterpart cover transforms, viewport geometry and concurrent changes.
   **Focused editing implemented:** placed component containers retain their Screen view while
   their children are selected, transformed or drawn. Opening the source of an instance
   projects master children at that instance's placement, without reparenting masters.
   Other views remain visible. Back/Escape restores the original view, selection and camera;
   Explorer child selection preserves focus. Unplaced or over-budget
   instance contexts retain the standalone source editor and their return context. Focus and
   pinned source origins stay local, and expanded projections retain the 5,000-node budget.
   Covered by `tests/screenViewComponentEditing.test.ts` and its browser counterpart.
   **Contextual clipboard and core keyboard editing implemented:** Copy/Cut capture the active
   view's resolved artwork. Paste uses that view's press location or center, translates into
   source coordinates and assigns Screen membership. Duplicate and paste retain focused
   component membership and return context; a focused paste is one shared undo step, including
   membership. Recursive component pastes are rejected before writes. Arrow keys respect both
   source and viewport stack placement, and stale views cannot paste, duplicate or nudge.
   Covered by `tests/screenViewKeyboard.test.ts` and keyboard scenarios in
   `tests/browser/screenViewComponentEditing.spec.ts`, including narrow layouts.
   **Contextual alignment/spacing implemented:** Inspector, context-menu and shortcut commands
   share cached local eligibility and displayed bounds for the active Screen view. Alignment,
   equal gaps and equal center distances translate those bounds into shared source edits.
   Groups and local component containers move whole, including hidden members; focused master
   children remain individually editable. Mixed-context selections and unavailable views cannot
   align; source and viewport stack restrictions apply to every container member. Covered by
   `tests/screenViewAlignment.test.ts` and `tests/browser/screenViewAlignment.spec.ts`, including
   shared undo, remote edits and narrow layouts. Canvas behavior and existing shortcuts remain.
   **Transformed instance focus implemented:** source-only masters can be edited in place through
   rotated and stack-positioned instances at each view's viewport. A shared inverse transform
   maps dragging, handles, drawing, clipboard placement, nudging and alignment back to authored
   geometry. Source origins, rotation pivots and the instance's layout footprint stay local and
   pinned during focus; leaving resumes normal stack reflow. External placement/rotation changes
   cancel active gestures safely. Coverage: `tests/screenViewTransformedFocus.test.ts` and the
   component-editing browser tests, including arbitrary angles, narrow views and shared undo.
   All views have the same supported interactions throughout these increments.

3. **R4.3 — Inherited color modes per view (M, implemented).**
   Extend the central resolver with the precedence above. Add Inherit/reset controls for
   screens, views, frames and component instances, and show effective values and their source.
   Existing local document mode controls remain simulation choices. Authoring a view's mode
   override is a distinct, undoable operation. Dimensions remain opt-in: no built-in Theme or
   forced Light/Dark pair. Show two Home views in different modes at once, including nested
   component colors. Feed the same resolved context to the existing Preview when launched.
   **Acceptance:** `tests/inheritedModes.test.ts` and `tests/browser/inheritedModes.spec.ts`:
   partial inheritance across multiple dimensions, aliases, local vs authored changes,
   ancestor updates, reset, missing modes, packages/copy, undo/concurrent edits, canvas/runtime
   color parity and zero writes caused merely by resolving a view.
   **Implemented:** schema v15 retains per-dimension overrides on Screens, views, frames and
   instances. Inspector shows effective choices and sources, with Inherit/reset and recovery
   from missing references. Defaults come from authored dimension definitions; local document
   simulation remains a separate, local layer. Canvas, focused masters, nested instances and
   thumbnails resolve each view independently. Authored choices form distinct shared undo
   steps; concurrent edits to different dimensions merge. Copy/clone, operations, native token
   definitions and reload preserve modes. Preview launched from a view captures its effective
   screen-root modes and initial screen, while descendant overrides remain live; manual launch
   inherits screen defaults. Resolution never rewrites shared colors or geometry. Library copy
   and fingerprint helpers load with the editor to preserve the existing bundle budgets.
   Numeric/text values and contextual geometry remain R4.4.

4. **R4.4 — Geometry-aware mode values (implemented for supported consumers).**
   Complete the unfinished V3 numeric/text work in supported consumers: spacing and dimensions,
   then typography/templates with contextual measurement. Keep unsupported bindings disabled
   with an explanation until their renderer, bounds and hit testing agree. Reuse sizing-cycle
   diagnostics; share measured results across drawing and interaction for each context.
   **Acceptance:** extend `tests/inheritedModes.test.ts`, add `tests/contextualLayout.test.ts`
   and `tests/browser/contextualLayout.spec.ts`: Compact/Comfortable views, text wrapping,
   correct selection/hit tests and gestures, nested stacks, deterministic fallback, runtime
   parity and convergence with no shared derived-value writes.

   **R4.4a — Numeric layout inputs (implemented).** Schema v16 adds number mode values and
   numeric variable bindings for frame width/height and stack gap/padding. Variables offers
   numeric mode authoring; Inspector's Layout variables binds frame inputs. Screen views,
   hit tests, overlays, thumbnails and Preview use one numeric projection before existing
   stack sizing. Fixed rectangle dimensions follow numeric bindings, including aliases;
   nested stacks, hug/fill and min/max constraints reuse existing cycle diagnostics.
   Each view retains its own viewport. Preview snapshots the launched view's viewport and
   modes; descendant overrides still apply. Definitions, frame references, copy/clone,
   packages, operations, sync and undo retain authored inputs. Invalid numeric layout values
   keep their authored fallback with a diagnostic. Projected values never become shared data.
   Numeric layouts avoid retaining a stale marquee projection when mode values change.
   Standalone Canvas artwork retains base geometry; contextual numeric geometry is opt-in
   through Screen views and Preview. Unsupported shape properties and component-source
   geometry use base values; the UI explains the supported scope and disables incompatible
   new bindings. Text/boolean modes remain unavailable. Coverage: `contextualLayout.test.ts`
   and its browser counterpart, alongside existing inherited-mode/sizing tests.

   **R4.4b — Contextual measurement (implemented).** Schema v17 adds text mode values and
   optional text wrap width. Shared local projections resolve nested component geometry,
   font size, text templates and exposed instance overrides before measuring and laying out.
   Bounded measurement caches include instance path, modes, content, typography and available
   width. Screen views, standalone Canvas, focused source editing, selection/hit testing,
   thumbnails and the Preview drawing consume the same geometry. Text wraps at an explicit
   maximum and the frame's available width; Hug-width parents use the explicit limit to avoid
   a circular dependency. Fill-width/Hug-height stacks reflow after width resolution.
   Clipboard, packages, operations, persistence, collaboration and undo retain authored inputs;
   measurements and projected sources remain local. Component property editing loads with the
   editor, preserving startup/file budgets. Unsupported position/rotation/image-size and boolean
   mode bindings remain gated. SVG export now consumes the shared projection in R4 delivery.
   Coverage: `contextualMeasurement.test.ts` and its browser counterpart, with existing
   contextual-layout, variable, component, clipboard and Preview suites.

5. **R4.5 — Manual component variants (M, implemented).**
   **R4.5a — Manual selection (implemented).** A component can link an existing,
   independently editable component as an alternate when their exposed property IDs and
   types match. Inspector selects the alternate for an instance; an absent selection uses
   the default. A missing alternate retains the authored selection and renders the default.
   Variant identity is saved with the instance, and source snapshots carry the linked
   components. Source authoring, diagnostics, mapping repair and library lifecycle coverage
   follow in R4.5b–e below.

   **R4.5b — Create an editable variant (implemented).** Inspector's Create variant copies
   the default's authored artwork into a new source-only component and links it to the family.
   Shapes and complete source groups get independent identities; exposed properties keep their
   IDs while targeting the copied shapes. Bindings, text templates, nested component references,
   instance mode overrides and role settings are retained. The new source opens for renaming
   and editing, with a path back to the family and Edit actions for its alternates. Existing
   instances keep their selection and overrides. Creation is a separate undo step and shares
   through the existing document model; library sources, locked sources and alternates cannot
   create a nested family. Tests cover independent edits, switching with overrides, names,
   permissions, snapshots, reload, collaboration and undo. Diagnostics, mapping repair and
   concurrent library updates follow in R4.5c–e; automatic width-based selection remains R4.6.

   **R4.5c — Compatibility diagnostics (implemented).** Family, alternate and instance
   Inspectors name missing shared properties, changed field mappings, unusable targets,
   extra unshared fields, role/action drift and invalid family links. The link picker and
   action use the same compatibility checks, comparing semantic role links independently
   of object key order. Unavailable saved choices remain visibly distinct from the default.
   Diagnostics are read-only; compatible instance values survive alternate property removal,
   switching, reload and concurrent edits/undo. Property-mapping repair is covered by R4.5d below.

   **R4.5d — Explicit property mapping repair (implemented).** Each exposed property in the
   source Inspector names its target shape and field. An alternate lists missing shared
   properties too, so an author can reconnect them to a compatible field without removing
   and recreating their IDs. The same picker can repair a default source's stale target.
   Field kinds/keys stay fixed; another exposed property's target cannot be claimed.
   Read-only/library sources and ambiguous family membership block edits. Each repair is
   one undo step; source artwork, instance overrides/bindings, variant choices and role links
   stay unchanged. Tests cover switching, save/reload, concurrent instance edits with local
   undo/redo, and library updates carrying the repaired mapping into existing instances.
   Inspector controls are checked at normal and narrow widths.

   **R4.5e — Library lifecycle acceptance (implemented).** Compatible updates replace artwork
   under stable IDs and retain instance choices, values, bindings and authored actions, including
   nested instances. Removed/unlinked variants fall back to the default while keeping the saved
   choice and explaining its unavailability. A replacement with a new ID is offered for explicit
   selection; the same ID returning restores the saved choice. Published family snapshots omit
   missing upstream alternates so an old cached source cannot accidentally rejoin the family;
   cached sources remain available to independent instances. A missing family, an update with
   empty source artwork, or an unavailable/trashed library leaves the last usable snapshot intact. Removed/incompatible property values
   remain stored through updates, reload, collaboration and paste, with diagnostics and safe
   source-value fallback until compatible properties return. Library updates validate their
   complete dependency set and apply as one undo step, preserving concurrent instance edits.
   Imported source-only components can be inspected to apply updates. Acceptance:
   `tests/variantLibrary.test.ts` and `tests/browser/variantLibrary.spec.ts` cover replacements,
   removals, restored IDs, nested instances, read-only guards, dependency collisions, library
   disappearance, reload, clipboard, undo/redo and narrow-width diagnostics.

   Add a bounded variant family to reusable components, with a default and explicit instance
   selection. A family is one level deep: a default plus any number of alternates, which cannot
   have alternates of their own. Variant trees share stable exposed
   property IDs and compatible role/action targets; changing variants retains text, bindings,
   compatible overrides and authored actions. Report incompatible or removed properties instead
   of silently discarding user values. Define retained values and fallback when a selected
   variant disappears. Existing components behave as a one-variant family. Support library
   snapshots, update/import, operations, clipboard, collaboration and undo together.
   **Acceptance:** `tests/componentVariants.test.ts` and `tests/browser/componentVariants.spec.ts`:
   manual switch and return, shared property edits, nested instances, library updates, missing
   variants, incompatibility diagnostics, reload, concurrent edits and undo.

6. **R4.6 — Automatic responsive component variants (implemented).**
   Families author inclusive minimum-width rules in Inspector, using Screen view width or
   layout-parent inner width (after padding). Instances opt into **Auto — follow width**;
   existing and explicit default/alternate choices stay fixed. The highest matching threshold
   wins, with the family default below all thresholds. Theme and other mode dimensions remain
   independent. Each Screen view and local Preview viewport resolves its own geometry, text and
   variant without saving a new instance choice, value or action. Inspector explains the winning
   rule and measured width. Duplicate/invalid thresholds are rejected before saving.
   Missing/unlinked variants and missing/cyclic artwork retain authored rules and fall back to
   the default with diagnostics. Parent Hug, including a Fill chain to Hug, uses the default
   until the parent has an independent width or the rule uses Screen view width. Nested
   instances inherit the Screen width; their component parent's intrinsic artwork width is
   not an independent selecting width, so Parent selection also reports a repairable fallback.
   Schema v20 persists rules and opt-in selection through reload, clipboard, library snapshots,
   collaboration and undo. Rules change in a separate undo batch; instance values are retained.
   Rule evaluation loads with contextual layout, not startup. Alternate screen trees remain R4.7.
   **Acceptance:** `tests/responsiveVariants.test.ts` and `tests/browser/responsiveVariants.spec.ts`:
   exact thresholds, greatest-match/default fallback, narrow/wide parents, padding and Fill,
   two Screen views, fixed vs Auto, preserved content/actions, nested instances, stable cycle
   fallback, persistence/library fingerprints, invalid rules, concurrent values and rule undo,
   Inspector explanations, narrow controls, canvas/Preview parity and local viewport isolation.

7. **R4.7 — Optional responsive screen layouts (M).**
   Keep continuous frame/stack reflow as the default. Add explicit alternate layout trees only
   when needed, selected by screen viewport width with the same deterministic threshold rules.
   A screen retains one destination ID across layouts. Shared content uses reusable component
   instances/property bindings; authoring explains which edits belong only to the active layout.
   Compatible control/property identities must preserve prototype inputs/actions across layout
   changes; incompatible state receives a documented reset. Allow a local layout inspection
   override so every layout stays editable, including an otherwise unreachable one.
   **Acceptance:** `tests/screenLayouts.test.ts` and `tests/browser/screenLayouts.spec.ts`: same
   Home destination at multiple widths, layout-specific edits, shared component updates,
   missing layouts, rule boundaries, navigation targets, state continuity and undo/reload.

   **R4.7a — Alternate layouts and manual selection (implemented).** Existing screen artwork
   remains the default. A Screen view's Inspector creates a named empty layout and chooses
   which tree that view edits. Alternate layout roots are ordinary frames owned by the same
   screen; they never become navigation destinations or slots in its default stack. Canvas
   drawing, transforms, component focus and Explorer use the chosen tree. Preview snapshots
   the launch view's layout and viewport while retaining the screen's destination ID. Reusable
   components share definitions; instance values and layout-specific artwork remain separate.
   Choices and roots survive schema v21, collaboration, undo and reload. Missing choices retain
   their references and show the default with a diagnostic. Deleting a layout boundary releases
   its artwork to Canvas, as with frames, and keeps the screen and views. The Inspector's
   Edit layout settings opens its name and stack controls; sizing follows each view.
   **Acceptance:** `tests/screenLayouts.test.ts` and `tests/browser/screenLayouts.spec.ts` cover
   default/alternate isolation, stack reflow, drawing, Preview, shared components, stale choices,
   deletion, locking, atomic undo, collaboration, reload, inactive-layout diagnostic isolation,
   missing-layout Preview warnings, promotion of released layouts and narrow-width controls.

   **R4.7b — Automatic selection and prototype continuity (implemented).** Schema v22 adds
   opt-in screen minimum-width rules and Auto on each Screen view. Greatest inclusive threshold
   wins; explicit choices (including Default) are preserved. Missing targets fall back with a
   diagnostic, and duplicate thresholds resolve deterministically with an unreachable-rule
   warning. Rendering, Explorer, drawing and focused editing use the same selected tree.
   Preview has local Width and per-screen Layout controls, including Default; width applies
   across navigation while destination height constraints remain active and inspection choices
   stay local until Preview closes. Automatic modes follow the new width; explicit/manual
   launch modes remain fixed. Explicit Input
   identities share typed state only within one logical screen and the same component family
   and exposed text Value property. Duplicate, missing or incompatible inputs reset; button
   destinations remain authored. Authored values, geometry and modes are never rewritten.
   **Acceptance:** `tests/automaticScreenLayouts.test.ts` and its browser counterpart cover
   exact thresholds, legacy/manual preservation, editing, missing/duplicate rules, local
   inspection, navigation, compatible/incompatible input continuity, cloning, undo, sync and
   reload. Runtime protocol v3 validates layout inspection and input state metadata.

8. **R4.8 — Explicit interactions independent of roles (M, implemented).**
   Provide a small Inspector editor for a control's Activate trigger and Navigate action with a
   screen-ID target. Preserve existing Button navigation through a tested conversion/adapter;
   do not introduce an arbitrary expression engine. Role semantics, visual variants and action
   targets stay separate. Source actions may be inherited or explicitly overridden by instances.
   Canvas clicks always select/edit and never execute actions. The existing invoked Preview
   executes the same action definitions, so this increment is usable without a Flow feature.
   **Delivered:** schema v23 adds typed Activate → Navigate metadata to sources and instances.
   The Inspector offers From source, No action and named screen destinations independently of
   Role. Legacy whole-role navigation overrides are initialized on creation/load and in shared
   document migration before role edits, preserving concurrent explicit action changes. Missing
   targets remain authored and show diagnostics. Preview uses native keyboard controls (Enter for inputs); library transfers
   strip document-local targets and remain editor-loaded within the existing bundle budgets.
   **Acceptance:** `tests/screenInteractions.test.ts` and `tests/browser/screenInteractions.spec.ts`:
   role without action, inherited/custom actions, renamed/deleted targets, variant/layout
   continuity, atomic operations, undo, concurrent edits and no canvas-side execution.

9. **R4.9 — Separately invoked Flow view (complete).**
   Open flow on the application bar or command line opens lazy `/flow`. All canvas views of
   Home map to one Home node. Select a component control and connect a destination, or use
   the shared Interactions editor to remove its action or restore source inheritance. Authored
   alternate layouts and nested variant controls are included; shared source edits are labeled.
   Missing/hidden targets and reachability from a chosen screen are diagnostics only. Drag or
   arrow-key arrange screen nodes; optional device-local offsets are saved separately from the
   document, canvas positions and prototype state. Opening Flow never starts Preview.
   **Verification:** `tests/flowProjection.test.ts` and `tests/browser/flows.spec.ts` cover one
   node per definition, Flow/Inspector round trips, missing targets, diagram-only movement,
   undo/collaboration, local arrangement and lazy loading without prototype execution.

10. **R4.10 — Contextual Prototype player (complete).**
    Open prototype on the application bar, command line or Flow opens lazy `/prototype`.
    Select a start screen, viewport width/height and any opt-in dimension's mode. A selected
    canvas view seeds the initial context; direct launches follow screen defaults. Navigation
    carries the session viewport and mode choices to every destination, resolving responsive
    layouts and component variants while preserving explicit layout/variant choices and
    compatible input identities. Reset restarts at the chosen start screen and clears inputs
    and temporary layout inspection; close ends the session. Context and inputs stay local,
    independent of canvas configuration and other players. The compact Preview remains available.
    The player reuses the opaque sandbox, validated protocol, image limits, cancellation and
    last-valid projection behavior. Projection diagnostics link to the relevant authored shape
    or frame in Inspector. Unavailable start screens remain visible for an explicit new choice.
    **Verification:** `tests/preview.test.ts`, existing compact Preview tests and
    `tests/browser/responsivePrototype.spec.ts` cover launching from a view, reset/close,
    multi-screen width/height/mode navigation, keyboard-native controls, explicit and automatic
    variants/layouts, compatible inputs, independent sessions, live invalid/valid edits,
    diagnostic selection, unchanged canvas settings and lazy feature loading.

#### R4 delivery after the responsive foundation

- **Read-only prototype links (complete).** From Prototype, workspace admins publish a
  validated snapshot with the chosen start screen, viewport and resolved modes, layouts and
  component variants. Recipients play on the separate preview domain without signing in;
  navigation and reset use local input state. Later canvas edits do not change the snapshot.
  Links expire after 30 days and admins can revoke future loads. Verified raster images are
  embedded; only token hashes are stored. Limits: 20 active links per document and 64 MiB per
  workspace. Server and browser `prototypeLinks` tests cover access, validation, chosen context,
  snapshot independence, expiry, revocation and the public page's restricted network policy.
- **SVG export (complete).** Export SVG on the command bar or command line
  downloads the selected Screen view, root Screen (as authored) or selected visible artwork.
  Export uses Canvas projections
  for inherited modes, responsive/explicit layouts and component variants, and shares the
  primitive artwork projection with Preview. Views retain viewport bounds; selections use
  rotated artwork bounds with stroke padding. Raster assets are verified and embedded (8 MiB
  of decoded images, as in Preview; 32 MiB of SVG output); controls,
  guides and editor overlays are omitted. Invalid geometry or missing assets fail with an error.
  `tests/screenExport.test.ts` and `tests/browser/screenExport.spec.ts` cover resolved context,
  deterministic safe SVG, standalone rendering and embedded-image downloads.
- **Starter templates (complete).** Documents → Templates creates an independent, editable
  list/detail, forms, sign-in or settings starter. Each includes three equal Screen views,
  reusable button/input components, explicit navigation and an actionable empty state.
  Prototype runs local input and navigation only: no data submission, email or authentication
  is implied. Dimensions and modes remain opt-in. Persistence, independent IDs and playable
  journeys are covered by `starterTemplates` unit and browser tests.
- **AI screen/layout operations (complete).** Provider-neutral `addFrame` and `updateFrame`
  tools create screens, equal Screen views and alternate layouts, attach artwork and author
  width-based layout rules. Selected frames/views provide bounded source context. Proposals
  remain unapplied until Accept; validation rejects invalid ownership, references and thresholds,
  and acceptance stays one collaborative undo step. Explicit layouts and Theme stay independent.
  Offline reference evaluation covers both adapters; browser coverage checks acceptance, resolved
  artwork, undo/redo and reload. A template-based screenshot benchmark now renders 30
  correlated references (12 starter screens,
  12 palette variants and six copy variants), runs live provider proposals through acceptance,
  and saves paired images, raw provider events and two-reviewer rating sheets. Screenshot
  creation can now group a complete screen and its artwork in one tool call, expanded into
  validated operations before acceptance; detached legacy proposals receive a repair diagnostic.
  The latest local Qwen rerun uses ordered screen composition with measured text layout,
  labeled role-checked controls and palette bindings. The reliability follow-up separates
  button/input schemas, requires complete screen repairs and renders dedicated footers once:
  30/30 nonblank exports and first-attempt passes, 52/52 correctly reused controls and 34.4 s
  completion p95. Repeated text now fails the benchmark; the preceding run's reported 26/30
  rescored to 13/30 under that stricter check. The four prior failures and duplicated footers
  are resolved in this run. Spacing, typography and footer placement still differ from references,
  and human usability ratings are unfilled; see
  `tests/ai/screenshots/RESULTS.md`. This supports evaluation; it does not
  establish general screenshot quality or replace human ratings. Screenshot-generation targets
  remain: 80% of 30 screenshots rated a usable
  start by two reviewers; 70% component reuse when suitable definitions exist; colors within
  ΔE 2 bound to matching variables; completion within 20 s at p95. Measure these, do not infer
  quality from deterministic replay tests.

## R5.1 Entities, fields and sample records

_Recorded 2026-11-04._

R5.1 implementation: Data View now edits named entities, stable-ID Text/Number/Boolean
fields (optionally required), and sample records. Field renames retain values; type/required
changes keep incompatible data and report diagnostics. Each explicit Save/add/delete is
one undo transaction, with concurrent field and cell edits shared through existing document
collaboration. Schema v24 reads older documents with empty data collections. The editor is
lazy-loaded; runtime list/form bindings and expression validation remain steps 2–3.
Verification: `tests/data.test.ts` and `tests/browser/dataForms.spec.ts`.

## R5.1b Choice and reference fields and the record limit

_Recorded 2026-11-16._

Schema v32. Fields can be **choice** (`options`: 1–100 distinct trimmed strings) or
**reference** (`targetEntityId`); values are the option or a record ID. Both settings stay on
the field when its type changes, so changing it back loses nothing. Values are checked when
written; options edits, deleted records and deleted target entities leave values in place and
show in diagnostics. An entity can name its records by one of its text fields
(`labelFieldId`, Data View's "Name records by"); without one the first text field is used, and
a blank name falls back to "Entity N". Data View offers options and target entity when adding
or editing a field, and the record cells become selects that keep an unavailable value marked.
Repeated lists and record details show a choice as its option and a reference as its record's
name in text properties. Prototype record forms offer the same selects. Adding a record past
1,000 in one entity is refused; more from concurrent adds is reported. The action and
expression vocabulary for state, forms and workflows was decided in the plan without code.
Verification: `tests/dataChoices.test.ts` and `tests/browser/dataForms.spec.ts`.

## R5.2a Lists bound to entities

_Recorded 2026-11-04._

R5.2a implementation: a selected component instance can repeat over an entity's sample
records in Prototype. Inspector maps stable field IDs to compatible exposed property IDs
and sets the vertical item gap; the component is the item template. Repeated items retain
modes, responsive/explicit variants and independent input state keyed by record identity.
Empty lists have an empty state; invalid bindings produce diagnostics without rewriting data.
Bindings persist and support undo, collaboration, copy and clone. Library snapshots omit
document-local bindings. Canvas and SVG export still show the authored template; repeated
rows do not reflow surrounding stack siblings or scroll inside a list viewport in this increment.

## Interactive visualization increments

_Recorded 2026-11-05._

1. **Interactive component variants (implemented).** An ordinary instance on a Screen can
   activate a named variant of another ordinary instance in that same screen layout, including itself.
   Inspector → Interactions lists targets and their variants. The choice is local to each Preview,
   Prototype or shared-link session; Reset and a new session restore the authored/responsive
   initial choice. Compatible instance overrides and inherited modes are resolved into each
   alternative. No interaction writes document state or creates undo history. Authored action
   edits use the existing guarded editor, persistence and collaboration path.

   **Working example:** Documents → Templates → **Inspector typography** → Open prototype.
   Four editable component variants compare sentence/medium, sentence/regular, title/semibold
   and uppercase/semibold headings. Buttons switch the same Inspector artwork and indicate the
   selected style. Text shapes now carry an optional weight, shared by canvas, measurement,
   preview and SVG export; missing weight retains the existing regular default.

   Scope: ordinary screen instances, with artwork replaced at the existing position. Repeated
   data-list items, nested source targets, cross-screen targets and surrounding stack reflow are
   not supported in this increment. Referenced alternatives are preprojected and validated under existing
   preview size/node/resource limits; no executable document code enters the player. SVG export
   remains the authored design. Existing shared snapshots remain readable.
   Verification: `tests/interactiveVariants.test.ts`, `tests/browser/interactiveVariants.spec.ts`
   cover persistence, invalid references, overrides, keyboard switching, session isolation and reset.
2. **Local boolean visibility (implemented first increment).** Ordinary instances have a
   “Show initially in prototype” checkbox; Interactions can toggle another instance in the same
   screen layout. Preview, Prototype and shared links keep independent session values. Reset
   restores authored defaults. Hidden controls leave keyboard navigation; their input values
   survive hiding and showing. Canvas and SVG export remain unchanged, and stacks do not reflow.
   The Inspector typography starter includes optional help. Persistence, copied targets, undo,
   collaboration, keyboard activation and session isolation are covered by prototypeVisibility
   unit/browser tests.

   **Named boolean state (implemented).** A document can define stable-ID named boolean
   values with authored initial values. Inspector creates, renames and deletes values, binds
   ordinary instances' visibility, and assigns toggle actions. Multiple instances and screens
   share a value within one player session; Reset restores defaults. Renames preserve bindings;
   missing state falls back to the instance default and reports a diagnostic. Existing local
   visibility toggles remain supported. Authored values use persistence, undo and collaboration;
   runtime values never write to the graph. Cross-document pasted references remain diagnostic
   until explicitly rebound; state definitions are not part of component-library packages.
   Tests: prototypeState unit/browser.

   **Explicit boolean actions and conditions (implemented).** Set true/false actions are
   idempotent; Toggle remains available. A visibility binding can show its instance when the
   state is true or false, allowing complementary views. Missing state keeps the existing
   instance fallback without inversion. Readers, Inspector, Flow, copies, undo and collaboration
   retain authored conditions. Runtime Reset and session isolation remain unchanged.
   Verification: prototypeState unit tests and prototypeBooleanActions browser tests.

## R5.2b Record details

_Recorded 2026-11-06._

R5.2b implementation: Inspector’s Data binding can show a repeated list or the selected
record. A repeated item’s existing navigation action carries stable entity/record identity;
destination component instances map compatible fields from that entity. Without a selected
record, authored component values remain visible. Runtime record selections and input edits
stay in the player session, survive ordinary navigation and compatible layout changes, and
clear on Restart or a new session. Record values are projected with modes and responsive
variants before entering the sandbox; shared links include bounded rendered alternatives,
never editable record tables. Deleted/stale fields retain the existing diagnostic fallback.
Canvas/SVG remain authored, and surrounding stacks do not reflow per record. Scrolling/list
layout and form mutations remain subsequent increments.
Verification: `tests/dataLists.test.ts`, `tests/recordDetails.test.ts`,
`tests/browser/dataLists.spec.ts`, `tests/browser/recordDetails.spec.ts`.

## R5.3a Record forms in the player

_Recorded 2026-11-06._

R5.3a implementation: editor-connected Preview and Prototype offer Edit record after
list-to-detail navigation. A generated form edits the entity’s Text/Number/Boolean fields,
validates required values and types atomically, and provides Save/Cancel. Saved records live
only in the mounted player; the existing resolver reprojects list/detail artwork with modes,
layouts, component variants and text measurement. Cancel/Escape discard drafts; Restart,
closing the player and reloading restore authored samples. Saves prepare and validate the
candidate preview before updating the session; record/schema changes while editing require
reopening the form. No document edit, undo entry, collaboration message or persistent save
is produced. Public links remain read-only snapshots without the host-side form editor.
Authored form controls/actions, expression rules and editable standalone/shared forms remain
later increments. Verification: `tests/recordForms.test.ts`, `tests/browser/recordForms.spec.ts`.

## R5.3b Validation rules as expressions

_Recorded 2026-11-16._

Schema v33 adds the `dataRules` collection: per entity, a rule holds a `check` condition, an
optional `when` condition, a message and optionally the field to show it at. Conditions are the
plan's typed JSON trees (`src/app/expressions.ts`): `equals`, `notEquals`, `less`, `greater`,
`contains` and `isSet` over a record field, a state value or a literal, combined with `and`,
`or` and `not`. The reader bounds a tree to depth 8 and 50 nodes. `conditionProblems` checks a
tree against what its place offers (form rules get the entity's fields and no state), so a
rule that compares a number with text, names a missing choice option or uses another entity's
field is refused when written. Any comparison with an unset value is false except `notEquals`;
`contains` ignores case. Data View has a Rules section: rows of field, comparison and value or
other field, matched by all or any, with an optional "Only when" group, message and target.
Shapes the editor can't show (from AI or JSON later) are listed and can be deleted, not
edited. Prototype record forms check rules after each field's own checks and refuse to save,
showing each message at its field or for the whole record; a shown message updates while
typing. Schema edits never rewrite rules: one that uses a deleted or retyped field is listed as
unable to run and never blocks a form. Sample records that break a rule are listed under Needs
attention and in their cell. Up to 50 rules per entity. Actions (`set`, `toggle`, `reset`) are
not built yet; they come with the next typed-state step.
Verification: `tests/dataRules.test.ts`, `tests/browser/dataForms.spec.ts` (authoring) and
`tests/browser/recordForms.spec.ts` (refused and saved forms).

## R5.4 Standalone web package

_Recorded 2026-11-16._

**Download** on the Prototype page saves one HTML file: the snapshot a shared link would hold
(start screen, viewport, modes, all screens, verified images as data URLs), written into a page
built from the preview runtime itself. `webpack.preview.mjs` now has a second configuration that
compiles `src/preview/runtime.ts` again with the Roboto fonts inlined and writes JavaScript and
CSS into `dist-preview/package.html` (about 120 KiB, budget 250 KiB). The page carries its own
Content-Security-Policy: the script allowed only by its build-time SHA-256, styles inline,
images and fonts from `data:`, and no `connect-src`, so it cannot make requests. The editor
fetches that page from the preview origin (CORS for the editor origin only; the editor's
`connect-src` now lists the preview origin) and inserts the snapshot as
`<script type="application/json" id="reactor-package">` with every `<` escaped
(`src/preview/standalonePackage.ts`). The runtime reads it with the same `readPreview` checks as
a shared link and plays it with the shared link's controls. One file rather than a zip: it opens
from disk, where a separate JSON file could not be fetched, and needs no zip writer. Record forms
are not in the package, as with shared links. Verification: `tests/standalonePackage.test.ts`
and the offline package test in `tests/browser/dataForms.spec.ts` (list to details, input kept
per record, Restart, font loaded, no requests, no console errors).

## R5.5 AI entities and records

_Recorded 2026-11-17._

Edit with words can make data. Two operations join the batch (`src/app/operations.ts`):
`addEntity` adds an entity with its fields (any of the five types; a reference names an entity
the document has, an earlier one of the batch, or itself), the text field that names its records
and its sample records; `addRecords` adds records to an entity the document has or the batch adds.
Field keys belong to their entity; entity and record keys are the batch's, and a reference value
may name a record key of the same or an earlier operation. `src/app/dataOperations.ts` stages them
inside `stageBatch`: names unique, choice fields with options, the 1,000-record limit, and every
record checked as a form checks it (field type, required, options, the referenced record exists,
and the entity's runnable rules), so a proposal with one bad value is refused, naming the record,
and goes back to the model through the existing single repair. An instance's `dataList` can be
set by `addShape` or `updateShape` (`null` removes it); in authored batches its entity and field
references may be keys and it is checked as Inspector checks it, while paste keeps copied lists
as they are. Accept applies it all as one undo step by the AI request, shared like any batch.
The model sees each entity's fields, runnable rules, record count and up to 50 record names
(`context.data`) and has `addEntity`, `addRecords` and `dataList` in its tools, with instructions
on choosing field types and making 20 records unless asked otherwise. Prompts take up to 20,000
characters, so CSV or JSON can be pasted. The chat describes the new operations
(`Add entity “Customers” with Name (text), … and 20 records`). Lists name fields by ID, so
renaming a field keeps its bindings. Verification: `tests/dataOperations.test.ts` and three
`data-*` eval cases in `tests/ai/cases/` (description, pasted CSV, references to existing
records) whose checks are the step's bar: at least 90% of field types right, every record valid,
the record count asked for and a bound list. Their rounds are hand-authored; no live run has
scored a model on them yet.

## Typed state and actions

_Recorded 2026-11-17._

Named prototype states now hold yes/no, text or number values (schema v34). Inspector →
Interactions → Prototype states adds a state with its type and edits its initial value; a state
keeps its type. One action, `{ type: 'state', change: 'set' | 'toggle' | 'reset' }`, replaces
`toggleState` and `setState`: Set takes a value of the state's type, Toggle only a yes/no state,
Reset returns it to its initial value. An instance's prototype visibility is a condition over state
values (`prototypeVisibleWhen`), from the decided vocabulary in `src/shared/conditions.ts`;
Inspector builds one comparison (is, is not, contains, is not empty for text; is, is not, less,
more for numbers; True/False for yes/no), and a condition from elsewhere is shown in words and can
be replaced. An exposed text property can show a state in Prototype (`stateBindings`), and an
input's Value property both shows and writes it, so a field typed into updates a greeting on the
same screen; the canvas keeps the authored text, and surrounding stacks don't reflow. Older
documents and shared links read into the new forms: a yes/no binding becomes `state equals
true/false`, and the preview protocol stays version 3 so links shared before still open. Flow
describes the new actions (“sets Tab to “Profile””, “resets Count”) and conditions, and counts a
screen reachable once some reachable control can make a hidden control's condition true. Paste
reuses a state of the same name and type and adds one of another type under its own name.
Runtime values stay in the player session; no action writes the document. Not yet: actions on a
field of the player's current record, arithmetic on numbers, binding properties other than text,
and actions in repeated list items. Verification: `tests/typedState.test.ts`,
`tests/prototypeState.test.ts` (including reading old documents and links) and
`tests/browser/typedState.spec.ts` (a shared link that sets, shows, types into and resets text
state; authoring a text state, a Set action and a condition in Inspector).

## S1 step 1: Version check on sync

_Recorded 2026-11-13._

Implementation status (2026-11-13): each copy that writes adds its `SCHEMA_VERSION` as a
key of the shared document's `versions` map (one key per version, so concurrent writes
never hide the newest). A copy that opens or receives a document with a higher key stops writing to it (edits, undo and migrations), shows the
read-only viewer with Reload, and keeps following others' changes. Covered by
`tests/versionCheck.test.ts` and `tests/browser/versionCheck.spec.ts`. The sync server removes keys
above the format it serves (and keys that are no format) on load and on every change, so a
rolled-back release or a bad client cannot lock documents; an outdated copy edits again
once the newer keys are gone. The editor names its format in the sync
socket's `editor` parameter; the server closes sockets from older editors (and builds
without the parameter) with code 4426 and the format it needs, and the editor stops
syncing and shows every document view only with Reload. Covered by
`tests/server/sync.test.ts` and `tests/server/editorSync.test.ts`. Step 1 is complete.

## S1 step 2: Document history and backups

_Recorded 2026-11-14._

Implementation status (2026-11-14): the server half is built. Saving a document whose last
snapshot is an hour old keeps the content saved before as a snapshot (`document_snapshots`);
the hourly cleanup keeps every snapshot for a day and each day's last for 30 days. Restore
applies as one change through the sync server, keeps what it replaced as a snapshot and
leaves the `versions` marks; deleting keeps the last content and images for 30 days, and an
admin restores it as a new document. `scripts/backup-database.sh` and
`scripts/restore-drill.sh`, with the first drill recorded in the README. Covered by
`tests/server/history.test.ts`. The editor's **Document history** command lists, draws and
restores versions; a restore marks the shared `restores` map, and every copy clears its undo
history when it arrives. Documents → Recently Deleted lists the deleted documents the server
keeps, for admins to restore. Covered by `tests/restoreUndo.test.ts`,
`tests/documentHistory.test.ts` and `tests/browser/documentHistory.spec.ts`. Step 2 is complete
but for the restore drill on the beta's database, which runs before the beta.

## S1 step 3: Presence

_Recorded 2026-11-14._

Implementation status (2026-11-14): each synced document's connection carries Yjs awareness.
The copy showing a document in the editor shares its pointer (canvas coordinates, while
over the canvas and the page is visible) and its selected shapes, at most every 50 ms
(`src/app/services/presence.ts`); other pages and documents share nothing. As the server
passes on no cleared states, leaving a document first shares an empty one. The server rewrites every state before
passing it on (`server/presence.ts`): who it is comes from the session, only a pointer of
numbers and up to 500 shape ids are kept, and client ids another connection holds are
refused, so nobody can show up as, or move, someone else. Viewers are present too. Signed
in, the canvas loads the presence layer on demand and draws each other person's pointer
with their name and their selected shapes' outlines in a color from their account; your
own other tabs are not shown. Covered by `tests/presence.test.ts`,
`tests/server/presence.test.ts`, `tests/server/editorSync.test.ts` and
`tests/browser/presence.spec.ts`. Not yet: selected frames and Screen views, a list of who
is in the document, and following someone's view. Step 3 is complete.

## S1 step 4: Workspace AI switch

_Recorded 2026-11-14._

Implementation status (2026-11-14): each workspace has `ai_enabled` (on by default), listed as
`ai` with the workspaces. Admins change it with `PUT /api/workspaces/:id/ai` from the AI card
on Sharing; editors and viewers are refused. The gateway refuses requests and repairs in a
workspace with AI off (`AI_OFF`, checked again under the workspace lock before a request is
counted). The editor keeps the switch with each document's access (`aiOff`) and, where it is
off, hides the Edit with words button, command, shortcut and the command line's AI entry
(`src/app/aiAccess.ts`); it learns a change when it next lists the workspaces, and a chat
left open says an admin turned AI off. The chat and the Sharing card say what a request
sends to the provider and what Reactor keeps (`src/ai/disclosure.ts`). Covered by
`tests/server/ai.test.ts`, `tests/aiAvailability.test.ts` and
`tests/browser/workspaceAi.spec.ts`. Step 4 is complete.

## S1 step 5: Move signed-out documents into an account

_Recorded 2026-11-15._

Implementation status (2026-11-15): signed in, the Documents page and the editor offer,
once per account, the documents this browser keeps signed out that have content and are
not in Recently Deleted (`src/ui/components/MoveDocuments`, loaded with the document
history's chunk). Move saves each in the account's copy in this browser with its images,
records it as made here so the server sync creates it in the personal workspace, removes
it from the signed-out documents, and has the editor catch up to open it
(`src/app/services/signedOutDocuments.ts`). A document whose state is over 4 MiB less
1 KiB, more than the server takes in its first sync, stays in this browser and is named
as too large. Keep in this browser leaves them, shown again signed out. Neither is offered
again; a document that failed to move is. Covered by `tests/signedOutDocuments.test.ts`
and `tests/browser/moveDocuments.spec.ts`. Not yet: a way to offer documents again after
Keep, and removing the signed-out copy's images no document uses any more. Step 5 is
complete.

## S1 step 6: Size warning

_Recorded 2026-11-15._

Implementation status (2026-11-15): the limits and measuring intervals are
`config.documentSize` (defaults in `src/app/services/documentSize.ts`), which holds the measure:
a document's whole state as another copy would receive it (content kept only for undo is
left out), a warning from 3 MiB and an upload limit of 4 MiB less 1 KiB, the server's
largest message (`MAX_MESSAGE`) less room for the document's id. The editor measures the
document it shows when it opens and while it changes, at most every 2 seconds (15 once it
is large, as leaving out undo content then costs about 150 ms), and from 3 MiB says how
large it is and that over the limit it cannot move into an account; the note
can be dismissed until the document grows another megabyte. The server sync no longer
sends what the server would refuse: a document too large for its first upload, or with a
change too large to send at once, is held back in this browser (before, the server closed
the socket every document shares, again on each reconnect), named in an error and in a
note in the editor, and sent once it is smaller. Covered by `tests/documentSize.test.ts`,
`tests/server/editorSync.test.ts` and `tests/browser/documentSize.spec.ts`. Not yet: a
note on the Documents page's card, and the server checking sizes itself. Step 6 is
complete.

## S1 step 7: Measures and signals

_Recorded 2026-11-15._

Implementation status (2026-11-15): sharing a prototype records the link in
`shared_prototypes` with its screens, kept after the link is revoked or expires; the `/share`
page sends a random id the preview site keeps, and the server counts distinct players and
opens per link in `prototype_players` under a hash of the link and that id. The server keeps
metrics in its process (`server/metrics.ts`): sync sockets, refusals and failed saves, AI
turns by outcome with time to first operation and to the end, AI refusals, prototype
publishes and opens, and browser errors. `GET /metrics` (Prometheus text) and
`GET /metrics/prototypes` (each shared link with screens, players and opens) answer only
with `METRICS_TOKEN`. The editor beacons errors nothing handled to `/api/client-errors`
(`src/app/services/errorReport.ts`, `config.errorReport`), which the server takes from its
own pages only, rate limits, logs and counts. Covered by `tests/server/metrics.test.ts` and
`tests/errorReport.test.ts`. Not yet: telling the sharer's own opens apart from others',
screens visited per player, the Preview-after-edit budget (a browser timing), and a
dashboard. Step 7 is complete.

## S1 step 8: Projection parity suite

_Recorded 2026-11-15._

Implementation status (2026-11-15): the suite draws each fixture's Views three ways: the
canvas's `ScreenViews` rendered to markup, Prototype's drawing launched from the View (as
the editor's Preview pane and as Play and shared links start it), and the SVG file Export
writes. It reduces each to the primitives a person sees, with every
transform applied (corners, centres, ends and text anchors in the screen's coordinates)
and the paint the canvas's CSS or the drawing's attributes give them
(`tests/support/projectionParity.ts`); any other attribute a primitive carries is compared
as it is. Fixtures: every primitive with rotation, opacity
and its own paint, nested rotated instances, wrapped text, an image, a hidden shape, a
frame with its own theme and a state-driven badge (`tests/support/parityArtwork.ts`);
theme and width modes; automatic and explicit screen layouts; stacks with Fill;
responsive variants; a repeated list and a selected record; and the five starter
templates. Export must equal the canvas exactly. Prototype at launch must equal it shape
by shape, except that instances hidden at start draw nothing; each variant a control
picks must draw as the canvas draws that variant chosen on the instance, each hidden
instance a control reveals as the canvas draws it, and each record as the canvas draws
the template with that record's values. Selected artwork outside Screens exports as the
canvas draws it. The suite runs with the unit tests on every pull request and push to
master. It found no differences in today's projection code. Not covered: images'
content (only their placement), the canvas's selection and hover styles, where a list
places its rows, and Preview's native fields drawn over inputs. Step 8 is complete.

## S1 step 9: First-run path

_Recorded 2026-11-16._

Implementation status (2026-11-16): until someone has started a document in this browser,
the editor's empty canvas offers the four journey starters (not Inspector typography, which
is about component variants) or a blank canvas; a drawing tool or content also counts as
starting (`src/ui/components/FirstRun`, `src/app/firstRun.ts`). A document started from a
starter, here or from Documents → Templates, gets a guide in the editor and Prototype:
change a text (in the Inspector, as text in Screen views is not edited on the canvas),
Play prototype, Share; each step is checked off as it happens. Signed out, Share offers
Sign in to share, and the moved document opens again after sign-in. The server records the
document's start the editor reports with each shared link (`shared_prototypes.started_at`)
and measures each person's time to their first link from the earlier of that and their
account's creation: `reactor_first_shared_link_seconds` and `GET /metrics/first-links`.
Covered by `tests/server/metrics.test.ts` and `tests/browser/firstRun.spec.ts`. Walked
end to end against PostgreSQL signed out, through sign-up and the move, to a link in
under a minute. Not yet: editing a Screen view's text on the canvas, and a fitted camera for
a document reopened after the move. Step 9 is complete.


## S1 step 10: Housekeeping

_Recorded 2026-11-16._

- **Startup bundle.** swc had no target, so it compiled `src` to ES5: spread, classes, `for…of`
  and async functions went through helpers and generators. Compiling to ES2022 (both webpack
  configs) took the entry bundle from 506.6 KiB to 401.4 KiB and all JavaScript from 1,960 KiB to
  1,369 KiB, with no source change. ES2022 is what the browsers already needed for
  `structuredClone`, and class fields keep the define semantics swc used before. The budget is
  now 410 KiB for the entry and 232 KiB per file (React DOM is 225.1 KiB).
- **Old schema readers stay at startup.** Measured with source maps, the code only old documents
  need (screen view extraction, showing v1–v2 containers, v12 screen designation) is about 3 KiB
  minified, and the whole-document reader around it also duplicates current documents, so moving
  it would make Duplicate wait for a download. Not worth it once the target was met.
- **Shared code.** `src/shared` holds what the server imports from the editor:
  `authenticationDestination.ts`, `schemaVersion.ts` and `previewProtocol.ts` (was
  `src/preview/protocol.ts`). The Dockerfile copies the folder whole, and
  `tests/server/sharedCode.test.ts` fails when server code imports anything else from `src`, or
  `src/shared` imports from the rest of `src`.
- **Nightly run.** `.github/workflows/nightly.yml` (02:40 UTC, or manually) runs the browser tests
  in WebKit (`BROWSERS=webkit`, a new switch in `playwright.config.ts`) and the server tests on a
  PostgreSQL 17 service. With `TEST_DATABASE_URL`, `tests/server/support.ts` makes one template
  database per test file and a copy per test, and drops them afterwards. All 179 server tests
  passed on PostgreSQL 16 locally; the WebKit job has not run yet.
- **Flaky tests.** `tests/browser/FLAKY.md` lists each known one with an owner and a fix date. In
  the full Chromium run on this change, 595 passed; the four failures (image drawing in
  `basicShapes`, `screenExport`, `colorEditor`, `contextualLayout`) also fail on master or pass
  alone.
- **This log.** Implementation paragraphs from R2, R4, the interactive visualization increments,
  S1 and R5 moved here; the plan keeps one line per built step with what is still open.

## Page text on the canvas

_Recorded 2026-11-18._ Priority 2 of the concept-model review.

- **What changed.** Double-clicking text where a page shows it opens the same field as for
  canvas text. `editingText` carries the view it was opened in (`viewId`), and the view draws the
  field over its own copy of the text (`src/ui/components/Shape/ShapeTextEditor.tsx`, shared with
  canvas shapes). `editTextAtPointer` uses the view's hit geometry, so the text found is the one
  drawn there, at that view's width.
- **Where the words land.** On the shape the view draws: the page's shared text, so every view of
  the page shows the change, or, in a view showing a separate design, that design's own text.
  No schema change.
- **When it is refused.** The same rules as other edits through a view: a locked, hidden or
  read-only view or page, a locked document, or another tool than Select. Text bound to a variable
  or a record follows the Inspector's Text field. Text inside component instances is still
  changed through the instance's props.

## S1 step 11: Vocabulary

_Recorded 2026-11-18._

Items 1 and 3 of the concept-model review: the words a designer meets first, before the
outside-user gate. No schema or preview protocol change; stored names (`kind: 'screen'`,
`kind: 'view'`, `screenLayout`, `responsiveLayouts`, `selection: 'width'`) and IDs are as before.

- **Words.** Screen is Page everywhere in the UI (Explorer "Pages", Inspector, Flow, Prototype,
  player, sharing, errors). A Screen view has no noun: its Inspector is headed by its name
  ("Home · Mobile") with "Show again on canvas", "Show at size…" and "Remove from canvas"; its
  fields are labelled "Shown name/x/y/width/height". Alternate layouts are "separate designs"
  next to the page's "main design"; "Layout" is left to Free/Row/Column. The width-selected
  dimension is offered as "Page width · Sizes". Data View is "Data". The glossary is in the plan
  and in the AI instructions (`server/aiTasks.ts`), which keep their data names.
- **No Page inside a frame.** The Type field is gone from nested frames, and `updateFrame` refuses
  `kind: 'screen'` on a frame with a parent. A nested Page from an older document is shown and
  treated as a frame, and becomes a Page again when it moves to Canvas.
- **A separate design starts as a copy** of the design the view shows (main or separate), without
  the page's other separate designs, through the frame clipboard (`writeClipboard`'s `leaveOut`).
  It is one undo step, as before.
- **One Sizes dimension.** `sizesDimension` is the first width-selected dimension by order; a
  later one resolves as manual. The Variables page disables "Page width · Sizes" while another
  dimension is Sizes; `updateDimension` and AI `setDimension` refuse a second.
- **Tests.** Unit tests for the copy, the nested refusal and the Sizes rule; tests that select by
  label updated (unit and browser).
- **Not in this step.** Sizes as a document
  concept and size overrides (items 4–8). "View only", "Card view" and "List view" stay: they are
  about access and lists, not pages. The AI eval cases replay recorded answers and still pass;
  their prompts were not re-recorded.

## Box model: margin, padding by side and borders

_Recorded 2026-11-18._

JT asked for a box model with padding, margin and border, Inspector editors and a highlight of
padding and margin on selection, with four visual directions first
(`/mnt/project-files/reviews/box-model/directions/`). Direction B, "Grab the space", is built.

- **Model (schema v35).** `margin` on shapes and frames, `StackRules.paddingSides`, `borderWidth`
  and `borderStyle` on stroked shapes. Padding stays a container's property: a plain shape has no
  content to pad, so padding is on stack frames, per side.
- **Layout.** Stacks place, hug, fill and report overflow with margins and per-side padding.
- **Canvas.** Selected items show margin and padding bands with values and grips; dragging a grip
  changes that side in whole units, rotated shapes included; Escape restores it.
- **Inspector.** Spacing (margin) for items in a stack, Padding by side on stack frames, a Border
  section with Stroke, Thickness and Style.
- **Budget.** The entry bundle budget goes from 410 to 412 KiB: layout, document reading and
  border drawing are needed as any document opens.
- **Tests.** `tests/boxModel.test.ts`, `tests/browser/boxModel.spec.ts`.
- **Not in this step.** Padding on text and instances (a label's box around its words), dragging
  a grip from zero (set a first value in the Inspector), Alt to mirror a side and Shift to snap.


## R6.1 Package parity

_Recorded 2026-11-19._

The projection parity suite (`tests/projectionParity.test.ts`) now plays the downloaded web
package too, so the canvas, Prototype, the package and SVG export are held to one meaning.

- **The real package.** For each fixture View, the suite builds the page as Download does, from
  the same code: `prototypeSession` (`src/app/modeEdits.ts`, now shared with the Prototype page)
  and `packageApplication` (`src/preview/standalonePackage.ts`, now shared with Download) write
  the snapshot into `src/preview/package.html`. It then opens the page in jsdom and runs
  `src/preview/runtime.ts` against it (`tests/support/packageProjection.ts`), choosing each
  screen with the page's own picker. jsdom is a new dev dependency.
- **What must match.** The start screen draws each shape as the canvas draws that View, except
  instances hidden at start. Every screen draws what the hosted Prototype draws for it, records
  included. Every other screen that has a View on the canvas draws as that View does once it is
  given the launch View's size and modes and Auto layout: the R4 mode resolver, width variants,
  automatic layouts and Fill have the same meaning after navigation in the file.
- **No editor-only context.** The page is identical, byte for byte, when every View is moved,
  the camera changes and the canvas shows other modes. A check that let the canvas's modes into
  the session failed this test.
- **Found.** No differences in today's projection or runtime.
- **Not covered.** As before, images' content, where a list places its rows and the native
  fields drawn over inputs. The Width and Layout a person inspects in Prototype still go into
  the file: that is the context they tested.

## R6.2 Design-system interchange

_Recorded 2026-11-20._

Copying a component from another document now brings the design system it uses, through the
same V4 package rules as Import, and the DTCG export says up front everything it cannot carry.

- **Library copies bring their tokens.** `src/app/libraryTokens.ts` collects what a copied
  source and its nested sources use (bindings, variable overrides, templates, instance mode
  overrides), with their aliases and dimensions, as a package named after the library
  document. Copy reuses matching local definitions (identity first, then name); the copy
  points its bindings and mode overrides at the local IDs. Before, copied sources kept the
  library's IDs, so they drew their stored colors and ignored the document's modes.
- **Updates follow the library.** A source's fingerprint now includes the definitions it uses,
  so changing a used token in the library offers Update; unused tokens don't. Components that
  use no tokens keep their old fingerprints. Update replaces only definitions that came from
  that library (`ImportPolicy` `update` in `src/app/designSystemPackages.ts`); a local
  definition that only shares a name is kept.
- **One step or none.** Tokens and sources are written as one shared undo step. If a token
  can't be brought (for example a local definition with the same name and another type), the
  copy or update is refused with the reason and nothing is written.
- **DTCG diagnostics.** `designTokenInterchangeProblems` lists every definition the subset
  can't carry: each dimension with its modes and how many variables would lose its values,
  text and yes/no variables, and names that aren't token paths. The Export dialog shows the
  list when DTCG is chosen and disables Export; the Reactor format stays available. The DTCG
  subset still exchanges no modes.
- **Tests.** `tests/libraryTokens.test.ts` (identity, modes, reuse, mode names, refusal without writes,
  update offer and replace, unchanged fingerprints, shared undo);
  `tests/designTokenInterchange.test.ts` and `tests/browser/designTokenInterchange.spec.ts`
  for the diagnostics.
- **Kept dimensions.** When an incoming dimension matches a local one that is kept, its
  modes follow the local modes by ID, then by name, for Import and library copies alike, and
  copied mode overrides follow too. A missing mode, or a different starting mode, refuses
  with the dimension and mode named.
- **Not yet.** Mode interchange through DTCG Resolver documents; tokens a reused local alias
  no longer needs are still added.

## R6.3 Accessibility check

_Recorded 2026-11-20._

The Prototype page checks every page for contrast, names and focus order in the modes and sizes a
person chooses, offers fixes the AI proposes and the person accepts, and the downloaded page can
be viewed and checked in the same contexts.

- **Contexts.** Prototype Settings has "Check and download in": modes of each dimension (the
  Sizes dimension follows the width) and the viewport presets. Each combination is drawn as
  Prototype draws it at that size, with its modes and Auto layouts (`contextSession` in
  `src/app/accessibilityCheck.ts`), at most `config.accessibility.maxContexts` (16).
- **The audit** (`src/preview/accessibilityAudit.ts`) reads the drawing the player gets, so the
  editor and the exported runtime check the same thing. Contrast: each text line against what is
  drawn below it, composited with opacity over the page, at three points along the line; text
  over an image (unless something opaque covers it), under a disabled control or in a native
  field isn't checked; a ratio is never rounded up to its threshold. What shows at start follows
  the start states, as the player decides it. WCAG AA thresholds
  are in `config.accessibility` (`src/preview/accessibilityRules.ts`). Names: buttons and inputs
  need one, and a button's name must include the words it shows (a layer name such as
  "Rectangle 7" fails). Focus order: Tab follows the drawing order; a control Tab reaches after
  one below or to its right is reported. Variants and instances hidden at start are checked for
  contrast and names too, against what is below them.
- **The dialog.** Accessibility on the Prototype page lists each problem once per page with the
  contexts it occurs in, a Show link to the shape, and the fix or advice. A text color is fixed
  where it comes from: a bound color changes its variable's value for that mode, an unbound one
  the shape's color, to the closest color of the same hue that passes everywhere that source is
  used; when no color can, the advice says to bind it per mode. A button's name is fixed by its
  linked Label override, or by renaming the instance when the name comes from its layer.
  Focus order has advice only, since operations can't reorder layers.
- **AI fixes.** Propose fixes sends the involved shapes' context plus `accessibility` (problems,
  contexts, and `fixes`, the merged batch) to the AI; the instructions ask it to propose those
  and keep bindings. The local test model answers with `fixes`. The proposal is listed with
  Accept and Discard; Accept applies it with the AI's provenance and checks again. Without AI,
  Review fixes shows the same batch for the person to accept.
- **Download.** The package keeps the tested session as "As tested" and adds `views`, each
  chosen context drawn the same way, sharing one image table, plus the thresholds. The page has
  a "View as" picker and an Accessibility toggle that lists problems, focus order, names and
  contrast for the screen as it is now (variants, records and state included). Shared links get
  the toggle too. The preview protocol stays at version 3. `packageContents` replaces
  `packageApplication` and reads each image once for every view.
- **Tests.** `tests/accessibilityAudit.test.ts` (contrast math, compositing, variants and hidden
  instances, player state, contexts and the limit, fixes applied, local model);
  `tests/themes.test.ts` (each mode and size drawn alike by the canvas, Prototype and the
  downloaded page, and the page's report matching the check); `tests/browser/themes.spec.ts`
  (choose contexts, check, accept AI fixes, download, switch modes and sizes and read the report).
- **Not yet.** Text width is estimated, not measured, so a line's sampled background can miss a
  narrow shape; rotation is ignored. Names of lists and images, landmarks and heading structure
  aren't checked. Focus order can't be fixed from the check.

