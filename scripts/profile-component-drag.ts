/**
 * Profiles dragging a component instance on a canvas with other shapes and
 * other instances of the same component, and prints each step's time and the
 * functions that took longest:
 *
 *   node scripts/profile-component-drag.ts [address]
 *
 * Build and serve as for `scripts/profile-drag.ts`. BACKGROUND sets how many
 * plain rectangles share the canvas, INSTANCES how many instances are pasted,
 * and PARTS how many shapes the component has. SOURCE=1 opens the component's
 * source and drags its first shape instead, which every instance follows.
 */
import { chromium, type CDPSession, type Page } from '@playwright/test';

const BACKGROUND = Number(process.env.BACKGROUND ?? 1000);
const INSTANCES = Number(process.env.INSTANCES ?? 40);
const PARTS = Number(process.env.PARTS ?? 8);
const MOVES = 20;
const LISTED = 15;

interface ProfileNode {
    id: number;
    callFrame: { functionName: string; url: string; lineNumber: number };
    children?: number[];
}

interface CpuProfile {
    nodes: ProfileNode[];
    samples: number[];
    timeDeltas: number[];
}

const address = process.argv[2] ?? 'http://127.0.0.1:4431/';

async function paste(page: Page, shapes: unknown[]) {
    await page.evaluate(
        (text) => navigator.clipboard.writeText(text),
        JSON.stringify({ format: 'reactor/shapes', shapes })
    );
    await page.keyboard.press('ControlOrMeta+v');
}

function summarize(profile: CpuProfile) {
    const nodes = new Map(profile.nodes.map((node) => [node.id, node]));
    const parents = new Map<number, number>();
    const own = new Map<string, number>();
    const inclusive = new Map<string, number>();

    profile.nodes.forEach((node) => node.children?.forEach((child) => parents.set(child, node.id)));
    profile.samples.forEach((id, index) => {
        const time = (profile.timeDeltas[index] ?? 0) / 1000;
        const { functionName, url, lineNumber } = nodes.get(id)!.callFrame;
        const named = `${functionName || '(anonymous)'} ${url.split('/').pop()}:${lineNumber + 1}`;
        const seen = new Set<string>();

        own.set(named, (own.get(named) ?? 0) + time);

        for (
            let current: number | undefined = id;
            current !== undefined;
            current = parents.get(current)
        ) {
            const frame = nodes.get(current)!.callFrame;
            const name = frame.functionName
                ? `${frame.functionName} ${frame.url.split('/').pop()}:${frame.lineNumber + 1}`
                : '';

            if (name && !name.startsWith('(') && !seen.has(name)) {
                seen.add(name);
                inclusive.set(name, (inclusive.get(name) ?? 0) + time);
            }
        }
    });

    const top = (times: Map<string, number>, listed: number) =>
        [...times]
            .filter(([name]) => !name.startsWith('(program)') && !name.startsWith('(idle)'))
            .sort((a, b) => b[1] - a[1])
            .slice(0, listed)
            .map(([name, time]) => `    ${time.toFixed(1)} ms  ${name}`)
            .join('\n');

    return `  own time:\n${top(own, LISTED)}\n  with callees:\n${top(inclusive, LISTED * 3)}`;
}

