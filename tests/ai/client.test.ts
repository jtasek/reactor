import { propose, type ProposalEvent, type Send } from 'src/ai/client';

const operation = {
    op: 'addShape',
    key: 'label',
    shape: { type: 'text', position: { x: 0, y: 0 }, value: 'Hi' }
};

/** All events arrive in one chunk, so aborting fetch need not interrupt the reader. */
const response = () =>
    new Response(
        `${[
            { type: 'start', requestId: 'request', model: 'model' },
            { type: 'operation', operation },
            { type: 'done' }
        ]
            .map((event) => JSON.stringify(event))
            .join('\n')}\n`
    );

describe('proposal cancellation', () => {
    it.each(['operation', 'repairing'] as const)(
        'discards buffered answers when cancelled during %s',
        async (cancelOn) => {
            const controller = new AbortController();
            const send = vi.fn(async () => response());
            const check = vi.fn(() =>
                cancelOn === 'repairing'
                    ? { valid: false as const, operation: 0, problem: 'Try again.' }
                    : { valid: true as const }
            );
            const events: ProposalEvent[] = [];

            const result = await propose({
                send,
                documentId: 'document',
                request: { task: 'edit', prompt: 'Add a label', context: {} },
                check,
                signal: controller.signal,
                onEvent: (event) => {
                    events.push(event);
                    if (event.type === cancelOn) {
                        controller.abort();
                    }
                }
            });

            expect(result).toEqual({ kind: 'cancelled' });
            expect(send).toHaveBeenCalledTimes(1);
            expect(check).toHaveBeenCalledTimes(cancelOn === 'operation' ? 0 : 1);
            expect(events.map(({ type }) => type)).toEqual(
                cancelOn === 'operation' ? ['operation'] : ['operation', 'repairing']
            );
        }
    );
});

const screen = {
    op: 'addFrame',
    key: 'screen',
    frame: {
        kind: 'screen',
        name: 'Screenshot',
        position: { x: 0, y: 0 },
        size: { width: 480, height: 640 }
    }
};
const attached = { ...operation, shape: { ...operation.shape, parentFrameId: 'screen' } };
const answerWith = (operations: object[]) =>
    new Response(
        `${[
            { type: 'start', requestId: 'request', model: 'model' },
            ...operations.map((operation) => ({ type: 'operation', operation })),
            { type: 'done' }
        ]
            .map((event) => JSON.stringify(event))
            .join('\n')}\n`
    );

it('repairs detached screenshot artwork before offering a proposal, without applying anything', async () => {
    const send = vi
        .fn()
        .mockResolvedValueOnce(answerWith([screen, operation]))
        .mockResolvedValueOnce(answerWith([screen, attached]));
    const events: ProposalEvent[] = [];
    const result = await propose({
        send,
        documentId: 'document',
        request: {
            task: 'edit',
            prompt: 'Recreate screenshot',
            context: {},
            image: { data: 'image' }
        },
        check: () => ({ valid: true }),
        signal: new AbortController().signal,
        onEvent: (event) => events.push(event)
    });
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][1]).toMatchObject({
        operation: 1,
        problem: expect.stringContaining('shape.parentFrameId')
    });
    expect(result).toMatchObject({
        kind: 'proposed',
        operations: expect.arrayContaining([
            expect.objectContaining({ shape: expect.objectContaining({ parentFrameId: 'screen' }) })
        ])
    });
    expect(events.filter((event) => event.type === 'repairing')).toHaveLength(1);
});

it('refuses a still-detached screenshot after the single repair', async () => {
    const send = vi.fn(async () => answerWith([screen, operation]));
    const result = await propose({
        send,
        documentId: 'document',
        request: {
            task: 'edit',
            prompt: 'Recreate screenshot',
            context: {},
            image: { data: 'image' }
        },
        check: () => ({ valid: true }),
        signal: new AbortController().signal
    });
    expect(send).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
        kind: 'failed',
        problem: expect.stringContaining('screen is blank')
    });
});

it.each([
    { operations: [screen, operation], image: undefined },
    { operations: [screen], image: { data: 'image' } },
    { operations: [operation], image: { data: 'image' } },
    {
        operations: [screen, attached, { ...operation, key: 'source-label' }],
        image: { data: 'image' }
    }
])(
    'preserves empty screens, ordinary Canvas edits and mixed source artwork',
    async ({ operations, image }) => {
        const send = vi.fn(async () => answerWith(operations));
        const result = await propose({
            send,
            documentId: 'document',
            request: { task: 'edit', prompt: 'Edit', context: {}, image },
            check: () => ({ valid: true }),
            signal: new AbortController().signal
        });
        expect(send).toHaveBeenCalledTimes(1);
        expect(result.kind).toBe('proposed');
    }
);

it('maps a failing expanded screen operation back to its single source tool call', async () => {
    const screenTool = {
        op: 'addScreen',
        key: 'screen',
        screen: screen.frame,
        shapes: [{ key: 'label', shape: operation.shape }]
    };
    const send = vi.fn<Send>(async () => answerWith([screenTool]));
    const check = vi
        .fn()
        .mockReturnValueOnce({ valid: false, operation: 1, problem: 'Fix the label' })
        .mockReturnValueOnce({ valid: true });
    const result = await propose({
        send,
        documentId: 'document',
        request: { task: 'edit', prompt: 'Create screen', context: {}, image: { data: 'image' } },
        reservedKeys: ['artwork:["screen","label"]', 'private-record-id'],
        check,
        signal: new AbortController().signal
    });
    expect(check.mock.calls[0][0]).toMatchObject([
        { op: 'addFrame', key: 'screen' },
        { op: 'addShape', key: 'artwork:["screen","label"]:2', shape: { parentFrameId: 'screen' } }
    ]);
    expect(check.mock.calls[1][0]).toEqual(check.mock.calls[0][0]);
    expect(JSON.stringify(send.mock.calls)).not.toContain('private-record-id');
    expect(send.mock.calls[1][1]).toEqual({ operation: 0, problem: 'Fix the label' });
    expect(result.kind).toBe('proposed');
});

it('numbers problems by the tool call the model made, not by expanded operations', async () => {
    const screenTool = {
        op: 'addScreen',
        key: 'screen',
        screen: screen.frame,
        shapes: [
            { key: 'one', shape: operation.shape },
            { key: 'two', shape: operation.shape }
        ]
    };
    const send = vi.fn<Send>(async () => answerWith([screenTool, operation, { op: 'nope' }]));
    const check = vi.fn(() => ({ valid: true as const }));
    await propose({
        send,
        documentId: 'document',
        request: { task: 'edit', prompt: 'Create screen', context: {} },
        check,
        signal: new AbortController().signal
    });
    // Three calls expand to five readings; the unreadable one is the third call.
    expect(send.mock.calls[1][1]).toMatchObject({
        operation: 2,
        problem: expect.stringMatching(/^Operation 3: /)
    });

    const checked = vi
        .fn()
        .mockReturnValueOnce({
            valid: false,
            operation: 3,
            problem: 'Operation 4: the key label is taken.'
        })
        .mockReturnValueOnce({ valid: true });
    const repaired = vi.fn<Send>(async () => answerWith([screenTool, operation]));
    await propose({
        send: repaired,
        documentId: 'document',
        request: { task: 'edit', prompt: 'Create screen', context: {} },
        check: checked,
        signal: new AbortController().signal
    });
    expect(repaired.mock.calls[1][1]).toEqual({
        operation: 1,
        problem: 'Operation 2: the key label is taken.'
    });
});
