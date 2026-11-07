# Typography verification

PR #469 keeps interface typography separate from authored artwork. The shared SVG
thumbnail renderer explicitly uses `--font-content`, matching canvas text measurement.
Touch inputs have a 16px accessibility floor even when component font shorthands apply;
canvas text editors retain their authored size. `typography.spec.ts` checks these
boundaries and the Variables workspace at 390px wide.

Density defaults now live in `static/styles/site.css` and `design/tokens.json`:
controls 22px, list rows and panel titles 28px, section spacing 12px, card spacing
10px and row spacing 3px. Component-specific overrides remain supported.

## Glass comparison — 7 November 2026

Production Chromium, headed, Apple M1 Pro with ANGLE Metal and GPU compositing
enabled. Inspector and Explorer were open over 1,000 rectangles. Each gesture
sent eight synthetic events per frame for 40 frames, repeated three times per
blur setting. Opacity stayed at 82% and saturation at 180%; only blur changed.
All 18 runs passed their movement/artwork assertions.

| Gesture | 5px median / p95 interval | 24px median / p95 interval |
| --- | --- | --- |
| Pan | 8.3 / 9.7 ms | 8.3 / 9.5 ms |
| Zoom | 8.3 / 9.3 ms | 8.3 / 9.1 ms |
| Drag | 8.3 / 11.0 ms | 8.3 / 12.1 ms |

Mean total script time per run was respectively 20.45 / 20.54 ms for pan,
63.37 / 62.89 ms for zoom, and 206.87 / 210.27 ms for drag (5px / 24px).
These results do not demonstrate a material regression, so the 24px design stays.

Intervals measure event handling plus animation-frame scheduling, not GPU time
or physical input latency. All 5px runs preceded the 24px runs; these are small
samples on one machine, not a cross-device performance guarantee. Slower GPUs
still need separate measurement.

Reproduce with `CAMERA_BENCHMARK=1 GLASS_BLUR=5 pnpm exec playwright test
tests/browser/cameraPerformance.spec.ts --headed --workers=1 --repeat-each=3`,
then repeat with `GLASS_BLUR=24`. Each result includes timing and graphics
attachments. `PROFILE_CAMERA=1` additionally records a CPU profile.
