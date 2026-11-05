import { expect, test } from '@playwright/test';
import { createDocument, createShape } from 'src/app/factories';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { openEditor } from './support/editor';

const SHAPES = 1000;
const FRAMES = 40;
const EVENTS_PER_FRAME = 8;

// About 7 s of 1,000-shape setup; camera.spec.ts covers the same camera math on every run.
test.skip(
    !process.env.CAMERA_BENCHMARK && !process.env.PROFILE_CAMERA,
    'Set CAMERA_BENCHMARK=1 to run the camera benchmark.'
);

for (const gesture of ['pan', 'zoom'] as const) {
    test(`${gesture}: large canvas preserves artwork during wheel bursts`, async ({
        page
    }, info) => {
        const shapes = Object.fromEntries(
            Array.from({ length: SHAPES }, (_, index) => {
                const id = `shape${index}`;

                return [
                    id,
                    {
                        ...createShape({
                            type: 'rectangle',
                            name: id,
                            order: `a${String(index).padStart(4, '0')}`,
                            position: {
                                x: 40 + (index % 40) * 30,
                                y: 40 + Math.floor(index / 40) * 30
                            },
                            size: { width: 20, height: 20 },
                            selected: index === 0
                        }),
                        id
                    }
                ];
            })
        );
        const fixture = createDocument({ id: 'camera-profile', shapes });
        const saved = serializePersistedState({
            currentDocumentId: fixture.id,
            documents: { [fixture.id]: fixture }
        });
        await page.addInitScript(
            (raw) => localStorage.setItem('reactor', raw),
            JSON.stringify(saved)
        );
        await page.setViewportSize({ width: 1440, height: 1000 });
        await openEditor(page, ['Inspector', 'Explorer']);
        await page.getByRole('button', { name: 'More panels' }).click();
        await expect(page.locator('#shapes [data-cy]')).toHaveCount(SHAPES);
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Performance.enable');
        if (process.env.PROFILE_CAMERA) {
            await cdp.send('Profiler.enable');
            await cdp.send('Profiler.start');
        }
        const before = await cdp.send('Performance.getMetrics');
        const measurement = await page.evaluate(
            async ({ gesture, frames, events }) => {
                const surface = document.querySelector<SVGSVGElement>('#surface')!;
                const timings: number[] = [];
                const changes: MutationRecord[] = [];
                const observer = new MutationObserver((records) => changes.push(...records));
                document
                    .querySelectorAll('#shapes [data-cy]')
                    .forEach((node) =>
                        observer.observe(node, { attributes: true, childList: true, subtree: true })
                    );
                const original = surface.getScreenCTM;
                let matrixReads = 0;
                surface.getScreenCTM = () => {
                    matrixReads++;

                    return original.call(surface);
                };
                try {
                    for (let frame = 0; frame < frames; frame++) {
                        const start = performance.now();
                        for (let event = 0; event < events; event++) {
                            surface.dispatchEvent(
                                new WheelEvent('wheel', {
                                    bubbles: true,
                                    cancelable: true,
                                    ctrlKey: gesture === 'zoom',
                                    clientX: 700,
                                    clientY: 450,
                                    deltaX: gesture === 'pan' ? 1 : 0,
                                    deltaY:
                                        gesture === 'pan' ? 0.5 : frame < frames / 2 ? -0.5 : 0.5
                                })
                            );
                        }
                        await new Promise((resolve) =>
                            requestAnimationFrame(() => setTimeout(resolve, 0))
                        );
                        timings.push(performance.now() - start);
                    }
                } finally {
                    surface.getScreenCTM = original;
                    changes.push(...observer.takeRecords());
                    observer.disconnect();
                }

                return { timings, matrixReads, artworkMutations: changes.length };
            },
            { gesture, frames: FRAMES, events: EVENTS_PER_FRAME }
        );
        const after = await cdp.send('Performance.getMetrics');
        const metrics = Object.fromEntries(
            after.metrics
                .filter(({ name }) =>
                    [
                        'ScriptDuration',
                        'LayoutDuration',
                        'RecalcStyleDuration',
                        'TaskDuration'
                    ].includes(name)
                )
                .map(({ name, value }) => [
                    name,
                    1000 * (value - (before.metrics.find((item) => item.name === name)?.value ?? 0))
                ])
        );
        await info.attach('camera-measurements', {
            body: JSON.stringify({ ...measurement, metrics }),
            contentType: 'application/json'
        });
        if (process.env.PROFILE_CAMERA) {
            const { profile } = await cdp.send('Profiler.stop');
            await info.attach('camera-profile', {
                body: JSON.stringify(profile),
                contentType: 'application/json'
            });
        }
        expect(measurement.artworkMutations).toBe(0);
        const matrix = await page.locator('#camera').evaluate((node) => {
            const matrix = (node as SVGGElement).transform.baseVal.consolidate()!.matrix;

            return { scale: matrix.a, x: matrix.e, y: matrix.f };
        });
        expect(matrix.scale).toBeCloseTo(1, 6);
        expect(matrix.x).toBeCloseTo(gesture === 'pan' ? -FRAMES * EVENTS_PER_FRAME : 0, 4);
        expect(matrix.y).toBeCloseTo(gesture === 'pan' ? (-FRAMES * EVENTS_PER_FRAME) / 2 : 0, 4);
    });
}
