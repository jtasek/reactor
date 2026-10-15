import type { OperationsCheck } from 'src/app/operations';
import { readOperation, type ProposedOperation } from './operations';

/** What a person asks of the model: the task, their words, the document and an attached image. */
export interface AiRequest {
    task: 'edit';
    prompt: string;
    context: object;
    /** The image's bytes in base64. */
    image?: { data: string };
}

/** Posts JSON to the AI gateway at `path`, below `/api/ai`. */
export type Send = (path: string, body: object, signal: AbortSignal) => Promise<Response>;

export const sendToServer: Send = (path, body, signal) =>
    fetch(`/api/ai${path}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal
    });

/** What a proposal shows while it is made: each operation, the model's words, and a repair beginning. */
export type ProposalEvent =
    | { type: 'operation'; operation: ProposedOperation }
    | { type: 'message'; text: string }
    | { type: 'repairing'; problem: string };

export type ProposalResult =
    | { kind: 'proposed'; requestId: string; model: string; operations: ProposedOperation[] }
    | { kind: 'failed'; problem: string }
    | { kind: 'cancelled' };

type GatewayEvent =
    | { type: 'start'; requestId: string; model: string }
    | { type: 'operation'; operation: unknown }
    | { type: 'message'; text: string }
    | { type: 'done' }
    | { type: 'error'; code: string };

const PROBLEMS: Record<string, string> = {
    AI_LIMIT_REACHED: 'You or your workspace used up today’s AI requests. Try again tomorrow.',
    AI_BUSY: 'Another AI request of yours is still running.',
    AI_REFUSED: 'The model declined this request.',
    AI_INCOMPLETE: 'The answer was too long. Ask for a smaller change.',
    NOT_FOUND: 'This document is not on the server yet. Try again in a moment.',
    FORBIDDEN: 'You may not change this document.'
};

const FAILED = 'The model could not be reached. Try again.';

class Refusal extends Error {}

/** One answer of the model: each operation read, or why it could not be. */
interface Answer {
    requestId: string;
    model: string;
    readings: Array<{ operation: ProposedOperation } | { problem: string }>;
    messages: string[];
}

async function* readLines(body: ReadableStream<Uint8Array>): AsyncGenerator<GatewayEvent> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    for (let read = await reader.read(); !read.done; read = await reader.read()) {
        buffer += decoder.decode(read.value, { stream: true });

        const lines = buffer.split('\n');

        buffer = lines.pop() ?? '';
        for (const line of lines.filter(Boolean)) {
            yield JSON.parse(line) as GatewayEvent;
        }
    }
}

/** Reads a streamed answer, telling `onEvent` each operation and message; refuses a failed one. */
async function receive(
    response: Response,
    onEvent: (event: ProposalEvent) => void
): Promise<Answer> {
    if (!response.ok || !response.body) {
        const { code } = (await response.json().catch(() => ({}))) as { code?: string };

        throw new Refusal((code && PROBLEMS[code]) ?? FAILED);
    }

    const answer: Answer = { requestId: '', model: '', readings: [], messages: [] };

    for await (const event of readLines(response.body)) {
        switch (event.type) {
            case 'start':
                answer.requestId = event.requestId;
                answer.model = event.model;
                break;
            case 'operation': {
                const index = answer.readings.length;

                try {
                    const operation = readOperation(event.operation);

                    answer.readings.push({ operation });
                    onEvent({ type: 'operation', operation });
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);

                    answer.readings.push({ problem: `Operation ${index + 1}: ${message}` });
                }
                break;
            }
            case 'message':
                answer.messages.push(event.text);
                onEvent({ type: 'message', text: event.text });
                break;
            case 'done':
                return answer;
            case 'error':
                throw new Refusal(PROBLEMS[event.code] ?? FAILED);
        }
    }

    throw new Refusal(FAILED);
}

/** The answer's operations if each was read and they apply together, else the first problem. */
function examine(
    { readings }: Answer,
    check: (operations: ProposedOperation[]) => OperationsCheck
): OperationsCheck & { operations: ProposedOperation[] } {
    const operations = readings.flatMap((reading) =>
        'operation' in reading ? [reading.operation] : []
    );
    const unread = readings.findIndex((reading) => 'problem' in reading);
    const reading = readings[unread];

    if (reading && 'problem' in reading) {
        return { valid: false, operation: unread, problem: reading.problem, operations };
    }

    return { ...check(operations), operations };
}

/** The proposal an answer makes, or why it makes none, as when the model only answered in words. */
function conclude(
    { requestId, model, readings, messages }: Answer,
    checked: ReturnType<typeof examine>
): ProposalResult {
    if (readings.length === 0) {
        return { kind: 'failed', problem: messages.join('\n') || 'Nothing was proposed.' };
    }

    return checked.valid
        ? { kind: 'proposed', requestId, model, operations: checked.operations }
        : { kind: 'failed', problem: checked.problem };
}

/**
 * Asks the model for a change to a document and checks the operations it
 * proposes with `check`. When they would not apply, the problem goes back to the
 * model once. Nothing is applied: the result is the proposal to show, or why
 * there is none. Aborting `signal` stops the model and cancels the proposal.
 */
export async function propose({
    send = sendToServer,
    documentId,
    request,
    check,
    signal,
    onEvent = () => {}
}: {
    send?: Send;
    documentId: string;
    request: AiRequest;
    check: (operations: ProposedOperation[]) => OperationsCheck;
    signal: AbortSignal;
    onEvent?: (event: ProposalEvent) => void;
}): Promise<ProposalResult> {
    const ask = async (path: string, body: object) =>
        receive(await send(path, body, signal), onEvent);

    try {
        const first = await ask(`/documents/${encodeURIComponent(documentId)}/requests`, request);
        const firstCheck = examine(first, check);

        if (firstCheck.valid || first.readings.length === 0) {
            return conclude(first, firstCheck);
        }

        const { operation, problem } = firstCheck;

        onEvent({ type: 'repairing', problem });

        const repaired = await ask(`/requests/${encodeURIComponent(first.requestId)}/repairs`, {
            operation,
            problem
        });

        return conclude(repaired, examine(repaired, check));
    } catch (error) {
        if (signal.aborted) {
            return { kind: 'cancelled' };
        }

        return { kind: 'failed', problem: error instanceof Refusal ? error.message : FAILED };
    }
}
