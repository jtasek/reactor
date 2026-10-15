import { propose, type ProposalEvent } from 'src/ai/client';
import { DOCUMENT_ID, createCopies, sharedContent, shownDocument } from '../support/collaboration';
import { startHarness } from './harness';
import { answer, replay, type StreamEvent } from './replay';

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

describe('proposals', () => {
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
        const provider = replay(rounds, { holdAfter });
        const [copy] = await createCopies(1);
        const events: ProposalEvent[] = [];
        const controller = cancel ?? new AbortController();
        const before = sharedContent(copy);

        harness.answerWith(provider.fetch);

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

        return { result, events, provider };
    }

    it('sends an operation it cannot read back to the model, and proposes the repaired answer', async () => {
        const { result, events, provider } = await ask([
            answer({ calls: [label, picture] }),
            answer({ calls: [label] })
        ]);

        expect(result).toMatchObject({
            kind: 'proposed',
            model: 'claude-haiku-5-5',
            operations: [{ op: 'addShape', key: 'label' }]
        });
        expect(events.map(({ type }) => type)).toEqual(['operation', 'repairing', 'operation']);
        expect(provider.sent[1].body.messages[2].content[1]).toEqual({
            type: 'tool_result',
            tool_use_id: 'toolu_2',
            content: 'Operation 2: An image cannot be added this way.',
            is_error: true
        });
    });

    it('gives up after one repair, with the problem', async () => {
        const { result, provider } = await ask([
            answer({ calls: [box()] }),
            answer({ calls: [box('still missing')] }),
            answer({ calls: [box('never asked')] })
        ]);

        expect(result).toEqual({
            kind: 'failed',
            problem: "Operation 1: still missing is not in the document's variables."
        });
        expect(provider.sent).toHaveLength(2);
    });

    it('shows what the model says when it proposes nothing, without a repair', async () => {
        const { result, provider } = await ask([
            answer({ text: 'There is nothing to add a box to.' }),
            answer({ calls: [box()] })
        ]);

        expect(result).toEqual({ kind: 'failed', problem: 'There is nothing to add a box to.' });
        expect(provider.sent).toHaveLength(1);
    });

    it('stops the model and proposes nothing when cancelled', async () => {
        const first = answer({ calls: [label, box()] });
        // Up to the end of the label's call, before the box's begins.
        const holdAfter =
            first.findIndex((event) => event.type === 'content_block_stop' && event.index === 1) +
            1;
        const { result, events, provider } = await ask([first], {
            holdAfter,
            cancel: new AbortController()
        });

        expect(result).toEqual({ kind: 'cancelled' });
        expect(events.map(({ type }) => type)).toEqual(['operation']);
        await vi.waitFor(() => expect(provider.sent[0].signal.aborted).toBe(true));
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
