# Screen view component selection

## Reproduction and finding

On 2026-11-05, a local Chromium fixture with 60 instances of an eight-shape
component, three Screen views, and Inspector and Explorer open reproduced slow
selection. Selecting one instance rebuilt every Screen view's projection. Those
fresh snapshot objects caused every projected sibling to render again, repeating
component-source geometry reads and Overmind subscription work.

## Change

`ProjectedShape` now uses one tracked state tree and memoizes rendering against
all projected shape fields and placement/selection-control props. Projection
shapes are plain snapshots, so comparing their serialized values avoids treating
new, unchanged objects as artwork changes. This first change added no persistent
geometry cache; the shared cache described below (2026-11-06) came later.
Component-source and mode reads remain tracked: changes to those dependencies
still render the artwork.

## Local measurements

The same four-instance selection sequence was profiled before and after in an
unminified production build with Chromium's CPU profiler enabled:

| Measurement                                     |             Before |              After |
| ----------------------------------------------- | -----------------: | -----------------: |
| Click/assertion durations (ms)                  | 339, 294, 290, 305 | 244, 157, 157, 151 |
| Median duration (ms)                            |              299.5 |                157 |
| Sampled React work across the sequence (ms)     |                738 |                248 |
| Sampled hook rendering across the sequence (ms) |                612 |                185 |

This is about 48% lower median test duration and 66% less sampled React work.
Durations include Playwright dispatch, assertions and instrumentation; they are
not direct input-to-paint measurements. Runs were sequential on one machine in
headless Chromium. They do not establish a universal latency target or demonstrate
that every possible freeze is resolved. GPU acceleration is not the fix here.

## Reproduction

`tests/browser/componentSelectionPerformance.spec.ts` verifies that each instance
receives its selection outline in the active Screen view. It attaches click
measurements and total script duration, without a machine-dependent timing gate.
Set `PROFILE_COMPONENT_SELECTION=1` to attach a CPU profile; use an unminified
production build when readable function names are needed.

```sh
pnpm exec playwright test tests/browser/componentSelectionPerformance.spec.ts \
  --workers=1 --trace=off --reporter=json > /tmp/component-selection.json
```

Related Screen view tests exercise focused source editing, rotated and stacked
instances, handles, alignment, selection menus, variants, and inherited modes.

## Starter-template follow-up (2026-11-06)

After the report that ordinary starter templates also stall, a second benchmark
creates each of the five templates through the Templates picker. It performs 16
real mouse selections per template with Inspector and Explorer open, alternating
visible text and component artwork. Targets are checked against the current DOM
because Inspector height and selection menus can cover previous click positions.

The profile exposed additional work: each Screen view projected contextual geometry
for the entire document, including the other screens and detached component source
shapes. Screen projection now supplies its member IDs to contextual layout. Only
those shapes receive top-level geometry resolution; other records remain available
for recursive component-source and variable lookup. Hidden screen members remain
included for layout. Canvas, Preview and other callers without a scope retain their
existing full-document behavior.

The comparison below starts **after the rendering optimization above**, and measures
the additional projection-scope fix. Each cell is the median of 16 click/assertion
durations in an unminified production CPU-profiled run, including test overhead.

| Template             | Before scoping (ms) | After scoping (ms) |
| -------------------- | ------------------: | -----------------: |
| Inspector typography |                68.5 |               62.5 |
| List / detail        |               102.5 |               70.0 |
| Forms                |               120.5 |               72.5 |
| Sign-in              |               107.0 |               70.0 |
| Settings             |               125.5 |               76.0 |

These local runs completed all 80 selections; they do not establish input-to-paint
latency or rule out every intermittent freeze in another environment.
`tests/browser/templateSelection.spec.ts` keeps this everyday workflow covered.
A contextual-measurement regression compares scoped and full nested-instance
geometry and checks that unrelated canvas text remains unprojected.

## Shared geometry cache (2026-11-06)

