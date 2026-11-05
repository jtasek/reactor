# Frame dragging performance

Measured on 2026-10-30 in Chromium, using the production React/Overmind paths with
minification disabled for readable CPU samples. The fixture contains one ordinary
frame with 100 rectangles and four Screen views sharing another 100 rectangles.
Inspector and Explorer are open. After the initial press and first move, each of 30
pointer moves waits for an animation frame and the following task. Playwright tracing
is disabled so its DOM snapshots do not dominate the measurement.

## Observed results

| Drag target                  | Before median | After median | Before p95 | After p95 |
| ---------------------------- | ------------: | -----------: | ---------: | --------: |
| Screen view                  |       33.6 ms |      16.7 ms |    36.0 ms |   17.2 ms |
| Ordinary frame, 100 children |       21.1 ms |      19.9 ms |    25.4 ms |   24.7 ms |

These are local samples, not universal frame-rate guarantees. The timing includes
frame scheduling and CPU profiling overhead. The ordinary-frame improvement is small;
its children still need their authored coordinates updated and rendered. The clear
improvement is the Screen view path, which reaches the approximately 16.7 ms scheduling
floor of this run.

Across the 30 Screen view moves, sampled inclusive CPU time in `projectScreenViews`
fell from 499.3 ms to no samples; `ProjectedShape` fell from 216.4 ms to no samples.
Total sampled `renderWithHooks` time fell from 768.4 ms to 23.5 ms. Inclusive samples
can overlap and must not be added together. A MutationObserver also verifies that
moving either frame leaves the shared Screen view artwork DOM unchanged.

## Cause and fix

- Canvas placement was an input to all Screen view projections. Each movement
  recalculated all four views and rerendered their shapes, even though their width,
  artwork and modes stayed the same. Ordinary canvas views now project at a local
  origin; a small SVG wrapper tracks and translates their placement. The shared
  interaction and Preview projections retain absolute coordinates. Focused component
  editing retains its existing coordinate path.
- The Inspector independently projected every view on each position update to obtain
  a diagnostic. Its status now lives in a memoized component whose projection ignores
  canvas placement, while still tracking dimensions, modes, artwork and node limits.
- Stack layout copied whole frame records, subscribing consumers to unrelated position
  fields. It now reads position only when positioning a stack's contents.
- Ordinary frame movement deep-cloned complete descendant shape snapshots on every
  event. It now reads the immutable snapshots without proxy traversal and copies only
  the top-level record before translation replaces its geometry. Pen points, line
  endpoints and measured bounds remain independent of the cancellation snapshots.

No document schema, mode rules, layout selection, gesture commit/cancel semantics or
collaboration persistence changed. The earlier Screen icon change remains separate.

## Regression coverage and reproduction

`tests/browser/frameDragging.spec.ts` exercises both targets, checks that Screen view
artwork is not rewritten during movement, verifies positions after cancel and release,
and reloads the saved result. It records timing samples but imposes no flaky timing
threshold. To collect a CPU profile and measurements against the normal production
bundle:

```sh
PROFILE_FRAME_DRAG=1 pnpm exec playwright test tests/browser/frameDragging.spec.ts \
  --workers=1 --trace=off --reporter=json > /tmp/reactor-frame-drag.json
```

The JSON report contains `drag-profile` and `drag-measurements` attachments. A screenshot
of the dragged Screen view is also saved in that test's output directory. For readable
function names, the measurements above used an unminified production build as described
in `scripts/profile-drag.ts`, served on a separate local port with the same fixture.

A store dependency test verifies that local projections do not subscribe to view
placement but do update after resizing a stacked screen. A separate gesture test
checks repeated line/pen translations and cancellation snapshots. Existing browser
checks continue to verify placed canvas coordinates, including each view's translation,
instead of assuming each SVG child's raw coordinates are absolute.

## Hardware-acceleration experiment — 2026-11-05

Repeated the existing fixture against the production build, with Inspector and Explorer
open: 100 children in an ordinary frame and four Screen views sharing 100 rectangles.
Each scenario ran three times, with 30 measured moves per run. Tests still assert unchanged
Screen view artwork, cancellation, release coordinates and saved positions after reload.

Two **test-only** CSS experiments ran alongside the baseline. They were removed from
`tests/browser/frameDragging.spec.ts` once they showed no benefit; the PR #427 commit
(828752a) still has them behind `PROFILE_RENDERING=1`:

- `surface-layer`: request compositing of the root SVG with `will-change: transform`.
- `no-glass`: disable backdrop filtering to test its contribution to dragging cost.

Neither experiment changes application CSS. A layer hint is a request to the browser,
not proof that a particular SVG subtree received a separate composited layer.

### Hardware-backed Chromium results

A visible Chromium session reported Apple M1 Pro through ANGLE/Metal, with GPU
compositing and rasterization enabled. Median and p95 below pool 90 move samples per
scenario. Script and task columns are mean totals across each run's 30 moves, in ms.

