import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { propose } from 'src/ai/client';
import { documentContext } from 'src/ai/context';
import type { Provenance } from 'src/app/operations';
import { providerFromEnv } from '../../server/ai';
import { readEvents } from '../../server/aiTasks';
import {
    DOCUMENT_ID,
    createCopies,
    settle,
    sharedContent,
    shownDocument,
    type Copy
} from '../support/collaboration';
import { fixtureDocument, startHarness, type AiCase } from './harness';
import { replay, type ProviderName, type Recording, type Sent, type StreamEvent } from './replay';

const CASES = new URL('./cases/', import.meta.url);

/**
 * With `AI_RECORD=1`, the cases ask the provider the environment configures, as
 * the server's is (`AI_PROVIDER` and the rest), and record its answers.
 */
const RECORDING = process.env.AI_RECORD === '1';

const LIVE_TIMEOUT_MS = 120_000;

const cases = await Promise.all(
    readdirSync(CASES).map(async (name) => ({
        name,
        folder: new URL(`${name}/`, CASES),
        test: ((await import(`./cases/${name}/case.ts`)) as { default: AiCase }).default
    }))
);

/** Each case once for each provider it has a recording of, or for the one recorded now. */
const runs = cases.flatMap((run) =>
    (RECORDING
        ? [String(process.env.AI_PROVIDER)]
        : readdirSync(new URL('recordings/', run.folder)).map((file) => file.replace(/\.json$/, ''))
    ).map((provider) => ({ ...run, provider: provider as ProviderName }))
);

/** The configured provider, keeping what is sent and each round of events it answers. */
function record(rounds: StreamEvent[][]) {
    const sent: Sent[] = [];
    const fetch = async (url: string | URL | Request, init?: RequestInit) => {
        sent.push({
            body: JSON.parse(String(init?.body)) as Sent['body'],
            signal: init?.signal ?? new AbortController().signal
        });

        const response = await globalThis.fetch(url, init);
        const text = await response.text();

        if (response.ok) {
            const events: StreamEvent[] = [];

            for await (const event of readEvents(new Response(text).body!)) {
                events.push(event as StreamEvent);
            }
            rounds.push(events);
        }

        return new Response(text, { status: response.status, headers: response.headers });
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
    afterAll(() => harness.close());

    it.each(runs)(
        '$name ($provider): a proposal applied as one step, shared once accepted, undone whole',
        async ({ folder, test, provider: name }) => {
            const recordingFile = new URL(`recordings/${name}.json`, folder);
            const recording: Recording = RECORDING
                ? { provider: name, model: '', rounds: [] }
                : (JSON.parse(readFileSync(recordingFile, 'utf8')) as Recording);
            const { rounds } = recording;
            const provider = RECORDING
                ? record(rounds)
                : replay(rounds, { provider: recording.provider, model: recording.model });
            const copies = await createCopies(2, (store) =>
                store.actions.addDocument(fixtureDocument(test.fixture))
            );
            const [a, b] = copies;
            const before = content(a);
            const image =
                test.image && readFileSync(new URL(test.image, folder)).toString('base64');

            harness.answerWith(provider.provider);

            const result = await propose({
                send: harness.send,
                documentId: await harness.createServerDocument(),
                request: {
                    task: 'edit',
                    prompt: test.prompt,
                    context: documentContext(shownDocument(a)),
                    image: image ? { data: image } : undefined
                },
                check: (operations) =>
                    a.store.actions.checkOperations({ documentId: DOCUMENT_ID, operations }),
                signal: new AbortController().signal
            });

            if (RECORDING) {
                recording.model = provider.provider.model('edit');
                mkdirSync(new URL('recordings/', folder), { recursive: true });
                writeFileSync(recordingFile, `${JSON.stringify(recording, null, 4)}\n`);
            }
            expect(provider.sent).toHaveLength(rounds.length);
            if (image) {
                expect(JSON.stringify(provider.sent[0].body.messages)).toContain(image);
            }
            if (result.kind !== 'proposed') {
                throw new Error(`Nothing was proposed: ${JSON.stringify(result)}`);
            }

            settle(copies);
            expect(content(b)).toEqual(before);

            const by: Provenance = { kind: 'ai', model: result.model, requestId: result.requestId };

            expect(
                a.store.actions.applyOperations({
                    documentId: DOCUMENT_ID,
                    by,
                    operations: result.operations
                })
            ).toMatchObject({ applied: true });
            expect(test.check(shownDocument(a))).toEqual([]);
            settle(copies);
            expect(content(b)).toEqual(content(a));
            expect(a.collaboration.undoAuthors(DOCUMENT_ID)).toEqual([by]);

            a.collaboration.undo(DOCUMENT_ID);
            settle(copies);
            expect(content(a)).toEqual(before);
            expect(content(b)).toEqual(before);
        },
        RECORDING ? LIVE_TIMEOUT_MS : undefined
    );
});
