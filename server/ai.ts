import { randomUUID } from 'node:crypto';
import express, { type Request, type Response } from 'express';
import {
    isAiTask,
    repairConversation,
    startConversation,
    taskModel,
    type AiProvider,
    type AiRequest,
    type Block,
    type Conversation,
    type Problem,
    type Usage
} from './anthropic.ts';
import { imageType } from './assets.ts';
import { allows, workspaceRole } from './workspaces.ts';
import type { Db } from './schema.ts';

/** What one person, and one workspace, may use of AI in a day. */
export interface AiLimits {
    personRequests: number;
    personTokens: number;
    workspaceRequests: number;
    workspaceTokens: number;
}

export const AI_LIMITS: AiLimits = {
    personRequests: 100,
    personTokens: 2_000_000,
    workspaceRequests: 500,
    workspaceTokens: 10_000_000
};

const LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;

const MAX_PROMPT_LENGTH = 2000;

/** Characters of the document's JSON, about 50,000 tokens. */
const MAX_CONTEXT_LENGTH = 200_000;

/** The provider takes images of up to 5 MB once in base64. */
const MAX_IMAGE_BYTES = 3.75 * 1024 * 1024;

/** A request's body: its context and image in base64. */
const MAX_REQUEST_BODY = '6mb';

/** How long a request's conversation is kept for its repair. */
const REPAIR_WINDOW_MS = 5 * 60 * 1000;

const TURN_TIMEOUT_MS = 60_000;

const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

/** Whether the request asks for a change, the one whose body may hold a document and an image. */
export const sendsAiRequest = (req: Request) =>
    req.method === 'POST' && /^\/ai\/documents\/[^/]+\/requests$/.test(req.path);

class Refusal extends Error {
    status: number;

    constructor(status: number, code: string) {
        super(code);
        this.status = status;
    }
}

function readImage(value: unknown): AiRequest['image'] {
    if (value === undefined) {
        return undefined;
    }

    const data: unknown = Reflect.get(Object(value), 'data');

    if (typeof data !== 'string' || !BASE64.test(data)) {
        throw new Refusal(400, 'INVALID_IMAGE');
    }

    const bytes = Buffer.from(data, 'base64');
    const mediaType = bytes.length <= MAX_IMAGE_BYTES ? imageType(bytes) : null;

    if (!mediaType) {
        throw new Refusal(400, 'INVALID_IMAGE');
    }

    return { mediaType, data };
}

function readRequest(body: unknown): AiRequest {
    const { task, prompt, context = {}, image } = Object(body) as Record<string, unknown>;

    if (!isAiTask(task)) {
        throw new Refusal(400, 'INVALID_TASK');
    }

    if (
        typeof prompt !== 'string' ||
        prompt.trim().length === 0 ||
        prompt.length > MAX_PROMPT_LENGTH
    ) {
        throw new Refusal(400, 'INVALID_PROMPT');
    }

    if (
        !context ||
        typeof context !== 'object' ||
        Array.isArray(context) ||
        JSON.stringify(context).length > MAX_CONTEXT_LENGTH
    ) {
        throw new Refusal(400, 'INVALID_CONTEXT');
    }

    return { task, prompt: prompt.trim(), context, image: readImage(image) };
}

function readProblem(body: unknown): Problem {
    const { operation, problem } = Object(body) as Record<string, unknown>;

    if (
        typeof problem !== 'string' ||
        problem.length === 0 ||
        problem.length > MAX_PROMPT_LENGTH ||
        (operation !== undefined && !(Number.isInteger(operation) && Number(operation) >= 0))
    ) {
        throw new Refusal(400, 'INVALID_PROBLEM');
    }

    return { operation: operation as number | undefined, problem };
}

/** The workspace of a document the person may edit; refuses others as missing or forbidden. */
async function editableDocument(db: Db, userId: string, documentId: string) {
    const document = await db
        .selectFrom('documents')
        .select('workspace_id')
        .where('id', '=', documentId)
        .executeTakeFirst();
    const role = document && (await workspaceRole(db, userId, document.workspace_id));

    if (!document || !allows(role, 'viewer')) {
        throw new Refusal(404, 'NOT_FOUND');
    }

    if (!allows(role, 'editor')) {
        throw new Refusal(403, 'FORBIDDEN');
    }

    return document.workspace_id;
}

/** Whether the person or the workspace used up a day's requests or tokens. */
async function reachedLimits(db: Db, limits: AiLimits, userId: string, workspaceId: string) {
    const used = await db
        .selectFrom('ai_requests')
        .where('created_at', '>', new Date(Date.now() - LIMIT_WINDOW_MS))
        .where((eb) => eb.or([eb('user_id', '=', userId), eb('workspace_id', '=', workspaceId)]))
        .select((eb) => {
            const tokens = eb('input_tokens', '+', eb.ref('output_tokens'));

            return [
                eb.fn.countAll<string>().filterWhere('user_id', '=', userId).as('personRequests'),
                eb.fn.sum<string>(tokens).filterWhere('user_id', '=', userId).as('personTokens'),
                eb.fn
                    .countAll<string>()
                    .filterWhere('workspace_id', '=', workspaceId)
                    .as('workspaceRequests'),
                eb.fn
                    .sum<string>(tokens)
                    .filterWhere('workspace_id', '=', workspaceId)
                    .as('workspaceTokens')
            ];
        })
        .executeTakeFirstOrThrow();

    return (Object.keys(limits) as Array<keyof AiLimits>).some(
        (limit) => Number(used[limit] ?? 0) >= limits[limit]
    );
}

interface Kept {
    userId: string;
    documentId: string;
    conversation: Conversation;
    content: Block[];
    until: number;
}