Ordinary Screen views now keep a selection-independent, local-coordinate projection in
`document.screenViewGeometry`, an Overmind derived value provided by the lazy editor.
Rendering, editing/hit testing and Inspector diagnostics reuse that projection. Selected
artwork reads live selection itself; hit-test copies restore live selection and hover.
View placement translates copies or the existing SVG wrapper, never the cached geometry.
Focused source-only component editing retains its existing projection path.

The resolver snapshots tracked authored graph fields, including nested component sources,
variables, dimensions and simulation modes. It excludes selection, hover and view placement.
Overmind replays dependencies when another consumer reads the cached value. A single last-input
signature/result per document handles structural local changes (such as deleting
`selectedFrameId`) that invalidate Overmind's parent dependency despite unchanged artwork.
This signature is checked only on derived misses and is stored as a short hash of the
serialized inputs, not a copy of them.

The projection receives only that snapshot, never the raw document. A field it reads must
be one of the resolver's `inputs` (or a derived field it can compute from them), so a new
dependency reads `undefined` and fails tests instead of drawing stale artwork. React `useMemo` retains frame outlines using
immutable projection arrays; it is not keyed by mutable document identity.

This is a bounded first increment: authored edits still rebuild the graph snapshot and affected
view projections together. It does not yet provide per-entity dependency invalidation or a new
pointer scheduler. No renderer, store or document schema was replaced. The unchanged corner-radius
drag calculation moved from the eager geometry module into its editor-only consumer to keep the
existing 497 KiB entry budget.

### Matching production-browser comparison

A clean export of the code before this change, in a temporary directory, was the baseline. Both runs used
minified production builds, Chromium, one worker, no CPU profiler, and the same 16 real selections
per template with Inspector and Explorer open. All 80 selections passed in each run.

| Template             | Median click/assertion before (ms) | After (ms) | Script time before (ms) | After (ms) |
| -------------------- | ---------------------------------: | ---------: | ----------------------: | ---------: |
| Inspector typography |                                 46 |       42.5 |                   624.6 |      568.4 |
| List / detail        |                                 52 |       27.5 |                   750.7 |      369.2 |
| Forms                |                               61.5 |       28.5 |                   902.9 |      364.8 |
| Sign-in              |                                 59 |         30 |                   829.1 |      378.5 |
| Settings             |                               62.5 |         32 |                   900.0 |      403.9 |

Script time covers the entire 16-selection sequence. These are single sequential runs on one
machine, include browser-test overhead and are not input-to-paint measurements. They show reduced
work, not a guarantee that every editing gesture or intermittent freeze is fixed.

`tests/screenViewGeometry.test.ts` checks cache identity across selection/hover/placement,
dependency replay to successive readers, nested size invalidation and persistence exclusion.
Contextual measurement tests cover modes, nested component sources, remote changes and undo.

Verification: 2,137 unit/server tests passed (30 skipped), plus 42 targeted editing browser tests
and the five post-change template benchmarks. Application/test/server type checks and the lint
baseline gate passed (two existing findings). The independent performance review found no blocking
issues. Production entry assets total 508,851 bytes versus 508,905 in the baseline; summed gzip
sizes are 146,148 versus 146,187 bytes. Both the 497 KiB entry and 248 KiB file budgets pass.

After isolating this change from the open record-forms PR and rebasing onto master `22d50359`,
verification passed again: 2,132 unit/server tests (30 skipped), all 47 browser tests, type checks,
lint baseline and production build. The final entry remains 508,851 bytes (146,141 summed gzip).

## Incremental Screen view geometry (2026-11-06)

The editor now retains a projection per visible Screen view, while the existing derived value
still tracks and snapshots authored inputs. A shape/text edit invalidates views whose active
layout contains that shape, or whose component source graph uses it. Dependency collection includes
nested component sources, all family variants and group members. View width/height edits invalidate
that view independently. Unchanged views retain the same projection and shape objects.

Component records are keyed per layout: the components its instances reach (including
variants and missing IDs) and those listing its shapes, since a hidden or source-only component
hides them. Groups/layers, variables, dimensions, simulation modes and frame
topology remain conservative shared invalidations. The global `hasNumericLayout` decision is also
part of the shared key: unrelated wrapping can switch contextual resolution on or off. Nested
screens retain the full frame/shape input because parent stacks, siblings and hug sizing can affect
them. This does not yet eliminate full-graph snapshotting or provide per-shape layout updates
inside an affected screen.

