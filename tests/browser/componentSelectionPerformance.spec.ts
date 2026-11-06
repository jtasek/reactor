import { expect, test } from '@playwright/test';
import { createComponent, createDocument, createShape } from 'src/app/factories';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { openEditor } from './support/editor';

test('selects component instances in a populated Screen view', async ({ page }, info) => {
    const parts = Array.from({ length: 8 }, (_, index) =>
        createShape({
            type: 'rectangle',
            name: `Part ${index}`,
            order: `a${index}`,
            position: { x: (index % 4) * 12, y: Math.floor(index / 4) * 12 },
            size: { width: 10, height: 10 },
            selected: false
        })
    );
    const instances = Array.from({ length: 60 }, (_, index) =>
        createShape({
            type: 'instance',
            name: `Card ${index}`,
            order: `b${String(index).padStart(3, '0')}`,
            componentId: 'card',
            parentFrameId: 'home',
            overrides: {},
            position: { x: 100 + (index % 10) * 60, y: 100 + Math.floor(index / 10) * 50 },
            selected: false
        })
    );
    const fixture = createDocument({
        id: 'selection-performance',
        shapes: Object.fromEntries([...parts, ...instances].map((shape) => [shape.id, shape])),
        components: {
            card: createComponent({
                id: 'card',
                name: 'Card',
                sourceOnly: true,
                shapesIds: parts.map((shape) => shape.id)
            })
        },
        frames: {
            home: {
                id: 'home',
                name: 'Home',
                kind: 'screen',
                definitionOnly: true,
                position: { x: 80, y: 80 },
                size: { width: 680, height: 400 },
                visible: true,
                locked: false
            },
            ...Object.fromEntries(
                Array.from({ length: 3 }, (_, index) => [
                    `view${index}`,
                    {
                        id: `view${index}`,
                        name: `View ${index}`,
                        kind: 'view' as const,
                        screenId: 'home',
                        position: { x: 80 + index * 720, y: 80 },
                        size: { width: 680, height: 400 },
                        visible: true,
                        locked: false
                    }
                ])
            )
        }
    });
    const saved = serializePersistedState({
        currentDocumentId: fixture.id,
        documents: { [fixture.id]: fixture }
    });
    await page.addInitScript((raw) => localStorage.setItem('reactor', raw), JSON.stringify(saved));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openEditor(page, ['Inspector', 'Explorer']);
    await page.getByRole('button', { name: 'More panels' }).click();
    const view = page.locator('#screen-views > [data-screen-view="view0"]');
    await expect(view.locator('[data-view-instance-hit]')).toHaveCount(60);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Performance.enable');
    if (process.env.PROFILE_COMPONENT_SELECTION) {
        await cdp.send('Profiler.enable');
        await cdp.send('Profiler.start');
    }
    const before = await cdp.send('Performance.getMetrics');
    const durations: number[] = [];
    for (const index of [0, 1, 2, 3]) {
        const box = (await view
            .locator(`[data-shape-id="${instances[index].id}"] [data-view-instance-hit]`)
            .boundingBox())!;
        const start = Date.now();
        await view
            .locator(`[data-shape-id="${instances[index].id}"] [data-view-instance-hit]`)
            .dispatchEvent('pointerdown', {
                pointerId: 1,
                pointerType: 'mouse',
                button: 0,
                buttons: 1,
                clientX: box.x + 4,
                clientY: box.y + 4,
                bubbles: true
            });
        await page.locator('#surface').dispatchEvent('pointerup', {
            pointerId: 1,
            pointerType: 'mouse',
            button: 0,
            buttons: 0,
            clientX: box.x + 4,
            clientY: box.y + 4,
            bubbles: true
        });
        await expect(
            view.locator(`[data-shape-id="${instances[index].id}"] > rect[stroke]`)
        ).toBeVisible();
        durations.push(Date.now() - start);
    }
    const after = await cdp.send('Performance.getMetrics');
    const scriptTime = (metrics: typeof before.metrics) =>
        metrics.find((metric) => metric.name === 'ScriptDuration')!.value;
    await info.attach('selection-script-ms', {
        body: JSON.stringify(1000 * (scriptTime(after.metrics) - scriptTime(before.metrics))),
        contentType: 'application/json'
    });
    if (process.env.PROFILE_COMPONENT_SELECTION) {
        const { profile } = await cdp.send('Profiler.stop');
        await info.attach('selection-profile', {
            body: JSON.stringify(profile),
            contentType: 'application/json'
        });
    }
    await info.attach('selection-times', {
        body: JSON.stringify(durations),
        contentType: 'application/json'
    });
});
