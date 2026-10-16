import { readEvents } from '../../server/aiTasks';
import type { StreamEvent } from './replay';

/** Forward chunks as they arrive and retain complete SSE events before the adapter cancels. */
export function recordResponse(response: Response, rounds: StreamEvent[][]): Response {
    if (!response.ok || !response.body) return response;
    const decoder = new TextDecoder();
    const events: StreamEvent[] = [];
    let buffer = '';
    let recorded = false;
    const finish = () => {
        if (recorded) return;
        recorded = true;
        rounds.push(events);
    };
    const body = response.body.pipeThrough(
        new TransformStream<Uint8Array, Uint8Array>({
            async transform(chunk, controller) {
                buffer += decoder.decode(chunk, { stream: true });
                buffer = buffer.replace(/\r\n/g, '\n');
                const end = buffer.lastIndexOf('\n\n');

                if (end >= 0) {
                    const complete = buffer.slice(0, end + 2);
                    buffer = buffer.slice(end + 2);
                    for await (const event of readEvents(new Response(complete).body!)) {
                        events.push(event as StreamEvent);
                    }
                    if (
                        events.at(-1)?.type === 'message_stop' ||
                        /^data:\s*\[DONE\]\s*$/m.test(complete)
                    ) {
                        finish();
                    }
                }
                controller.enqueue(chunk);
            },
            flush: finish
        })
    );

    return new Response(body, { status: response.status, headers: response.headers });
}
