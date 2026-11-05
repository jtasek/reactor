# Canvas pan and zoom performance

Measured on 2026-11-05 in hardware-backed Chromium (Apple M1 Pro, ANGLE/Metal),
using the minified production editor. The fixture contains 1,000 rectangles, one
selected shape, and open Inspector and Explorer panels. Each run sends eight wheel
events per animation frame for 40 frames, then verifies the resulting camera and
that artwork DOM attributes were not rewritten. Each scenario ran three times.

## Findings and change

Pan already collects wheel deltas and applies them once per frame, including one
surface-matrix read. Zoom processes each wheel event synchronously so successive
anchors and zoom limits compose against the latest camera.

An unminified production CPU profile showed repeated Overmind proxy reads in the
zoom action's camera validation and coordinate calculations. `zoom`, `panCamera`
and `zoomToAnchor` now read the live camera's scale and position into a small plain
value before calling the existing pure camera math. They write results back through
the same state proxy. Values are read afresh for every action, never cached between
events. No wheel scheduling, SVG transform strategy, GPU hints or document data changed.

## Observed production results

Frame timings pool 120 samples per scenario. Script and main-thread task measurements
are mean CDP counter deltas over a run's 320 wheel events, in milliseconds.

| Scenario | Before median | After median | Before p95 | After p95 | Before script | After script | Before task | After task |
| -------- | ------------: | -----------: | ---------: | --------: | ------------: | -----------: | ----------: | ---------: |
| Pan      |          8.30 |         8.30 |       9.40 |      9.60 |         19.36 |        16.19 |       92.71 |      83.92 |
| Zoom     |          8.30 |         8.30 |       9.60 |      9.60 |         87.38 |        62.22 |      208.94 |     161.90 |

JavaScript work fell about 16% for pan and 29% for zoom in these local samples.
Frame timing remained near the display scheduling floor; **this is reduced CPU work,
not a measured frame-rate increase**. Pan still performs 40 matrix reads per run and
zoom 320. These counters describe main-thread work, not GPU duration. The runs were
sequential on one machine; especially the small pan difference should not be treated
as a universal guarantee. Synthetic bursts are reproducible stress input, not a claim
about every mouse or trackpad's event rate.

## Verification and reproduction

The benchmark verifies cumulative pan, reversible anchored zoom and unchanged artwork.
Existing camera/gesture checks cover transformed SVG coordinates, pan batching, slider
position preservation, scale limits, invalid input, zoom rejection during dragging,
touch pinch and ruler/grid alignment. An added mixed-burst check alternates queued pan
with zoom at two anchors in the same task, verifying the final camera composes every
update against the latest camera (pan is applied on the next frame, zoom immediately).

The benchmark is skipped in normal test runs; set `CAMERA_BENCHMARK=1` to run it.

```sh
CAMERA_BENCHMARK=1 pnpm exec playwright test tests/browser/cameraPerformance.spec.ts \
  --headed --workers=1 --repeat-each=3 --trace=off --reporter=json \
  > /tmp/reactor-camera-profile.json
```

The `camera-measurements` JSON attachments contain per-frame timings, surface-matrix
read counts, artwork mutations and CDP script/layout/style/task counter deltas.
`PROFILE_CAMERA=1` additionally attaches a CPU profile; use an unminified production
build for readable function names. Do not compare profiled timings with unprofiled
ones. Headless Chromium on this machine uses software rendering, so use a visible
session and verify GPU status for hardware-backed measurements.
