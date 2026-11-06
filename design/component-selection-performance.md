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
new, unchanged objects as artwork changes. There is no persistent geometry cache
or identity-only comparison of mutable store records. Component-source and mode
reads remain tracked: changes to those dependencies still render the artwork.

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