The projection loop still enforces the aggregate node budget on cached and new results alike.
Only entries visited by the latest projection pass are retained. Group dependency indexing keeps
references to member arrays and visits each group once, rather than copying/traversing the full
member list for each member. Runtime snapshots remain outside durable data, undo and collaboration.

### Resolver benchmark

`tests/screenViewGeometryPerformance.test.ts` creates eight independent screens, two views per
screen and 20 wrapped text shapes per screen. It performs 24 successive text edits and measures
the editor action plus the subsequent derived geometry read. Baseline is clean master `647e3678`,
exported to a temporary directory with the same benchmark; each run uses one test process.

| Measurement                             |    Before |     After |
| --------------------------------------- | --------: | --------: |
| Median edit + resolution                |  16.14 ms |   6.94 ms |
| Total for 24 edits                      | 421.40 ms | 173.05 ms |
| Screen projections after one local edit |        16 |         2 |

This is approximately 57% lower median resolver time in this fixture. These are single local
Vitest runs measuring JavaScript state/geometry work, not browser rendering or input-to-paint.
Run with `pnpm exec cross-env PROFILE_SCREEN_EDITS=1 vitest run tests/screenViewGeometryPerformance.test.ts -t 'resolves successive'`.

Regression coverage checks projection identity and computation counts, view resizing, shared
nested sources, alternate layouts, responsive variants, node-budget blocking/unblocking,
unrelated contextual-layout switches and linear traversal of a 1,000-member group. Existing
mode/collaboration/undo and Screen view interaction suites remain applicable.

Independent review found and verified fixes for the global contextual-layout dependency and
quadratic group traversal. Final verification: seven new regression/benchmark tests, 47 browser
tests, application/test/server type checks, lint baseline (two existing findings) and production
build passed. The full unit/server run passed 2,145 tests with 30 skipped and one save-status
timeout in the unchanged server-sync suite; rerunning all 16 tests in that file passed. Production
entry assets total 508,851 bytes (146,154 summed gzip), within the existing budgets.

### Review follow-up: shared layout inputs

Dependency indexes (group and component memberships, shapes by parent frame, drawing order) are
built once per resolve, and views of the same screen and active layout share one layout input
key. An unrelated component edit no longer recalculates any view. With 12 screens of 100 wrapped
texts, 24 views and 3,000 off-screen rectangles, median resolve times (ms, before → after) were:
local edit 114 → 77, off-screen shape edit 70 → 39, unrelated component rename 577 → 39. A
randomized comparison of cached and fresh geometry over 200 sequences of 40 edits matched.

### Reusing geometry snapshots

Geometry snapshots now retain unchanged immutable branches and cache their content fingerprints.
Every evaluation still reads authored fields through Overmind, including key additions/removals;
selection and hover remain excluded. Fingerprints compare content rather than mutable object
identity, so replacing a record with equivalent content does not invalidate geometry. Cache
entries use weak references to source objects and keep only the latest snapshot per copy profile.
The original compact hash algorithm is unchanged. Nothing is written into saved documents, but the
latest copy of each authored record stays in memory while its source object lives (strings are shared,
so text and image data are not duplicated). Copies are frozen outside production builds: a write into
one would leave its fingerprint stale and could make views draw old artwork.

Three alternating before/after runs against `899b5c8d` used the existing 24-edit, eight-screen
fixture. Combined median action-plus-geometry time was **6.86 ms before → 5.94 ms after** (13%
lower). Individual run medians were 6.06/7.09/7.35 ms before and 5.92/6.54/5.48 ms after.
These local Vitest measurements exclude browser painting and are not an interaction-latency claim.
The change avoids repeated deep copying and serialization of unchanged records, but still scans
the authored graph and creates temporary traversal arrays to maintain reactive subscriptions.

