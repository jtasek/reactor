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