| Scenario          | Target         | Median |   p95 | Script | Main-thread task |
| ----------------- | -------------- | -----: | ----: | -----: | ---------------: |
| Baseline          | Ordinary frame |  20.15 | 22.90 | 543.03 |           627.10 |
| Canvas layer hint | Ordinary frame |  19.70 | 23.20 | 536.50 |           618.51 |
| No glass blur     | Ordinary frame |  20.45 | 25.80 | 542.45 |           645.60 |
| Baseline          | Screen view    |   8.30 |  9.10 |  58.30 |           122.81 |
| Canvas layer hint | Screen view    |   8.30 |  9.10 |  56.28 |           118.83 |
| No glass blur     | Screen view    |   8.30 |  9.40 |  60.94 |           144.41 |

Baseline ordinary-frame layout and style recalculation totals were 11.02 ms and
14.45 ms respectively. JavaScript accounted for most measured main-thread work;
these counters do not measure GPU time or identify a specific JavaScript function.
The layer hint's small median change did not improve p95, and does not justify a
production change. Disabling blur did not help this fixture either.

### Software-rendered cross-check and limits

Headless Chromium reported SwiftShader and software compositing/rasterization. Its
baseline medians were 19.00 ms for the ordinary frame and 16.60 ms for the Screen view.
The layer hint measured 19.05/16.60 ms; disabling blur measured 19.90/16.70 ms.
All 36 cases across both browser modes passed.

Do not interpret the 8.3 vs 16.6 ms Screen view timings as a GPU speedup: the sessions
have different frame scheduling. These measurements include animation-frame waits,
not just rendering duration. Runs were sequential in a fixed scenario order on one
machine; small differences may be noise. No general claim is made about pan/zoom,
Prototype resizing, larger documents or other browsers/devices.

### Decision and reproduction

Keep production rendering unchanged. The browser already uses hardware acceleration
in the visible session. Before changing ordinary-frame dragging, profile its JavaScript
work separately; compositor hints cannot eliminate those document/React updates.

To rerun the experiments, check out 828752a and run:

```sh
PROFILE_RENDERING=1 pnpm exec playwright test tests/browser/frameDragging.spec.ts \
  --headed --workers=1 --repeat-each=3 --trace=off --reporter=json \
  > /tmp/reactor-rendering-gpu.json
```

Omit `--headed` for the software-rendered cross-check, and verify the browser's GPU
status rather than assuming it from the launch mode. On the current spec,
`drag-measurements` attachments contain per-move timings, the artwork mutation count
and CDP deltas for ScriptDuration, LayoutDuration, RecalcStyleDuration and TaskDuration
(milliseconds).

## Ordinary-frame JavaScript follow-up — 2026-11-05

An unminified production CPU profile identified repeated React/Overmind bookkeeping in
ordinary-frame children. Across 30 moves, sampled inclusive `renderWithHooks` time was
248.3 ms, `subscribe` 53.0 ms and `shapeGeometryKey` 21.0 ms. These inclusive samples
overlap and cannot be summed. Each Shape called several state hooks, creating separate
tracking trees/subscriptions for the same component render. Geometry measurement keys
were also serialized even while a gesture suspended DOM measurement.

The Shape renderer now uses one tracked state hook and the same pure readers for shape,
visibility, locking, inherited modes, component source and measurement eligibility.
Reads still go through Overmind's tracked proxy: there is no untracked snapshot or cache.
The measurement eligibility helper receives that tracked state instead of starting another
subscription. Geometry/variable measurement keys are computed only when measuring a visible,
non-contextual shape. Releasing the gesture resumes measurement with its current geometry.
No document data, pointer scheduling, snapping, undo or collaboration code changed.

Skipping measurement keys alone had a small effect (19.4 ms median; 23.1 ms p95), so it
was not treated as the primary improvement. Consolidating the subscriptions gave the
following result with the minified production build in hardware-backed Chromium, three
runs of 30 moves each, using the same baseline as the hardware experiment above:

| Target                       | Before median | After median | Before p95 | After p95 | Before script / 30 moves | After script / 30 moves |
| ---------------------------- | ------------: | -----------: | ---------: | --------: | -----------------------: | ----------------------: |
| Ordinary frame, 100 children |      20.15 ms |     16.60 ms |   22.90 ms |  18.60 ms |                543.03 ms |               437.68 ms |
| Screen view                  |       8.30 ms |      8.30 ms |    9.10 ms |   8.60 ms |                 58.30 ms |                57.08 ms |

The ordinary-frame median improved about 18%, p95 about 19%, and measured JavaScript
work about 19%. These are local observations, not device-independent guarantees; the
benchmark includes frame scheduling. The after-run also instruments the moved child's
`getBBox` calls: no measurement occurs during the drag, and it resumes after release.
Existing checks still cover cancellation, persisted geometry and unchanged Screen view artwork.
`tests/shapeSubscriptions.test.ts` checks that rendering one unselected Shape starts a
single Overmind tracking tree (master before this change started ten).

```sh
pnpm exec playwright test tests/browser/frameDragging.spec.ts \
  --headed --workers=1 --repeat-each=3 --trace=off --reporter=json \
  > /tmp/reactor-frame-subscription-after.json
```