/**
 * The AI gateway, mounted at `/api/ai` behind the API's session and `Origin`
 * checks. A request streams back one JSON event per line: `start`, then each
 * `operation` and `message` as the model finishes it, then `done` or `error`.
 * The editor checks the operations and may send one repair with its problem.
 */
export function createAi({
    db,
    provider,
    limits = AI_LIMITS
}: {
    db: Db;
    provider: AiProvider;
    limits?: AiLimits;
}) {
    const router = express.Router();
    /** People with a request running: each may run one at a time. */
    const busy = new Set<string>();
    const kept = new Map<string, Kept>();

    const keep = (requestId: string, entry: Kept) => {
        const now = Date.now();

        kept.forEach(({ until }, id) => until < now && kept.delete(id));
        kept.set(requestId, entry);
    };

    const addUsage = (requestId: string, { inputTokens, outputTokens }: Usage) =>
        db
            .updateTable('ai_requests')
            .set((eb) => ({
                input_tokens: eb('input_tokens', '+', inputTokens),
                output_tokens: eb('output_tokens', '+', outputTokens)
            }))
            .where('id', '=', requestId)
            .execute();

    /** Streams one turn of the model to the response; a first one is kept for its repair. */
    async function streamTurn(
        req: Request<object>,
        res: Response,
        requestId: string,
        documentId: string,
        conversation: Conversation,
        repairable: boolean
    ) {
        const controller = new AbortController();
        const send = (event: object) => res.write(`${JSON.stringify(event)}\n`);
        let usage: Usage = { inputTokens: 0, outputTokens: 0 };

        res.on('close', () => controller.abort());
        // Not compressed, as compression holds back what is written until it ends.
        res.status(200).set({
            'Content-Type': 'application/x-ndjson',
            'Cache-Control': 'no-store, no-transform'
        });
        send({ type: 'start', requestId, model: taskModel(conversation.task) });

        try {
            const turn = await provider.turn(
                conversation,
                AbortSignal.any([controller.signal, AbortSignal.timeout(TURN_TIMEOUT_MS)]),
                {
                    operation: (operation) => send({ type: 'operation', operation }),
                    message: (text) => send({ type: 'message', text }),
                    usage: (used) => {
                        usage = used;
                    }
                }
            );

            if (turn.stopReason === 'refusal' || turn.stopReason === 'max_tokens') {
                send({
                    type: 'error',
                    code: turn.stopReason === 'refusal' ? 'AI_REFUSED' : 'AI_INCOMPLETE'
                });

                return;
            }

            if (repairable && turn.content.some(({ type }) => type === 'tool_use')) {
                keep(requestId, {
                    userId: req.userId,
                    documentId,
                    conversation,
                    content: turn.content,
                    until: Date.now() + REPAIR_WINDOW_MS
                });
            }
            send({ type: 'done' });
        } catch (error) {
            if (!controller.signal.aborted) {
                (req.log ?? console).error(error);
                send({ type: 'error', code: 'AI_FAILED' });
            }
        } finally {
            await addUsage(requestId, usage);
            res.end();
        }
    }

    /** Runs `work` for the person alone, refusing them while another request of theirs runs. */
    async function oneAtATime(userId: string, work: () => Promise<void>) {
        if (busy.has(userId)) {
            throw new Refusal(429, 'AI_BUSY');
        }

        busy.add(userId);
        try {
            await work();
        } finally {
            busy.delete(userId);
        }
    }

    const handle =
        <Params>(route: (req: Request<Params>, res: Response) => Promise<void>) =>
        async (req: Request<Params>, res: Response) => {
            try {
                await route(req, res);
            } catch (error) {
                if (!(error instanceof Refusal)) {
                    throw error;
                }
                res.status(error.status).json({ code: error.message });
            }
        };

    router.get('/', (_req, res) => {
        res.json({ available: true });
    });

    router.post(
        '/documents/:documentId/requests',
        // The body is read only once the person may edit, so nobody else makes the server hold it.
        handle<{ documentId: string }>(async (req, res) => {
            const workspaceId = await editableDocument(db, req.userId, req.params.documentId);

            await new Promise<void>((resolve, reject) =>
                express.json({ limit: MAX_REQUEST_BODY })(req, res, (error?: unknown) =>
                    error ? reject(error) : resolve()
                )
            );
            const request = readRequest(req.body);

            await oneAtATime(req.userId, async () => {
                if (await reachedLimits(db, limits, req.userId, workspaceId)) {
                    throw new Refusal(429, 'AI_LIMIT_REACHED');
                }

                const requestId = randomUUID();

                await db
                    .insertInto('ai_requests')
                    .values({
                        id: requestId,
                        workspace_id: workspaceId,
                        user_id: req.userId,
                        document_id: req.params.documentId,
                        task: request.task,
                        model: taskModel(request.task)
                    })
                    .execute();
                await streamTurn(
                    req,
                    res,
                    requestId,
                    req.params.documentId,
                    startConversation(request),
                    true
                );
            });
        })
    );

    router.post(
        '/requests/:requestId/repairs',
        handle<{ requestId: string }>(async (req, res) => {
            const { requestId } = req.params;
            const entry = kept.get(requestId);

            if (!entry || entry.userId !== req.userId || entry.until < Date.now()) {
                throw new Refusal(404, 'NOT_FOUND');
            }

            const problem = readProblem(req.body);

            // A request is repaired once.
            kept.delete(requestId);
            await editableDocument(db, req.userId, entry.documentId);
            await oneAtATime(req.userId, () =>
                streamTurn(
                    req,
                    res,
                    requestId,
                    entry.documentId,
                    repairConversation(entry.conversation, entry.content, problem),
                    false
                )
            );
        })
    );

    return router;
}
