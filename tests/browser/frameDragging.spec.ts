import { test, expect } from '@playwright/test';
import { createDocument, createShape } from 'src/app/factories';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { expectPlacedCoordinate, openEditor, pointer } from './support/editor';

const rendering = process.env.PROFILE_RENDERING
    ? ['baseline', 'surface-layer', 'no-glass']
    : ['baseline'];

const scenarios = rendering.flatMap((experiment) =>
    ['ordinary', 'view0'].map((target) => ({ experiment, target }))
);

for (const { experiment, target } of scenarios) {
    test(`${experiment} ${target}: dragging keeps screen artwork stable and cancellation restores geometry`, async ({
        page
    }, testInfo) => {
        const box = {
            position: { x: 100, y: 100 },
            size: { width: 400, height: 500 },
            visible: true,
            locked: false
        };
        const shapes = Object.fromEntries(
            Array.from({ length: 200 }, (_, i) => {
                const id = `shape${i}`;

                return [
                    id,
                    {
                        ...createShape({
                            type: 'rectangle',
                            name: id,
                            order: `a${String(i).padStart(3, '0')}`,
                            parentFrameId: i < 100 ? 'screen' : 'ordinary',
                            position: {
                                x: 120 + (i % 10) * 25,
                                y: 130 + Math.floor((i % 100) / 10) * 25
                            },
                            size: { width: 20, height: 20 },
                            selected: false
                        }),
                        id
                    }
                ];
            })
        );
        const designDocument = createDocument({
            id: 'profile',
            shapes,
            frames: {
                screen: {
                    ...box,
                    id: 'screen',
                    name: 'Home',
                    kind: 'screen',
                    definitionOnly: true
                },
                ordinary: { ...box, id: 'ordinary', name: 'Frame', kind: 'frame' },
                ...Object.fromEntries(
                    Array.from({ length: 4 }, (_, i) => [
                        `view${i}`,
                        {
                            ...box,
                            id: `view${i}`,
                            name: `View ${i}`,
                            kind: 'view' as const,
                            screenId: 'screen',
                            position: { x: 550 + i * 420, y: 100 }
                        }
                    ])
                )
            }
        });
        const saved = serializePersistedState({
            currentDocumentId: designDocument.id,
            documents: { [designDocument.id]: designDocument }
        });
        await page.addInitScript((raw) => {
            localStorage.setItem('reactor', raw);
            localStorage.setItem('reactor:notices', '["first","many"]');
        }, JSON.stringify(saved));
        await page.addInitScript(() => {
            const measurements = { child: 0 };
            Object.assign(window, { frameDragMeasurements: measurements });
            const getBBox = SVGGraphicsElement.prototype.getBBox;
            SVGGraphicsElement.prototype.getBBox = function (...args) {
                if (this.querySelector('[data-cy="shape100"]')) {
                    measurements.child++;
                }

                return getBBox.apply(this, args);
            };
        });
        await openEditor(page, ['Inspector', 'Explorer']);
        await page.getByRole('button', { name: 'More panels' }).click();
        await expect(page.locator('#frames > [data-frame="view0"]')).toBeVisible();
        const cdp = await page.context().newCDPSession(page);
        if (experiment === 'surface-layer') {
            await page.addStyleTag({ content: '#surface { will-change: transform; }' });
        }
        if (experiment === 'no-glass') {
            await page.addStyleTag({ content: '* { backdrop-filter: none !important; }' });
        }
        await cdp.send('Performance.enable');

        if (process.env.PROFILE_FRAME_DRAG) {
            await cdp.send('Profiler.enable');
            await cdp.send('Profiler.setSamplingInterval', { interval: 100 });
        }
        const measuredChild = () =>
            page.evaluate(
                () =>
                    (window as unknown as { frameDragMeasurements: { child: number } })
                        .frameDragMeasurements.child
            );
        const initialMeasurements = await measuredChild();
        const x = target === 'ordinary' ? 100 : 550;
        await pointer(page, 'pointerdown', {
            x,
            y: 100,
            target: `#frame-grips [data-frame-id="${target}"]`
        });
        await pointer(page, 'pointermove', { x: x + 10, y: 110 });
        if (process.env.PROFILE_FRAME_DRAG) {
            await cdp.send('Profiler.start');
        }
        const beforeMetrics = await cdp.send('Performance.getMetrics');
        const measurement = await page.evaluate(
            async ({ x }) => {
                const surface = document.querySelector('svg#surface')!;
                const box = surface.getBoundingClientRect();
                const times: number[] = [];
                const mutations: MutationRecord[] = [];
                const observer = new MutationObserver((records) => mutations.push(...records));
                document.querySelectorAll('#screen-views [data-shape-id]').forEach((shape) => {
                    observer.observe(shape, {
                        attributes: true,
                        childList: true,
                        characterData: true,
                        subtree: true
                    });
                });
                for (let i = 1; i <= 30; i++) {
                    const start = performance.now();
                    surface.dispatchEvent(
                        new PointerEvent('pointermove', {
                            bubbles: true,
                            cancelable: true,
                            pointerId: 1,
                            pointerType: 'mouse',
                            isPrimary: true,
                            button: 0,
                            buttons: 1,
                            clientX: box.x + x + 10 + i * 2,
                            clientY: box.y + 110 + i
                        })
                    );
                    await new Promise((resolve) =>
                        requestAnimationFrame(() => setTimeout(resolve, 0))
                    );
                    times.push(performance.now() - start);
                }
                mutations.push(...observer.takeRecords());
                observer.disconnect();

                return { timings: times, artworkMutations: mutations.length };
            },
            { x }
        );
        if (process.env.PROFILE_FRAME_DRAG) {
            const { profile } = await cdp.send('Profiler.stop');
            await testInfo.attach('drag-profile', {
                body: JSON.stringify(profile),
                contentType: 'application/json'
            });
        }
        const afterMetrics = await cdp.send('Performance.getMetrics');
        const metrics = Object.fromEntries(
            afterMetrics.metrics
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
                    (value -
                        (beforeMetrics.metrics.find((metric) => metric.name === name)?.value ??
                            0)) *
                        1000
                ])
        );
        await testInfo.attach('drag-measurements', {
            body: JSON.stringify({ ...measurement, experiment, metrics }),
            contentType: 'application/json'
        });
        expect(measurement.artworkMutations).toBe(0);
        expect(await measuredChild()).toBe(initialMeasurements);
        if (process.env.PROFILE_FRAME_DRAG && target === 'view0') {
            await page.screenshot({ path: testInfo.outputPath('dragging-screen-view.png') });
        }
        const edge = page.locator(`#frames > [data-frame="${target}"] > [data-type="move"] > rect`);
        await expect(edge).toHaveAttribute('x', String(x + 70));
        const child =
            target === 'ordinary'
                ? page.locator('#shapes [data-cy="shape100"]')
                : page.locator('#screen-views > [data-screen-view="view0"] [data-cy="shape0"]');
        await expectPlacedCoordinate(child, 'x', target === 'ordinary' ? 190 : 640);
        await pointer(page, 'pointercancel', { x: x + 70, y: 140 });
        await expect(edge).toHaveAttribute('x', String(x));
        await expectPlacedCoordinate(child, 'x', target === 'ordinary' ? 120 : 570);
        await pointer(page, 'pointerdown', {
            x,
            y: 100,
            target: `#frame-grips [data-frame-id="${target}"]`
        });
        await pointer(page, 'pointermove', { x: x + 20, y: 120 });
        await pointer(page, 'pointerup', { x: x + 30, y: 130 });
        await expect(edge).toHaveAttribute('x', String(x + 30));
        if (target === 'ordinary') {
            await expect.poll(measuredChild).toBeGreaterThan(initialMeasurements);
        }
        await expectPlacedCoordinate(child, 'x', target === 'ordinary' ? 150 : 600);
        await expect(page.locator('#status-save')).toHaveText('Saved');
        await page.reload();
        await expect(edge).toHaveAttribute('x', String(x + 30));
        await expectPlacedCoordinate(child, 'x', target === 'ordinary' ? 150 : 600);
    });
}
