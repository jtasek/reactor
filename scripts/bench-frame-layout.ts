/**
 * Times the R4 frame layout spike's projection of one row frame with fixed-size children,
 * as recorded in design/frame-layout-spike.md:
 *
 *   node scripts/bench-frame-layout.ts
 *
 * Isolated projection only: no validation of untrusted input, Yjs merge, store, rendering
 * or hit testing.
 */
import { performance } from 'node:perf_hooks';
import { projectFrameLayout, type LayoutNode } from '../tests/spikes/frameLayout.ts';

const CHILD_COUNTS = [300, 2000];
const WARM_UP_PASSES = 20;
const MEASURED_PASSES = 100;
const P95 = 0.95;
const CHILD_SIZE = 10;

function records(count: number): LayoutNode[] {
    const frame: LayoutNode = {
        id: 'frame',
        kind: 'frame',
        order: 'a',
        x: 0,
        y: 0,
        width: count * CHILD_SIZE,
        height: CHILD_SIZE,
        stack: { direction: 'row', gap: 0, padding: 0, align: 'start' }
    };
    const children = Array.from(
        { length: count },
        (_, index): LayoutNode => ({
            id: `child-${index}`,
            kind: 'shape',
            parentId: 'frame',
            order: `a${String(index).padStart(5, '0')}`,
            x: 0,
            y: 0,
            width: CHILD_SIZE,
            height: CHILD_SIZE
        })
    );

    return [frame, ...children];
}

function percentile(sorted: number[], fraction: number) {
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
}

console.info(`Node ${process.version}`);

for (const count of CHILD_COUNTS) {
    const input = records(count);

    for (let pass = 0; pass < WARM_UP_PASSES; pass++) {
        projectFrameLayout(input);
    }

    const times = Array.from({ length: MEASURED_PASSES }, () => {
        const start = performance.now();
        projectFrameLayout(input);

        return performance.now() - start;
    }).sort((a, b) => a - b);

    console.info(
        `${count} children: median ${percentile(times, 0.5).toFixed(3)} ms, p95 ${percentile(times, P95).toFixed(3)} ms`
    );
}