Independent performance review found no actionable issues. Verification passed: 32 focused tests,
47 browser tests, application/test/server type checks, changed-file lint, lint baseline and
production build within the existing budgets. The full suite passed 2,151 tests with 30 skipped
and one five-second timeout in randomized collaboration seed 2; rerunning that entire suite
passed all 70 tests. No timeout limits were changed.

### Reusing parent context within a layout pass

`contextualDocument` now resolves inherited modes once per parent frame in each pass. Component
instances in the same parent also share the responsive width context; non-instance shapes no
longer calculate unused variant widths. These caches live only for that invocation, so the
second sizing pass and later edits always recompute from current frame sizes, modes and ancestry.
Instance overrides remain independent because entering an instance copies its inherited modes.

The regression fixtures reduce 100 sibling labels from 100 mode resolutions to two (one for
each parent), and 40 sibling instances from 40 width calculations to one. Both tests fail against
baseline `6da46418` with those original counts. They also verify mode changes between passes,
changed available parent width, resolved variant selection and distinct instance values/modes.

Three alternating before/after runs of the existing 24-edit, eight-screen benchmark measured a
combined median of 5.47 ms before and 5.08 ms after. Run medians were 5.67/5.66/5.22 ms before
and 5.10/4.87/5.32 ms after; the ranges overlap, so that benchmark shows no clear end-to-end gain.
These are local JavaScript action-plus-geometry timings, excluding browser painting.

The gain shows on documents with many shapes per frame. An informal timing of one
`contextualDocument` pass (median of 60 runs, three alternating runs each) measured 400 text
labels across four nested frames at 2.1–2.3 ms before and 0.67–0.75 ms after, and 200 responsive
instances in one parent at 2.1–2.9 ms before and 1.7–1.8 ms after. Instances gain less because
projecting each instance's source artwork still dominates.

The plain Canvas path (`canvasShape`, used when no frame stacks, sizes or binds numbers) tracks
each shape separately, so it cannot share parent context. It does skip variant widths for
non-instance shapes. Full-graph snapshot reads and layout
traversal remain. This increment removes repeated parent-context calculations without adding a
persistent cache or changing document data.

Independent performance review found no actionable issues. All 2,156 unit/server tests passed
(30 skipped), as did application/test/server type checks, changed-file lint and the lint baseline
(two existing findings). The full suite used four workers without changing test timeouts.
All 67 selected browser tests passed, including templates, Screen view editing, inherited modes,
responsive variants and hug/fill sizing. Their production editor and preview builds passed within
the existing bundle budgets.

### Resolving Screen view frame visibility once

For plain projection snapshots, each `isFrameVisible` call rebuilt all inherited frame states.
A screen with N child frames therefore repeated the full frame traversal N times, followed by
another traversal for its shapes. `projectScreen` now resolves the frame-state map once and uses
it for both child-frame visibility and `shownShapesIds`. Other callers retain the existing default
resolution, including the focused-component early return. The map is local to the projection;
subsequent visibility, parent or lock edits are read again. No persistent cache is introduced.

The new fixture contains one screen, 400 child frames and one rectangle per child. After one
warm-up it measures 20 complete `projectScreen` calls. Three alternating baseline/current runs
against `94cedc47` measured **99.02 ms before → 2.93 ms after** combined median (97% lower).
Individual medians were 99.30/98.35/99.26 ms before and 2.79/2.97/2.95 ms after. This isolates
full geometry projection for a frame-heavy screen; it excludes browser painting and does not
claim the same improvement for ordinary screens or already-cached projections.

Run with `pnpm exec cross-env PROFILE_FRAME_VISIBILITY=1 vitest run tests/screenFrameStatePerformance.test.ts -t 'projects a screen'`.
A separate regression checks one visibility lookup per projection (plus the layout document's
shallow copy), nested hidden-frame/shape exclusion, restored visibility, and visible locked
frames. It fails on the baseline with 102 frame-state reads instead of two for 100 children.
Independent performance review found no actionable issues.

Verification: all 2,159 unit/server tests passed (30 skipped), along with application/test/server
type checks, changed-file lint, the lint baseline (two existing findings), and production editor
and preview builds within the existing bundle budgets.
All 67 selected browser tests passed, covering template selection, Screen view editing, inherited
modes, responsive variants and stack sizing.

