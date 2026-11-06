import { expect, test } from '@playwright/test';
import { STARTER_TEMPLATES } from 'src/templates/catalog';

for (const template of STARTER_TEMPLATES) {
    test(`repeatedly selects artwork in the ${template.name} starter`, async ({ page }, info) => {
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.goto('/documents');
        await page.getByRole('button', { name: 'Templates', exact: true }).click();
        await page
            .getByRole('button', { name: `Use ${template.name} template`, exact: true })
            .click();
        await expect(page.locator('#screen-views > g').first()).toBeVisible();
        await page.getByRole('button', { name: 'More panels' }).click();
        for (const panel of ['Inspector', 'Explorer']) {
            await page.getByRole('checkbox', { name: panel, exact: true }).check();
        }
        await page.getByRole('button', { name: 'More panels' }).click();
        const availableTargets = () =>
            page.locator('#screen-views [data-shape-id]').evaluateAll((nodes) =>
                nodes
                    .flatMap((node) => {
                        const box = node
                            .querySelector('text[data-cy], [data-view-instance-hit]')
                            ?.getBoundingClientRect();
                        if (!box || !box.width || !box.height) {
                            return [];
                        }
                        const x = box.x + box.width / 2;
                        const y = box.y + box.height / 2;
                        const hit = document.elementFromPoint(x, y)?.closest('[data-shape-id]');
                        if (hit !== node) {
                            return [];
                        }

                        return [
                            {
                                id: node.getAttribute('data-shape-id')!,
                                view: node.getAttribute('data-screen-view')!,
                                x,
                                y
                            }
                        ];
                    })
                    .sort((a, b) => a.x - b.x || a.y - b.y)
            );
        expect((await availableTargets()).length).toBeGreaterThan(1);
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Performance.enable');
        if (process.env.PROFILE_COMPONENT_SELECTION) {
            await cdp.send('Profiler.enable');
            await cdp.send('Profiler.start');
        }
        const before = await cdp.send('Performance.getMetrics');
        const durations: number[] = [];
        const chosen: string[] = [];
        for (let index = 0; index < 16; index++) {
            // Inspector height and selection menus can cover previously available targets.
            const targets = (await availableTargets()).filter(
                (target) => target.id !== chosen.at(-1)
            );
            expect(targets.length).toBeGreaterThan(0);
            const target = targets[index % targets.length];
            chosen.push(target.id);
            const start = Date.now();
            await page.mouse.click(target.x, target.y);
            await expect(
                page.locator(
                    `#screen-views [data-screen-view="${target.view}"][data-shape-id="${target.id}"] > rect[stroke]`
                )
            ).toBeVisible();
            durations.push(Date.now() - start);
        }
        const after = await cdp.send('Performance.getMetrics');
        const script = (metrics: typeof before.metrics) =>
            metrics.find((item) => item.name === 'ScriptDuration')!.value;
        await info.attach('selection-times', {
            body: JSON.stringify({
                durations,
                scriptMs: 1000 * (script(after.metrics) - script(before.metrics))
            }),
            contentType: 'application/json'
        });
        if (process.env.PROFILE_COMPONENT_SELECTION) {
            const { profile } = await cdp.send('Profiler.stop');
            await info.attach('selection-profile', {
                body: JSON.stringify(profile),
                contentType: 'application/json'
            });
        }
    });
}
