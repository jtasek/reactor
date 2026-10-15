import { propose, type ProposalEvent } from 'src/ai/client';

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
