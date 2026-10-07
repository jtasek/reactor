/**
 * Profiles pressing, dragging and releasing a shape among 3,000 in a running
 * editor, then boxing them with a marquee that takes in more of them at each
 * move, and prints each step's time and the functions that took longest:
 *
 *   node scripts/profile-drag.ts [address]
 *
 * Profile an unminified production build for readable names: build with
 * `NODE_ENV=production node ./node_modules/webpack/bin/webpack --config
 * webpack.config.mjs --no-optimization-minimize --no-performance-hints`, then
 * serve it with `PORT=4431 node server.prod.ts`.
 */
import { chromium, type CDPSession, type Page } from '@playwright/test';

const SHAPE_COUNT = 3000;
const SHAPES_PER_ROW = 60;
const SPACING = 30;
const SIZE = 20;
const MOVES = 10;
const LISTED = 12;
/** On empty canvas, right of and below the pasted shapes in the 1280 by 720 view. */
const EMPTY_CANVAS = { x: 1200, y: 700 };
/** Over the top left of the pasted shapes, where the marquee from `EMPTY_CANVAS` ends. */
const BOX_END = { x: 100, y: 50 };

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

/** Lays out the shapes in rows, every seventh turned, and pastes them. */
async function pasteShapes(page: Page) {
    const shapes = Array.from({ length: SHAPE_COUNT }, (_, index) => ({
        type: 'rectangle',
        name: `r${index}`,
        position: {
            x: (index % SHAPES_PER_ROW) * SPACING,
            y: Math.floor(index / SHAPES_PER_ROW) * SPACING
        },
        size: { width: SIZE, height: SIZE },
        rotation: index % 7 === 0 ? 30 : 0
    }));

    await page.evaluate(
        (text) => navigator.clipboard.writeText(text),
        JSON.stringify({ format: 'reactor/shapes', shapes })
    );
    await page.keyboard.press('ControlOrMeta+v');
    await page.waitForFunction(
        (count) => document.querySelectorAll('svg#surface #shapes > g').length >= count,
        SHAPE_COUNT,
        { timeout: 120_000 }
    );
}

/** The functions that took longest, by their own time and with what they called. */
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
            const name = nodes.get(current)!.callFrame.functionName;

            if (name && !name.startsWith('(') && !seen.has(name)) {
                seen.add(name);
                inclusive.set(name, (inclusive.get(name) ?? 0) + time);
            }
        }
    });

    const top = (times: Map<string, number>) =>
        [...times]
            .filter(([name]) => !name.startsWith('(program)') && !name.startsWith('(idle)'))
            .sort((a, b) => b[1] - a[1])
            .slice(0, LISTED)
            .map(([name, time]) => `    ${time.toFixed(1)} ms  ${name}`)
            .join('\n');

    return `  own time:\n${top(own)}\n  with callees:\n${top(inclusive)}`;
}

async function profileStep(page: Page, cdp: CDPSession, label: string, step: () => Promise<void>) {
    await cdp.send('Profiler.start');

    const started = await page.evaluate(() => performance.now());

    await step();
    // Until the frame the step caused is painted.
    await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)))
    );

    const ended = await page.evaluate(() => performance.now());
    const { profile } = (await cdp.send('Profiler.stop')) as { profile: CpuProfile };

    console.info(`\n${label}: ${(ended - started).toFixed(0)} ms\n${summarize(profile)}`);
}

const browser = await chromium.launch();

try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });

    await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
        origin: new URL(address).origin
    });

    const page = await context.newPage();

    await page.goto(address);

    const surface = page.locator('svg#surface');
    const frame = (await surface.boundingBox())!;
    const pointer = (type: string, x: number, y: number) =>
        surface.dispatchEvent(type, {
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

    // The paste is centered where the canvas was last pressed, its top left, so
    // the shapes fill only the top left of the view; the press on empty canvas
    // then leaves none of them selected.
    await pointer('pointerdown', 5, 5);
    await pointer('pointerup', 5, 5);
    await pasteShapes(page);
    await pointer('pointerdown', EMPTY_CANVAS.x, EMPTY_CANVAS.y);
    await pointer('pointerup', EMPTY_CANVAS.x, EMPTY_CANVAS.y);

    const shape = (await page
        .locator('svg#surface #shapes > g')
        .nth(SHAPE_COUNT / 2)
        .boundingBox())!;
    const x = shape.x - frame.x + shape.width / 2;
    const y = shape.y - frame.y + shape.height / 2;
    const cdp = await context.newCDPSession(page);

    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.setSamplingInterval', { interval: 100 });
    await profileStep(page, cdp, 'press', () => pointer('pointerdown', x, y));
    await profileStep(page, cdp, 'first move', () => pointer('pointermove', x + 20, y + 20));
    await profileStep(page, cdp, `${MOVES} moves`, async () => {
        for (let step = 1; step <= MOVES; step++) {
            await pointer('pointermove', x + 20 + step * 3, y + 20 + step);
        }
    });
    await profileStep(page, cdp, 'release', () => pointer('pointerup', x + 50, y + 30));
    await profileStep(page, cdp, 'box press', () =>
        pointer('pointerdown', EMPTY_CANVAS.x, EMPTY_CANVAS.y)
    );
    await profileStep(page, cdp, `${MOVES} box moves`, async () => {
        for (let step = 1; step <= MOVES; step++) {
            await pointer(
                'pointermove',
                EMPTY_CANVAS.x + ((BOX_END.x - EMPTY_CANVAS.x) * step) / MOVES,
                EMPTY_CANVAS.y + ((BOX_END.y - EMPTY_CANVAS.y) * step) / MOVES
            );
        }
    });
    await profileStep(page, cdp, 'box release', () => pointer('pointerup', BOX_END.x, BOX_END.y));

    // A press that missed empty canvas would have dragged a shape, leaving one selected.
    const boxed = await page.locator('#status-selection').textContent();

    if (Number(/\d+/.exec(boxed ?? '')?.[0] ?? 0) <= 1) {
        throw new Error(
            `The marquee boxed no shapes (${boxed}); the box steps timed another gesture.`
        );
    }
} finally {
    await browser.close();
}