async function profileStep(page: Page, cdp: CDPSession, label: string, step: () => Promise<void>) {
    await cdp.send('Profiler.start');

    const started = await page.evaluate(() => performance.now());

    await step();
    await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)))
    );

    const ended = await page.evaluate(() => performance.now());
    const { profile } = (await cdp.send('Profiler.stop')) as { profile: CpuProfile };

    console.info(`\n${label}: ${(ended - started).toFixed(0)} ms\n${summarize(profile)}`);
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });

    await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
        origin: new URL(address).origin
    });

    const page = await context.newPage();

    await page.goto(address);

    const surface = page.locator('svg#surface');
    const frame = (await surface.boundingBox())!;
    const surfaceHandle = (await surface.elementHandle())!;
    const pointer = (type: string, x: number, y: number) =>
        surfaceHandle.dispatchEvent(type, {
            bubbles: true,
            cancelable: true,
            pointerId: 1,
            pointerType: 'mouse',
            isPrimary: true,
            button: 0,
            buttons: type === 'pointerup' ? 0 : 1,
            clientX: frame.x + x,
            clientY: frame.y + y
        });
    const nextFrame = () =>
        page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    const click = async (x: number, y: number) => {
        await pointer('pointerdown', x, y);
        await pointer('pointerup', x, y);
    };
    const shapeCount = () => page.locator('svg#surface #shapes > g').count();

    // Plain rectangles in the left part of the view.
    await click(5, 5);
    await paste(
        page,
        Array.from({ length: BACKGROUND }, (_, index) => ({
            type: 'rectangle',
            name: `r${index}`,
            position: { x: (index % 40) * 12, y: Math.floor(index / 40) * 12 },
            size: { width: 8, height: 8 },
            rotation: 0
        }))
    );
    await page.waitForFunction(
        (count) => document.querySelectorAll('svg#surface #shapes > g').length >= count,
        BACKGROUND,
        { timeout: 120_000 }
    );

    // The component's parts, pasted and selected, then made into a component.
    await click(450, 250);
    await paste(page, [
        ...Array.from({ length: PARTS - 1 }, (_, index) => ({
            type: 'rectangle',
            name: `part${index}`,
            position: { x: (index % 4) * 14, y: Math.floor(index / 4) * 14 },
            size: { width: 12, height: 12 },
            rotation: 0
        })),
        {
            type: 'text',
            name: 'label',
            value: 'Label',
            fontSize: 12,
            position: { x: 0, y: 40 },
            rotation: 0
        }
    ]);
    await page.waitForFunction(
        (count) => document.querySelectorAll('svg#surface #shapes > g').length >= count,
        BACKGROUND + PARTS
    );
    await page.keyboard.press('ControlOrMeta+Alt+c');
    await page.waitForFunction(
        (count) => document.querySelectorAll('svg#surface #shapes > g').length <= count,
        BACKGROUND + 1
    );

    const instance = page.locator('svg#surface #shapes > g').last().locator('rect').first();
    const box = (await instance.boundingBox())!;
    const copyFrom = { x: box.x - frame.x + box.width / 2, y: box.y - frame.y + box.height / 2 };
    // TARGET=rectangle drags a plain rectangle instead, for comparison.
    const target =
        process.env.TARGET === 'rectangle'
            ? page
                  .locator('svg#surface #shapes > g')
                  .nth(BACKGROUND / 2)
                  .locator('rect')
                  .first()
            : instance;
    const targetBox = (await target.boundingBox())!;
    const start = {
        x: targetBox.x - frame.x + targetBox.width / 2,
        y: targetBox.y - frame.y + targetBox.height / 2
    };

    await click(copyFrom.x, copyFrom.y);
    await page.keyboard.press('ControlOrMeta+c');

    for (let index = 1; index < INSTANCES; index++) {
        await click(620 + (index % 8) * 70, 300 + Math.floor(index / 8) * 70);
        await page.keyboard.press('ControlOrMeta+v');
    }
    await page.waitForFunction(
        (count) => document.querySelectorAll('svg#surface #shapes > g').length >= count,
        BACKGROUND + INSTANCES
    );
    console.info(`${await shapeCount()} shapes on canvas`);
    await click(1250, 700);

    // Editing the source drags one of its shapes, which every instance follows.
    if (process.env.SOURCE) {
        await click(start.x, start.y);
        await page.mouse.click(frame.x + start.x, frame.y + start.y, { button: 'right' });
        await page.getByRole('menuitem', { name: 'Select component source' }).click();
    }

    const cdp = await context.newCDPSession(page);

    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.setSamplingInterval', { interval: 100 });

    const { x, y } = start;

    await profileStep(page, cdp, 'press', () => pointer('pointerdown', x, y));
    await profileStep(page, cdp, 'first move', () => pointer('pointermove', x + 10, y + 10));
    // One move a frame, as a pointer sends them.
    await profileStep(page, cdp, `${MOVES} moves`, async () => {
        for (let step = 1; step <= MOVES; step++) {
            await pointer('pointermove', x + 10 + step * 3, y + 10 + step);
            await nextFrame();
        }
    });
    await profileStep(page, cdp, 'release', () =>
        pointer('pointerup', x + 10 + MOVES * 3, y + 10 + MOVES)
    );
} finally {
    await browser.close();
}