### Linear Screen layout membership

`screenLayoutMembers` previously walked each frame's ancestor chain separately. A deeply nested
screen repeated those shared chains, producing quadratic work. It now builds child lists from
the existing normalized parent map, traverses the active layout once, and returns members in
original document-key order. Other valid alternate layouts remain excluded; missing parents,
cycles and view parents retain the existing normalization. Every call rebuilds the traversal,
so reparenting and layout changes need no persistent cache invalidation.

Three alternating runs against `d15fe9c4` measured 20 membership resolutions after warm-up for
1,000 nested frames. Combined median time was **10.86 ms before → 0.74 ms after** (93% lower).
Run medians were 11.17/10.67/10.78 ms before and 0.75/0.74/0.72 ms after. The bounded-work test
fails on the baseline with 320,401 parent lookups for 800 nested frames; the new traversal stays
below its linear 8,010-lookup guard.

Shallow fixtures had small increases: full projection of 400 sibling frames was 2.81 → 2.85 ms,
and the existing eight-screen edit benchmark was 5.05 → 5.18 ms, with overlapping run ranges.
The gain is specific to nested membership traversal, not a claim of faster browser painting or
all edits. Run with `pnpm exec cross-env PROFILE_LAYOUT_MEMBERS=1 vitest run tests/screenLayoutMembersPerformance.test.ts -t 'finds members'`.

Tests cover document order, default/alternate boundaries, missing layout choices, normalized
invalid parents/cycles/view parents and reparenting. Independent review found no actionable issues.

Verification: all 2,163 unit/server tests passed (30 skipped), together with application/test/server
type checks, changed-file lint, lint baseline (two existing findings), and production editor/preview
builds within the existing bundle budgets.
All 76 selected browser tests passed, including automatic/explicit screen layouts, template
selection, Screen view editing, inherited modes, responsive variants and stack sizing.

### Placing only the requested editing view

A fresh Chromium CPU profile with Inspector and Explorer open found `editableScreenView`
calling `componentScreenViews`, translating/copying every view, and then retaining just one.
In the 60-instance/three-view fixture, that resolver accounted for 68.3 ms of sampled CPU over
four selections. The geometry itself was already cached; this was repeated placement work.

Editing now requests its view before ordinary projections are copied and translated. Drawing
all views retains the existing path. The aggregate geometry node budget is enforced before
filtering; focused component editing still projects the full set before selecting its result.
Selection/hover values are read live, and translated shapes remain isolated copies. No new
persistent cache or document fields are introduced.

The regression fixture now translates 20 shapes for one requested view instead of 320 across
16 views; it fails against baseline `f6ef1618` with the original count. It also verifies live
selection, cache/copy isolation and rejection of a view blocked by the shared node budget.
Independent performance review found no actionable issues.

For diagnosis, a temporary unminified production build was used with the existing
`PROFILE_COMPONENT_SELECTION` browser tests. Sampled resolver time fell from 68.3 to 32.8 ms,
and the component fixture's median dispatch/assertion duration fell from 74.5 to 58.5 ms in
one before/after run. These numbers include profiling and browser automation overhead; they
are not input-to-paint latency. Temporary profiling configuration and profiles stay outside
the repository; normal production builds retain minification and bundle budgets.

Normal minified production builds were then tested three times each (baseline runs followed by
optimized runs), one browser worker, without CPU profiling. All 36 runs passed. Combined median
interaction durations and median per-run script time were:

| Fixture                   | Interaction before → after | Script before → after |
| ------------------------- | -------------------------: | --------------------: |
| 60 instances, three views |                 64 → 57 ms |    283.09 → 256.20 ms |
| Inspector typography      |                 42 → 41 ms |    533.88 → 531.79 ms |
| List / detail             |                 28 → 27 ms |    362.47 → 335.54 ms |
| Forms                     |                 27 → 26 ms |    347.59 → 332.44 ms |
| Sign-in                   |                 29 → 27 ms |    386.83 → 348.55 ms |
| Settings                  |                 33 → 30 ms |    397.80 → 371.89 ms |

