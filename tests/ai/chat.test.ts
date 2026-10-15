import { Chat } from 'src/ai/chat';
import type { Send } from 'src/ai/client';

const response = () =>
    new Response(
        [
            { type: 'start', requestId: 'request', model: 'model' },
            {
                type: 'operation',
                operation: {
                    op: 'addShape',
                    key: 'label',
                    shape: {
                        type: 'text',
                        position: { x: 0, y: 0 },
                        value: 'Hello'
                    }
                }
            },
            { type: 'done' }
        ]
            .map((event) => `${JSON.stringify(event)}\n`)
            .join('')
    );
const request = (send: Send = async () => response()) => ({
    context: {},
    check: () => ({ valid: true as const }),
    send
});

it('keeps accepted turns in chat and applies each proposal only once', async () => {
    const chat = new Chat('document');
    const apply = vi.fn(() => ({ applied: true as const, ids: { label: 'label' } }));

    chat.setDraft('Add a greeting');
    await chat.send(request());
    expect(apply).not.toHaveBeenCalled();
    chat.accept(apply);
    chat.accept(apply);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(chat.getSnapshot().turns[0]).toMatchObject({
        prompt: 'Add a greeting',
        status: 'accepted'
    });

    chat.setDraft('Add another label');
    await chat.send(request());
    chat.discard();
    chat.accept(apply);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(chat.getSnapshot().turns.map(({ status }) => status)).toEqual(['accepted', 'discarded']);
    expect(chat.getSnapshot().draft).toBe('Add another label');
});

it('keeps an in-flight conversation when its panel remounts to dock', async () => {
    const chat = new Chat('document');
    const first = chat.retain();
    const gate = Promise.withResolvers<Response>();
    let signal: AbortSignal | undefined;

    chat.setDraft('Add a greeting');
    const pending = chat.send(
        request(async (_path, _body, abort) => {
            signal = abort;

            return gate.promise;
        })
    );
    first();
    const second = chat.retain();

    await Promise.resolve();
    expect(signal?.aborted).toBe(false);
    gate.resolve(response());
    await pending;
    expect(chat.getSnapshot().turns[0].status).toBe('proposed');
    second();
});

it('aborts when the chat closes, and ignores an answer that arrives later', async () => {
    const chat = new Chat('document');
    const release = chat.retain();
    const gate = Promise.withResolvers<Response>();
    let signal: AbortSignal | undefined;

    chat.setDraft('Add a greeting');
    const pending = chat.send(
        request(async (_path, _body, abort) => {
            signal = abort;

            return gate.promise;
        })
    );

    release();
    await Promise.resolve();
    expect(signal?.aborted).toBe(true);
    gate.resolve(response());
    await pending;
    expect(chat.getSnapshot().turns[0].proposal).toBeUndefined();
});

it('Stop restores the words and prevents a late answer from becoming acceptable', async () => {
    const chat = new Chat('document');
    const gate = Promise.withResolvers<Response>();

    chat.setDraft('Add a greeting');
    const pending = chat.send(request(async () => gate.promise));

    chat.stop();
    gate.resolve(response());
    await pending;
    const apply = vi.fn();

    chat.accept(apply);
    expect(apply).not.toHaveBeenCalled();
    expect(chat.getSnapshot()).toMatchObject({
        draft: 'Add a greeting',
        turns: [{ status: 'cancelled' }]
    });
});

it('New chat clears pending proposals and rejects their late replies', async () => {
    const chat = new Chat('document');
    const gate = Promise.withResolvers<Response>();

    chat.setDraft('Add a greeting');
    const pending = chat.send(request(async () => gate.promise));

    chat.clear();
    gate.resolve(response());
    await pending;
    expect(chat.getSnapshot()).toEqual({ draft: '', turns: [] });
});
