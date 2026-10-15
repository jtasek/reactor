import { propose, type ProposalEvent } from 'src/ai/client';
import { DOCUMENT_ID, createCopies, sharedContent, shownDocument } from '../support/collaboration';
import { startHarness } from './harness';
import {
    MODELS,
    answer,
    chatAnswer,
    replay,
    type ProviderName,
    type Sent,
    type StreamEvent
} from './replay';

const box = (variable = 'missing') => ({
    name: 'addShape',
    input: {
        key: 'box',
        shape: {
            type: 'rectangle',
            position: { x: 0, y: 0 },
            size: { width: 20, height: 10 },
            bindings: { fill: variable }
        }
    }
});
const picture = {
    name: 'addShape',
    input: {
        key: 'picture',
        shape: {
            type: 'image',
            position: { x: 0, y: 0 },
            size: { width: 20, height: 10 },
            source: 'https://example.com/a.png'
        }
    }
};
const label = {
    name: 'addShape',
    input: { key: 'label', shape: { type: 'text', position: { x: 0, y: 20 }, value: 'Hi' } }
};

/** Whether an OpenAI chunk begins the call at `index`. */
const beginsCall = (chunk: StreamEvent, index: number) =>
    JSON.stringify(chunk).includes(`"tool_calls":[{"index":${index},"id"`);

/** How each provider streams an answer and is told of a refused one. */
const PROVIDERS: Array<{
    provider: ProviderName;
    /** Builds a round of the provider's events. */
    stream: typeof answer;
    /** How many events reach the end of the first call, before the second ends. */
    firstCallEnd(events: StreamEvent[]): number;
    /** What a repair told the model of the second call of its answer. */
    secondResult(sent: Sent): unknown;
    failedSecond: object;
}> = [
    {
        provider: 'anthropic',
        stream: answer,
        firstCallEnd: (events) =>
            events.findIndex((event) => event.type === 'content_block_stop' && event.index === 1) +
            1,
        secondResult: ({ body }) => body.messages[2].content[1],
        failedSecond: {
            type: 'tool_result',
            tool_use_id: 'toolu_2',
            content: 'Operation 2: An image cannot be added this way.',
            is_error: true
        }
    },
    {
        provider: 'openai',
        stream: chatAnswer,
        firstCallEnd: (events) => events.findIndex((event) => beginsCall(event, 1)) + 1,
        secondResult: ({ body }) => body.messages[4],
        failedSecond: {
            role: 'tool',
            tool_call_id: 'call_2',
            content: 'Error: Operation 2: An image cannot be added this way.'
        }
    }
];

describe.each(PROVIDERS)('proposals from $provider', (each) => {
    const { provider, stream } = each;

    let harness: Awaited<ReturnType<typeof startHarness>>;

    beforeAll(async () => {
        harness = await startHarness();
    });
    afterAll(() => harness.close());

    /** Asks for a change of an empty document, the model answering with `rounds`. */
    async function ask(
        rounds: StreamEvent[][],
        { holdAfter, cancel }: { holdAfter?: number; cancel?: AbortController } = {}
    ) {
        const replayed = replay(rounds, { holdAfter, provider });
        const [copy] = await createCopies(1);
        const events: ProposalEvent[] = [];
        const controller = cancel ?? new AbortController();
        const before = sharedContent(copy);

        harness.answerWith(replayed.provider);

        const result = await propose({
            send: harness.send,
            documentId: await harness.createServerDocument(),
            request: { task: 'edit', prompt: 'Add a box', context: {} },
            check: (operations) =>
                copy.store.actions.checkOperations({ documentId: DOCUMENT_ID, operations }),
            signal: controller.signal,
            onEvent: (event) => {
                events.push(event);
                if (event.type === 'operation' && cancel) {
                    cancel.abort();
                }
            }
        });

        expect(sharedContent(copy)).toEqual(before);
        expect(shownDocument(copy).history.canUndo).toBe(false);

        return { result, events, replayed };
    }

    it('sends an operation it cannot read back to the model, and proposes the repaired answer', async () => {
        const { result, events, replayed } = await ask([
            stream({ calls: [label, picture] }),
            stream({ calls: [label] })
        ]);

        expect(result).toMatchObject({
            kind: 'proposed',
            model: MODELS[provider],
            operations: [{ op: 'addShape', key: 'label' }]
        });
        expect(events.map(({ type }) => type)).toEqual(['operation', 'repairing', 'operation']);
        expect(each.secondResult(replayed.sent[1])).toEqual(each.failedSecond);
    });

    it('gives up after one repair, with the problem', async () => {
        const { result, replayed } = await ask([
            stream({ calls: [box()] }),
            stream({ calls: [box('still missing')] }),
            stream({ calls: [box('never asked')] })
        ]);

        expect(result).toEqual({
            kind: 'failed',
            problem: "Operation 1: still missing is not in the document's variables."
        });
        expect(replayed.sent).toHaveLength(2);
    });

    it('shows what the model says when it proposes nothing, without a repair', async () => {
        const { result, replayed } = await ask([
            stream({ text: 'There is nothing to add a box to.' }),
            stream({ calls: [box()] })
        ]);

        expect(result).toEqual({ kind: 'failed', problem: 'There is nothing to add a box to.' });
        expect(replayed.sent).toHaveLength(1);
    });

    it('stops the model and proposes nothing when cancelled', async () => {
        const first = stream({ calls: [label, box()] });
        const { result, events, replayed } = await ask([first], {
            holdAfter: each.firstCallEnd(first),
            cancel: new AbortController()
        });

        expect(result).toEqual({ kind: 'cancelled' });
        expect(events.map(({ type }) => type)).toEqual(['operation']);
        await vi.waitFor(() => expect(replayed.sent[0].signal.aborted).toBe(true));
    });

    it('says the model could not be reached when the provider fails', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const { result } = await ask([]);

        expect(result).toEqual({
            kind: 'failed',
            problem: 'The model could not be reached. Try again.'
        });
    });
});