The component fixture performs four selections per run; each template performs 16. Script totals
therefore must not be compared across those fixture types. Results describe these local runs,
including automation/assertions, not guaranteed latency. Rendering, component-source resolution
and subscription bookkeeping remain visible in the profiles and are separate future work.

Verification: all 2,165 unit/server tests passed (30 skipped), as did application/test/server type
checks, changed-file lint and the lint baseline (two existing findings). Normal production editor
and preview builds passed within the existing bundle budgets. All six profiling scenarios passed
on each diagnostic build; all 18 benchmark runs passed on each normal production build.
All 76 broader browser regression tests passed, including dragging, shape/container handles,
focused component editing, selection menus, automatic/explicit layouts and inherited modes.

### Separating selection controls from artwork (2026-11-07)

Screen view selection outlines now subscribe to selection independently of the projected
artwork. Selecting a shape no longer directly invalidates its artwork's mode, color and
component-source resolution. Existing memoization still compares immutable geometry and
placement props; artwork dependencies remain tracked, including variable and source edits.
Each interactive shape gains a small selection subscription. No durable fields or new
persistent caches are introduced.

Container selection now returns before placing a view's artwork when there is no selected
group or component. The regression in `shapeSubscriptions.test.ts` verifies that ordinary
shape selection does not even read projection members for that unused work; it fails before
the early return. Existing container-handle tests exercise the nonempty path.

Baseline: merged master `1a2bb90c`. Both versions used normal minified production builds,
Chromium, one worker, three runs per fixture and no CPU profiler. Baseline runs preceded
optimized runs on the same machine. All 18 runs passed on each version.

| Fixture | Median interaction before → after | Median script total before → after |
| --- | ---: | ---: |
| 60 instances, three views | 55 → 49 ms | 257.44 → 241.00 ms |
| Inspector typography | 42 → 41.5 ms | 531.55 → 541.07 ms |
| List / detail | 28 → 28 ms | 347.37 → 338.89 ms |
| Forms | 26 → 26.5 ms | 334.65 → 329.88 ms |
| Sign-in | 28 → 28.5 ms | 354.61 → 362.31 ms |
| Settings | 31 → 32.5 ms | 374.34 → 355.20 ms |

The instance-heavy fixture shows about 11% lower interaction time and 6% less script work.
Template results are mixed and small; they do not establish a general speedup. Interaction
durations include automation/assertions, not input-to-paint latency. Script totals cover four
selections in the component fixture and 16 in each template, so totals are not comparable
across fixture types. These changes remove specific unnecessary work rather than replace
SVG or Overmind; subscription bookkeeping and source resolution remain future profiling targets.

Verification: 2,166 unit/server tests passed (30 skipped), including 26 focused subscription
and container-handle checks. All 52 broader browser tests passed, covering repainting,
inherited modes, responsive variants, view dragging, shape/container handles, focused editing,
alignment, overlays and stack sizing. Application/test/server type checks, lint baseline
(two existing findings), and production editor/preview builds passed with unchanged budgets.

### Reusing component-source bounds (2026-11-09)

A fresh unminified production CPU profile attributed 50.3 ms of sampled inclusive CPU
across four selections to `componentSource`. It repeatedly measured member bounds and
spread entire source shapes just to pass bounds to `drawnBox`. Those spreads also read
selection and hover metadata through Overmind, although neither affects source geometry.

Source measurement now reads each member's bounds once and passes them, with its rotation,
to the extracted `rotatedBounds` calculation. `drawnBox` retains its original one-argument
contract for all existing callers. Nested sources retain their resolved dimensions, and
geometry/appearance keys and live source reads remain unchanged. No cache is added.

The regression checks a rotated member's extent, one bounds read, and no reads of selection
or hover flags. It fails against baseline `9fbb978c` and passes with the change. Existing
nested-source, variable, undo and collaboration coverage remains intact.

Normal minified production builds were compared in Chromium with one worker and three runs
per build, without profiling or concurrent test suites. The final optimized runs preceded
the baseline runs on the same machine. All six benchmark runs passed:

