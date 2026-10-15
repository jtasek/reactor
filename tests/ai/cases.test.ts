import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { propose } from 'src/ai/client';
import { documentContext } from 'src/ai/context';
import type { Provenance } from 'src/app/operations';
import { readEvents } from '../../server/anthropic';
import {
    DOCUMENT_ID,
    createCopies,
    settle,
    sharedContent,
    shownDocument,
    type Copy
} from '../support/collaboration';
import { fixtureDocument, startHarness, type AiCase } from './harness';
import { replay, type Recording, type Sent, type StreamEvent } from './replay';

const CASES = new URL('./cases/', import.meta.url);

/** With `AI_RECORD=1` and a provider key, the cases ask the model and record its answers. */
const RECORDING = process.env.AI_RECORD === '1' && Boolean(process.env.ANTHROPIC_API_KEY);

const LIVE_TIMEOUT_MS = 120_000;

const cases = await Promise.all(
    readdirSync(CASES).map(async (name) => ({
        name,
        folder: new URL(`${name}/`, CASES),
        test: ((await import(`./cases/${name}/case.ts`)) as { default: AiCase }).default
    }))
);

/** The provider's fetch with the key, keeping each round of events it answers. */
function record(rounds: StreamEvent[][]) {
    const sent: Sent[] = [];
    const fetch = async (url: string | URL | Request, init?: RequestInit) => {
        const headers = new Headers(init?.headers);

        headers.set('x-api-key', String(process.env.ANTHROPIC_API_KEY));
        sent.push({
            body: JSON.parse(String(init?.body)) as Sent['body'],
            signal: init?.signal ?? new AbortController().signal
        });

        const response = await globalThis.fetch(url, { ...init, headers });
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

    return { fetch, sent };
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

    it.each(cases)(
        '$name: a proposal applied as one step, shared once accepted, undone whole',
        async ({ folder, test }) => {
            const recordingFile = new URL('recording.json', folder);
            const rounds = RECORDING
                ? []
                : (JSON.parse(readFileSync(recordingFile, 'utf8')) as Recording).rounds;
            const provider = RECORDING ? record(rounds) : replay(rounds);
            const copies = await createCopies(2, (store) =>
                store.actions.addDocument(fixtureDocument(test.fixture))
            );
            const [a, b] = copies;
            const before = content(a);
            const image =
                test.image && readFileSync(new URL(test.image, folder)).toString('base64');

            harness.answerWith(provider.fetch);

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
                writeFileSync(recordingFile, `${JSON.stringify({ rounds }, null, 4)}\n`);
            }
            expect(provider.sent).toHaveLength(rounds.length);
            if (image) {
                expect(provider.sent[0].body.messages[0].content).toContainEqual({
                    type: 'image',
                    source: { type: 'base64', media_type: 'image/png', data: image }
                });
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
