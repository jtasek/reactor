import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname } from 'node:path';
import { propose } from 'src/ai/client';
import { documentContext } from 'src/ai/context';
import type { Provenance } from 'src/app/operations';
import { providerFromEnv } from '../../server/ai';
import type { Usage } from '../../server/aiTasks';
import { recordResponse } from './record';
import {
    evaluationReport,
    evaluationProblems,
    type EvalReport,
    type EvalSample,
    type Pricing
} from './report';
import {
    DOCUMENT_ID,
    createCopies,
    settle,
    sharedContent,
    shownDocument,
    type Copy
} from '../support/collaboration';
import { fixtureDocument, startHarness, type AiCase } from './harness';
import {
    answer,
    chatAnswer,
    MODELS,
    replay,
    type ProviderName,
    type Recording,
    type Sent,
    type StreamEvent
} from './replay';

const CASES = new URL('./cases/', import.meta.url);

/**
 * With `AI_RECORD=1`, the cases ask the provider the environment configures, as
 * the server's is (`AI_PROVIDER` and the rest), and record its answers.
 */
const RECORDING = process.env.AI_RECORD === '1';
const LIVE = RECORDING || process.env.AI_EVAL === '1';
const REPORT = process.env.AI_EVAL_REPORT ?? 'test-results/ai-eval.json';
const samples: EvalSample[] = [];
let model = '';

function pricing(): Pricing | undefined {
    const input = process.env.AI_EVAL_INPUT_USD_PER_MILLION || undefined;
    const output = process.env.AI_EVAL_OUTPUT_USD_PER_MILLION || undefined;

    if (input === undefined && output === undefined) return undefined;
    if (
        input === undefined ||
        output === undefined ||
        ![input, output].every(
            (value) => value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0
        )
    ) {
        throw new Error(
            'Supply both AI eval prices as nonnegative finite USD amounts per million tokens.'
        );
    }

    return { inputPerMillion: Number(input), outputPerMillion: Number(output) };
}
const prices = LIVE ? pricing() : undefined;

const LIVE_TIMEOUT_MS = 120_000;

const cases = await Promise.all(
    readdirSync(CASES)
        .sort()
        .map(async (name) => ({
            name,
            folder: new URL(`${name}/`, CASES),
            test: ((await import(`./cases/${name}/case.ts`)) as { default: AiCase }).default
        }))
);

// A stable case identity allows comparing model or system-prompt changes on the same suite.
const suiteHash = createHash('sha256');
for (const { name, folder, test } of cases) {
    suiteHash.update(name).update(readFileSync(new URL('case.ts', folder)));
    if (test.image) suiteHash.update(readFileSync(new URL(test.image, folder)));
}
for (const file of ['expected.ts', 'checks.ts', 'harness.ts']) {
    suiteHash.update(readFileSync(new URL(file, import.meta.url)));
}
const suite = suiteHash.digest('hex');
const configured = process.env.AI_PROVIDER ?? (process.env.ANTHROPIC_API_KEY ? 'anthropic' : '');
if (LIVE && configured !== 'anthropic' && configured !== 'openai') {
    throw new Error('Live evals require AI_PROVIDER=anthropic or openai.');
}
const runs = cases.flatMap((run) =>
    (LIVE ? [configured] : ['anthropic', 'openai']).map((provider) => ({
        ...run,
        provider: provider as ProviderName
    }))
);

/** Hand-authored responses exercise both wire formats; they are never a live quality score. */
function reference(test: AiCase, provider: ProviderName): Recording {
    if (!test.reference) throw new Error(`Missing ${provider} recording and reference answer.`);
    const stream = provider === 'anthropic' ? answer : chatAnswer;

    return {
        provider,
        model: MODELS[provider],
        rounds: test.reference.map((operations) =>
            stream({
                calls: operations.map(({ op, ...input }) => ({ name: op, input }))
            })
        )
    };
}

/** The configured provider, keeping what is sent and each round of events it answers. */
function record(rounds: StreamEvent[][]) {
    const sent: Sent[] = [];
    const fetch = async (url: string | URL | Request, init?: RequestInit) => {
        sent.push({
            body: JSON.parse(String(init?.body)) as Sent['body'],
            signal: init?.signal ?? new AbortController().signal
        });

        const response = await globalThis.fetch(url, init);
        return recordResponse(response, rounds);
    };

    return { sent, provider: providerFromEnv(process.env, fetch) };
}

/** What a copy shares of the document, apart from when it was last changed. */
const content = (copy: Copy) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { fields, ...rest } = sharedContent(copy);

    return rest;
};