| Fixture | Median interaction before → after | Median script total before → after |
| --- | ---: | ---: |
| 60 instances, three views | 110 → 109 ms | 228.38 → 206.23 ms |

This is about 10% less JavaScript work in this fixture, not a demonstrated improvement in
input-to-paint latency. Interaction durations include browser automation and assertions;
script totals cover four selections. The small sample and sequential runs do not establish
a general speedup. These timings are not directly comparable to earlier machines/runs.

Verification: all 2,196 unit/server tests passed (30 skipped), plus 43 browser tests covering
selection, source editing, inherited modes, responsive variants, repainting and shape/container
handles. Application/test/server type checks, changed-file lint, the lint baseline (two existing
findings), and production editor/preview builds passed with unchanged budgets.

### Reusing interaction-target ancestry within a lookup (2026-11-09)

A fresh diagnostic profile showed `prototypeTargets`, used by Inspector interaction controls,
spending 11.4 ms of sampled inclusive CPU across four selections. It resolved the source
layout again for every candidate and repeatedly walked parents shared by many instances.

Each target lookup now resolves the source layout once and memoizes candidate roots by frame
ID in a local Map. Nothing survives the call: reparenting, layout changes, remote changes and
missing frames use fresh document state on the next lookup. Target eligibility is unchanged.
The typography regression reduces ancestry calls from 14 to 1, fails on the original code,
and checks subsequent reparenting and layout deletion.

Baseline `b36ce890` and the optimized code used normal minified production builds, Chromium,
one worker, three runs each, baseline first, with no other verification jobs running. All six
benchmark runs passed:

| Fixture | Median interaction before → after | Median script total before → after |
| --- | ---: | ---: |
| 60 instances, three views | 113.5 → 112 ms | 206.44 → 199.51 ms |

The local sample shows about 3% less script work, with nearly unchanged interaction timing.
These small sequential samples include automation/assertions and do not measure input-to-paint
latency or establish a general speedup.

Verification: 39 focused unit tests and 23 interaction/Flow browser tests passed. The full
unit/server run passed 2,201 tests with 30 skipped and one five-second randomized collaboration
timeout while browser builds and lint were also running. Rerunning the complete collaboration
suite alone passed all 70 tests without changes. Application/test/server type checks, changed-file
lint, lint baseline (two existing findings), and production editor/preview builds passed.

### Tracking only component members' drawing order (2026-11-09)

The latest diagnostic profile still attributed 19.7 ms of sampled inclusive CPU to
`componentSource` during projected artwork rendering. The reader filtered the document-wide
shape-order list for every local component source; this also subscribed instance rendering to
that list, so unrelated canvas ordering could invalidate it.

Source lookup now reads the component's unique member IDs, omits missing shapes, and sorts
those members by the existing drawing-order comparator. Library snapshots use their own member
records. It no longer scans or subscribes to the canvas-wide order list. Actual source-member
ordering remains tracked; no persistent cache, document field or renderer is added.

Regression tests check local and library source order, duplicate/missing members, member
reordering/deletion, and the actual Overmind subscription paths. The dependency and global-list
read regressions fail on the original code and pass with the change.

Baseline `e70b8444` and the optimized code used normal minified production builds, Chromium,
one worker, three runs each, baseline first, without concurrent verification jobs. All six
benchmark runs passed:

| Fixture | Median interaction before → after | Median script total before → after |
| --- | ---: | ---: |
| 60 instances, three views | 111 → 108 ms | 194.19 → 190.65 ms |

This sample shows about 2% less script work; the interaction difference is small and does not
establish a noticeable or general speedup. Measurements include automation/assertions and are
not input-to-paint latency. The structural gain is removing document-wide work and dependencies
from a lookup that needs only one component's members.

Verification: 47 focused unit tests and 44 browser tests passed, including live component
rendering, library updates, inherited modes, responsive variants, focused editing and handles.
The full unit/server run passed 2,205 tests with 30 skipped and one server-sync failure waiting
for offline status. Its complete file passed all 16 tests when rerun alone, without changes.
Application/test/server type checks, changed-file lint, lint baseline (two existing findings),
and production editor/preview builds passed with unchanged budgets.
