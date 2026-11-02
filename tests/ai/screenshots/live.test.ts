import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { chromium, type Browser } from '@playwright/test';
import { json } from 'overmind';
import { propose } from 'src/ai/client';
import { documentContext } from 'src/ai/context';
import { authoringKeys } from 'src/app/screenAuthoring';
import { projectSvg, serializeSvg } from 'src/export/svg';
import { readEntity } from 'src/app/services/documentStorage';
import type { Document } from 'src/app/types';
import { providerFromEnv } from '../../../server/ai';
import type { Usage } from '../../../server/aiTasks';
import { recordResponse } from '../record';
import type { StreamEvent } from '../replay';
import { startHarness } from '../harness';
import { evaluationReport, type EvalSample } from '../report';
import { createTestStore } from '../../support/store';
import {
    createCopies,
    settle,
    sharedContent,
    shownDocument,
    DOCUMENT_ID
} from '../../support/collaboration';
import {
    isolatedDocument,
    screenshotReferences,
    reusedControls,
    repeatedScreenText,
    unboundPaletteColors
} from './references';

const PREPARE = process.env.AI_SCREENSHOT_PREPARE === '1';
const LIVE = process.env.AI_SCREENSHOT_EVAL === '1';
const OUTPUT = resolve(process.env.AI_SCREENSHOT_OUTPUT ?? 'test-results/ai-screenshots');
const TIMEOUT_MS = 125_000;
const references = screenshotReferences();
const escape = (text: string) =>
    text.replace(
        /[&<>"']/g,
        (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!
    );

interface Sample extends EvalSample {
    reuse: { matched: number; expected: number } | null;
    unboundPaletteColors: string[] | null;
    rendered: boolean;
}

const content = (copy: Parameters<typeof sharedContent>[0]) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { fields, ...entities } = sharedContent(copy);

    return entities;
};

/** The real SVG export path and Chromium, at 1x with the same local font fallback on both sides. */
async function render(
    browser: Browser,
    document: Document,
    viewId: string,
    folder: string,
    name: string
) {
    const { store } = createTestStore();
    store.actions.addDocument(isolatedDocument(document));
    store.actions.openDocument(document.id);
    store.actions.editFrame({ kind: 'select', id: viewId });
    const drawing = projectSvg(store.state);
    const svg = serializeSvg({ ...drawing, images: {} });
    writeFileSync(join(folder, `${name}.svg`), svg);
    const page = await browser.newPage({
        viewport: { width: 480, height: 640 },
        deviceScaleFactor: 1
    });
    try {
        await page.route('**/*', (route) => route.abort());
        await page.setContent(
            `<style>body{margin:0;background:white}</style>${svg.replace(/^<\?xml[^>]*>/, '')}`
        );
        await page.evaluate(() => globalThis.document.fonts.ready);
        await page.screenshot({ path: join(folder, `${name}.png`) });
    } finally {
        await page.close();
    }

    return svg;
}

describe.skipIf(!PREPARE && !LIVE)('template screenshot benchmark', () => {
    let browser: Browser;
    let harness: Awaited<ReturnType<typeof startHarness>> | undefined;
    const samples: Sample[] = [];
    const hashes: string[] = [];
    const rounds: StreamEvent[][] = [];
    const provider = LIVE
        ? providerFromEnv(process.env, async (url, init) =>
              recordResponse(await fetch(url, init), rounds)
          )
        : undefined;

    function save() {
        const suite = createHash('sha256').update(JSON.stringify(hashes)).digest('hex');
        const report = evaluationReport(
            process.env.AI_PROVIDER ?? '',
            provider?.model('edit') ?? '',
            suite,
            samples
        );
        writeFileSync(
            join(OUTPUT, 'report.json'),
            JSON.stringify(
                {
                    ...report,
                    kind: LIVE ? 'live' : 'prepared',
                    expectedCases: 30,
                    complete: samples.length === 30,
                    scope: '12 starter screens, 12 palette variants, 6 copy variants; correlated synthetic designs',
                    humanQuality: 'unrated',
                    colorDeltaE:
                        'CIE76 ≤ 2 for matching authored colors; pixel-level reproduction remains human-rated',
                    samples
                },
                null,
                2
            )
        );
        const cards = samples
            .map(
                (sample) =>
                    `<article><h2>${escape(sample.name)}</h2><div><figure><img src="${sample.name}/reference.png"><figcaption>Reference</figcaption></figure>${sample.rendered ? `<figure><img src="${sample.name}/generated.png"><figcaption>Generated</figcaption></figure>` : '<p>No generated rendering</p>'}</div><p>${escape(sample.problems.join(' · ') || (LIVE ? 'Automated checks passed; human review still required.' : 'Prepared; not evaluated.'))}</p></article>`
            )
            .join('');
        writeFileSync(
            join(OUTPUT, 'index.html'),
            `<!doctype html><meta charset="utf-8"><title>Reactor screenshot evaluation</title><style>body{font:16px system-ui;margin:32px;background:#eee;color:#222}article{background:white;padding:24px;margin:24px 0}article div{display:flex;flex-wrap:wrap;gap:20px}figure{margin:0}img{max-width:100%;width:480px;border:1px solid #aaa}figcaption{padding:8px}</style><h1>Template screenshot evaluation</h1><p>30 correlated cases from 12 Reactor starter screens. ${LIVE ? 'Live model results' : 'Preparation only'}. Human quality is unrated. No general-design quality claim.</p>${cards}`
        );
    }

    beforeAll(async () => {
        // Never overwrite evidence from a previous run.
        if (existsSync(join(OUTPUT, 'report.json'))) {
            throw new Error('Choose a fresh AI_SCREENSHOT_OUTPUT directory.');
        }
        mkdirSync(OUTPUT, { recursive: true });
        browser = await chromium.launch();
        if (LIVE) {
            harness = await startHarness();
        }
        writeFileSync(
            join(OUTPUT, 'ratings.json'),
            JSON.stringify(
                references.map(({ name }) => ({
                    name,
                    reviewers: [
                        { reviewer: '', usableStart: null, notes: '' },
                        { reviewer: '', usableStart: null, notes: '' }
                    ]
                })),
                null,
                2
            )
        );
    });
    afterAll(async () => {
        await harness?.close();
        await browser?.close();
        if (LIVE) {
            expect(samples).toHaveLength(30);
            expect(samples.filter((sample) => !sample.passed).map((sample) => sample.name)).toEqual(
                []
            );
        }
    });

    it.each(references)(
        '$name',
        async (reference) => {
            rounds.length = 0;
            const folder = join(OUTPUT, reference.name);
            mkdirSync(folder, { recursive: true });
            const svg = await render(
                browser,
                reference.target,
                reference.viewId,
                folder,
                'reference'
            );
            const context = documentContext({ ...reference.seed, selectedShapesIds: [] });
            const prompt = `Recreate the attached screenshot as one editable screen named Screenshot and one Screen view, both 480 by 640, at x=0 y=0. Match its visible text, geometry and colors. Reuse the supplied Button and Text field components with label/placeholder overrides wherever appropriate. Bind matching colors to the supplied variables. Do not change the supplied library. Do not add navigation or other screens.`;
            hashes.push(
                createHash('sha256')
                    .update(reference.name)
                    .update(svg)
                    .update(JSON.stringify(context))
                    .update(prompt)
                    .digest('hex')
            );
            writeFileSync(join(folder, 'input.json'), JSON.stringify({ prompt, context }, null, 2));
            const sample: Sample = {
                name: reference.name,
                firstValid: false,
                finalValid: false,
                passed: false,
                firstOperationMs: null,
                durationMs: 0,
                usage: null,
                problems: [],
                reuse: null,
                unboundPaletteColors: null,
                rendered: false
            };
            if (!LIVE) {
                samples.push(sample);
                save();

                return;
            }
            const copies = await createCopies(2, (store) =>
                store.actions.addDocument(isolatedDocument(reference.seed))
            );
            const [a, b] = copies;
            const before = content(a);
            let repaired = false;
            const usages: Usage[] = [];
            let usageMissing = false;
            harness!.answerWith({
                model: provider!.model,
                async turn(conversation, signal, on) {
                    let observed = false;
                    try {
                        return await provider!.turn(conversation, signal, {
                            ...on,
                            usage(value) {
                                observed = true;
                                usages.push(value);
                                on.usage(value);
                            }
                        });
                    } finally {
                        usageMissing ||= !observed;
                    }
                }
            });
            const documentId = await harness!.createServerDocument();
            const started = performance.now();
            try {
                const result = await propose({
                    reservedKeys: authoringKeys(shownDocument(a)),
                    send: harness!.send,
                    documentId,
                    request: {
                        task: 'edit',
                        prompt,
                        context,
                        image: {
                            data: readFileSync(join(folder, 'reference.png')).toString('base64')
                        }
                    },
                    check: (operations) =>
                        a.store.actions.checkOperations({ documentId: DOCUMENT_ID, operations }),
                    signal: AbortSignal.timeout(TIMEOUT_MS - 10_000),
                    onEvent(event) {
                        if (event.type === 'repairing') {
                            repaired = true;
                        }
                        if (event.type === 'operation' && sample.firstOperationMs === null) {
                            sample.firstOperationMs = performance.now() - started;
                        }
                    }
                });
                sample.durationMs = performance.now() - started;
                writeFileSync(join(folder, 'proposal.json'), JSON.stringify(result, null, 2));
                settle(copies);
                expect(content(a)).toEqual(before);
                expect(content(b)).toEqual(before);
                sample.finalValid = result.kind === 'proposed';
                sample.firstValid = sample.finalValid && !repaired;
                if (result.kind !== 'proposed') {
                    sample.problems.push(`No accepted proposal: ${JSON.stringify(result)}`);

                    return;
                }
                const by = {
                    kind: 'ai' as const,
                    model: result.model,
                    requestId: result.requestId
                };
                expect(
                    a.store.actions.applyOperations({
                        documentId: DOCUMENT_ID,
                        by,
                        operations: result.operations
                    })
                ).toMatchObject({ applied: true });
                settle(copies);
                expect(content(b)).toEqual(content(a));
                const document: Document = json(shownDocument(a));
                expect(document.components).toEqual(reference.seed.components);
                Object.keys(reference.seed.shapes).forEach((id) => {
                    expect(readEntity('shapes', document.shapes[id])).toEqual(
                        readEntity('shapes', reference.seed.shapes[id])
                    );
                });
                const views = Object.values(document.frames).filter(
                    (frame) => frame.kind === 'view'
                );
                if (
                    views.length !== 1 ||
                    Object.values(document.frames).filter((frame) => frame.kind === 'screen')
                        .length !== 1
                ) {
                    sample.problems.push('Expected exactly one screen and one view.');
                }
                const view = views[0];
                if (view) {
                    if (view.size.width !== 480 || view.size.height !== 640) {
                        sample.problems.push('Expected a 480 × 640 view.');
                    }
                    await render(browser, document, view.id, folder, 'generated');
                    sample.rendered = true;
                }
                sample.reuse = {
                    matched: reusedControls(
                        document,
                        reference.expectedControls,
                        Object.keys(reference.seed.components)
                    ),
                    expected: reference.labels.length
                };
                const generated = Object.values(document.shapes).filter(
                    (shape) => !reference.seed.shapes[shape.id]
                );
                const repeated = repeatedScreenText(
                    generated,
                    Object.values(reference.target.shapes).filter(
                        (shape) =>
                            shape.parentFrameId ===
                            reference.target.frames[reference.viewId].screenId
                    )
                );
                if (repeated.length) {
                    sample.problems.push(`Repeated screen text: ${repeated.join('; ')}`);
                }
                if (!generated.some((shape) => shape.parentFrameId)) {
                    sample.problems.push('No generated artwork belongs to the screen.');
                }
                sample.unboundPaletteColors = unboundPaletteColors(generated, reference.seed);
                sample.problems.push(...sample.unboundPaletteColors);
                if (sample.reuse.expected && sample.reuse.matched / sample.reuse.expected < 0.7) {
                    sample.problems.push(
                        'Fewer than 70% of expected controls reuse a labeled instance.'
                    );
                }
                writeFileSync(join(folder, 'document.json'), JSON.stringify(content(a), null, 2));
                a.collaboration.undo(DOCUMENT_ID);
                settle(copies);
                expect(content(a)).toEqual(before);
                expect(content(b)).toEqual(before);
                sample.passed = sample.problems.length === 0 && sample.rendered;
            } catch (error) {
                sample.problems.push(error instanceof Error ? error.message : String(error));
            } finally {
                if (!sample.durationMs) {
                    sample.durationMs = performance.now() - started;
                }
                sample.usage =
                    !usageMissing && usages.length
                        ? usages.reduce(
                              (sum, value) => ({
                                  inputTokens: sum.inputTokens + value.inputTokens,
                                  outputTokens: sum.outputTokens + value.outputTokens
                              }),
                              { inputTokens: 0, outputTokens: 0 }
                          )
                        : null;
                writeFileSync(
                    join(folder, 'provider-events.json'),
                    JSON.stringify(rounds, null, 2)
                );
                copies.forEach(({ collaboration }) => collaboration.dispose());
                samples.push(sample);
                save();
                process.stdout.write(
                    `${samples.length}/30 ${sample.name}: ${sample.finalValid ? 'valid' : 'failed'}, ${(sample.durationMs / 1000).toFixed(1)}s\n`
                );
            }
        },
        TIMEOUT_MS
    );
});
