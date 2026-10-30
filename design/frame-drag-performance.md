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