describe('AI eval cases', () => {
    let harness: Awaited<ReturnType<typeof startHarness>>;

    beforeAll(async () => {
        harness = await startHarness();
    });
    afterAll(async () => {
        await harness.close();
        if (!LIVE) return;
        const report = evaluationReport(configured, model, suite, samples, prices);
        const baseline = process.env.AI_EVAL_BASELINE
            ? (JSON.parse(readFileSync(process.env.AI_EVAL_BASELINE, 'utf8')) as EvalReport)
            : undefined;
        const problems = evaluationProblems(report, baseline);

        mkdirSync(dirname(REPORT), { recursive: true });
        writeFileSync(
            REPORT,
            `${JSON.stringify(
                {
                    ...report,
                    baseline: baseline
                        ? { model: baseline.model, passedPercent: baseline.passedPercent }
                        : null,
                    problems
                },
                null,
                4
            )}\n`
        );
        console.info(
            `Live AI eval: ${report.passedPercent}% semantic pass, ` +
                `${report.firstValidPercent}% first valid, ${report.finalValidPercent}% final valid. ` +
                `Report: ${REPORT}`
        );
        expect(problems).toEqual([]);
    });

    it('has forty distinct cases', () => {
        expect(cases).toHaveLength(40);
        expect(new Set(cases.map(({ name }) => name)).size).toBe(40);
    });

    it.each(runs)(
        '$name ($provider): a proposal applied as one step, shared once accepted, undone whole',
        async ({ folder, test, provider: name }) => {
            const recordingFile = new URL(`recordings/${name}.json`, folder);
            const recording: Recording = LIVE
                ? { provider: name, model: '', rounds: [] }
                : existsSync(recordingFile)
                  ? (JSON.parse(readFileSync(recordingFile, 'utf8')) as Recording)
                  : reference(test, name);
            const { rounds } = recording;
            const provider = LIVE
                ? record(rounds)
                : replay(rounds, { provider: recording.provider, model: recording.model });
            const copies = await createCopies(2, (store) => {
                store.actions.addDocument(fixtureDocument(test.fixture));
                test.selection?.forEach((id) => store.actions.selectShape(id));
            });
            const [a, b] = copies;
            const before = content(a);
            const image =
                test.image && readFileSync(new URL(test.image, folder)).toString('base64');

            const usage: Usage[] = [];
            let usageMissing = false;
            let repaired = false;
            const sample: EvalSample = {
                name: new URL('.', folder).pathname.split('/').filter(Boolean).at(-1)!,
                firstValid: false,
                finalValid: false,
                passed: false,
                firstOperationMs: null,
                durationMs: 0,
                usage: null,
                problems: []
            };
            model = provider.provider.model('edit');
            harness.answerWith({
                model: provider.provider.model,
                async turn(conversation, signal, on) {
                    let used: Usage | undefined;
                    try {
                        return await provider.provider.turn(conversation, signal, {
                            ...on,
                            usage(value) {
                                used = value;
                                on.usage(value);
                            }
                        });
                    } finally {
                        if (used) usage.push(used);
                        else usageMissing = true;
                    }
                }
            });
            const serverDocumentId = await harness.createServerDocument();
            const context = documentContext(shownDocument(a));
            expect(context.selection).toEqual(test.selection ?? []);
            const started = performance.now();
            try {
                const result = await propose({
                    send: harness.send,
                    documentId: serverDocumentId,
                    request: {
                        task: 'edit',
                        prompt: test.prompt,
                        context,
                        image: image ? { data: image } : undefined
                    },
                    check: (operations) =>
                        a.store.actions.checkOperations({ documentId: DOCUMENT_ID, operations }),
                    signal: LIVE
                        ? AbortSignal.timeout(LIVE_TIMEOUT_MS - 5000)
                        : new AbortController().signal,
                    onEvent(event) {
                        if (event.type === 'repairing') repaired = true;
                        if (event.type === 'operation' && sample.firstOperationMs === null) {
                            sample.firstOperationMs = performance.now() - started;
                        }
                    }
                });
                sample.durationMs = performance.now() - started;
                sample.finalValid = result.kind === 'proposed';
                sample.firstValid = sample.finalValid && !repaired;

                if (RECORDING) {
                    recording.model = provider.provider.model('edit');
                    mkdirSync(new URL('recordings/', folder), { recursive: true });
                    writeFileSync(recordingFile, `${JSON.stringify(recording, null, 4)}\n`);
                }
                if (!LIVE) expect(provider.sent).toHaveLength(rounds.length);
                if (image) {
                    expect(JSON.stringify(provider.sent[0].body.messages)).toContain(image);
                }
                // Validation and provider failures must leave both copies unchanged, too.
                settle(copies);
                expect(content(a)).toEqual(before);
                expect(content(b)).toEqual(before);
                if (result.kind !== 'proposed') {
                    sample.problems.push(`Nothing was proposed: ${JSON.stringify(result)}`);
                    if (!LIVE) throw new Error(sample.problems[0]);
                    return;
                }

                const by: Provenance = {
                    kind: 'ai',
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
                sample.problems = test.check(shownDocument(a));
                sample.passed = sample.problems.length === 0;
                if (!LIVE) expect(sample.problems).toEqual([]);
                settle(copies);
                expect(content(b)).toEqual(content(a));
                expect(a.collaboration.undoAuthors(DOCUMENT_ID)).toEqual([by]);

                a.collaboration.undo(DOCUMENT_ID);
                settle(copies);
                expect(content(a)).toEqual(before);
                expect(content(b)).toEqual(before);
            } catch (error) {
                sample.passed = false;
                sample.problems.push(error instanceof Error ? error.message : String(error));
                throw error;
            } finally {
                if (sample.durationMs === 0) sample.durationMs = performance.now() - started;
                if (LIVE) {
                    sample.usage =
                        usageMissing || !usage.length
                            ? null
                            : usage.reduce(
                                  (total, used) => ({
                                      inputTokens: total.inputTokens + used.inputTokens,
                                      outputTokens: total.outputTokens + used.outputTokens
                                  }),
                                  { inputTokens: 0, outputTokens: 0 }
                              );
                    samples.push(sample);
                }
                copies.forEach(({ collaboration }) => collaboration.dispose());
            }
        },
        LIVE ? LIVE_TIMEOUT_MS : undefined
    );
});
