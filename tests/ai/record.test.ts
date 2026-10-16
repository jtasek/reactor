import { recordResponse } from './record';
import type { StreamEvent } from './replay';
import { readEvents } from '../../server/aiTasks';

it('forwards an operation before the provider finishes and records split UTF-8 events', async () => {
    let source!: ReadableStreamDefaultController<Uint8Array>;
    const bytes = new TextEncoder().encode('data: {"text":"Ahoj světe"}\n\n');
    const rounds: StreamEvent[][] = [];
    const response = recordResponse(
        new Response(
            new ReadableStream({
                start(controller) {
                    source = controller;
                }
            })
        ),
        rounds
    );
    const reader = response.body!.getReader();
    const split = bytes.indexOf(196) + 1;

    source.enqueue(bytes.slice(0, split));
    expect((await reader.read()).value).toEqual(bytes.slice(0, split));
    expect(rounds).toEqual([]);
    source.enqueue(bytes.slice(split));
    expect((await reader.read()).value).toEqual(bytes.slice(split));
    source.close();
    expect((await reader.read()).done).toBe(true);
    expect(rounds).toEqual([[{ text: 'Ahoj světe' }]]);
});

it('passes cancellation back to the provider without recording a partial answer', async () => {
    const cancelled = vi.fn();
    const rounds: StreamEvent[][] = [];
    const response = recordResponse(
        new Response(
            new ReadableStream({
                cancel: cancelled
            })
        ),
        rounds
    );

    await response.body!.cancel('stop');
    await vi.waitFor(() => expect(cancelled).toHaveBeenCalledWith('stop'));
    expect(rounds).toEqual([]);
});

it('records OpenAI completion before the adapter cancels at DONE without an EOF', async () => {
    const cancelled = vi.fn();
    const rounds: StreamEvent[][] = [];
    const response = recordResponse(
        new Response(
            new ReadableStream({
                start(controller) {
                    controller.enqueue(
                        new TextEncoder().encode('data: {"choices":[]}\n\ndata: [DONE]\n\n')
                    );
                    // The upstream connection remains open after its completion marker.
                },
                cancel: cancelled
            })
        ),
        rounds
    );
    const received = [];

    for await (const event of readEvents(response.body!)) received.push(event);
    expect(received).toEqual([{ choices: [] }]);
    expect(rounds).toEqual([[{ choices: [] }]]);
    await vi.waitFor(() => expect(cancelled).toHaveBeenCalled());
});
