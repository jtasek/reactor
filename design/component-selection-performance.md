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
