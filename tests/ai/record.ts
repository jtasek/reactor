import { readEvents } from '../../server/aiTasks';
import type { StreamEvent } from './replay';

/** Forward bytes immediately; collecting a recording must not hide streaming latency. */
export function recordResponse(response: Response, rounds: StreamEvent[][]): Response {
    if (!response.ok || !response.body) return response;
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    const body = response.body.pipeThrough(
        new TransformStream<Uint8Array, Uint8Array>({
            transform(chunk, controller) {
                chunks.push(new Uint8Array(chunk));
                controller.enqueue(chunk);
            },
            async flush() {
                const events: StreamEvent[] = [];

                for await (const event of readEvents(new Blob(chunks).stream())) {
                    events.push(event as StreamEvent);
                }
                rounds.push(events);
            }
        })
    );

    return new Response(body, { status: response.status, headers: response.headers });
}
