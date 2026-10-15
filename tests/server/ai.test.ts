import type { AiLimits } from '../../server/ai';
import { answer, replay, type StreamEvent } from '../ai/replay';
import { serve, type DocumentSummary, type ServeOptions } from './support';

const rectangle = {
    name: 'addShape',
    input: {
        key: 'box',
        shape: { type: 'rectangle', position: { x: 0, y: 0 }, size: { width: 20, height: 10 } }
    }
};
const label = {
    name: 'addShape',
    input: { key: 'label', shape: { type: 'text', position: { x: 0, y: 20 }, value: 'Hi' } }
};

/** The smallest PNG: one transparent pixel. */
const PNG =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

type Event = { type: string } & Record<string, unknown>;

/** The events of a streamed answer, one JSON object per line. */
const readEvents = async (response: Response) =>
    (await response.text())
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line) as Event);

/** A server answering AI requests with `rounds`, Ada signed in with a document of hers. */
async function setup(
    rounds: StreamEvent[][],
    { aiLimits, ...options }: Omit<ServeOptions, 'ai'> & { aiLimits?: AiLimits } = {}
) {
    const replayed = replay(rounds);
    const server = await serve({
        ...options,
        ai: { provider: replayed.provider, limits: aiLimits }
    });
    const ada = await server.user('ada@example.com');
    const document = await server.json<DocumentSummary>(
        server.call('POST', `/workspaces/${ada.personal.id}/documents`, {
            cookie: ada.cookie,
            body: { name: 'Draft' }
        })
    );
    const ask = (body: object, cookie = ada.cookie, documentId = document.id) =>
        server.call('POST', `/ai/documents/${documentId}/requests`, { cookie, body });
    const repair = (requestId: string, body: object, cookie = ada.cookie) =>
        server.call('POST', `/ai/requests/${requestId}/repairs`, { cookie, body });
    const requests = () => server.db.selectFrom('ai_requests').selectAll().execute();

    return { ...server, replayed, ada, document, ask, repair, requests, userId: userId(server) };
}

/** The id of the person whose personal workspace `workspace` is. */
const userId =
    ({ db }: Awaited<ReturnType<typeof serve>>) =>
    async (workspace: { id: string }) =>
        String(
            (
                await db
                    .selectFrom('workspaces')
                    .select('owner_id')
                    .where('id', '=', workspace.id)
                    .executeTakeFirstOrThrow()
            ).owner_id
        );

const EDIT = { task: 'edit', prompt: 'Add a box', context: { shapes: {} } };

describe('the AI gateway', () => {
    it('is off without a provider', async () => {
        const server = await serve();
        const { cookie } = await server.user('ada@example.com');

        expect((await server.call('GET', '/ai', { cookie })).status).toBe(404);
    });

    it('tells people signed in that AI is on', async () => {
        const { call, ada } = await setup([]);

        expect((await call('GET', '/ai')).status).toBe(401);
        expect(await (await call('GET', '/ai', { cookie: ada.cookie })).json()).toEqual({
            available: true
        });
    });

    it('streams the operations of a request, as the model finishes each, and records its use', async () => {
        const { ask, replayed, requests, ada, document } = await setup([
            answer({
                calls: [rectangle, label],
                text: 'Added.',
                inputTokens: 900,
                outputTokens: 120
            })
        ]);

        const response = await ask(EDIT);
        const events = await readEvents(response);

        expect(response.headers.get('content-type')).toContain('application/x-ndjson');
        expect(events).toEqual([
            { type: 'start', requestId: expect.any(String), model: 'claude-haiku-5-5' },
            { type: 'message', text: 'Added.' },
            { type: 'operation', operation: { op: 'addShape', ...rectangle.input } },
            { type: 'operation', operation: { op: 'addShape', ...label.input } },
            { type: 'done' }
        ]);

        const [{ body }] = replayed.sent;
        const [message] = body.messages;

        expect(body.model).toBe('claude-haiku-5-5');
        expect(message.content.map(({ type }) => type)).toEqual(['text', 'text']);
        expect(message.content[0].text).toContain('{"shapes":{}}');
        expect(message.content[1].text).toBe('Add a box');
        expect(await requests()).toMatchObject([
            {
                id: events[0].requestId,
                workspace_id: ada.personal.id,
                document_id: document.id,
                task: 'edit',
                model: 'claude-haiku-5-5',
                input_tokens: 900,
                output_tokens: 120
            }
        ]);
    });

    it('refuses other sites, people who may not edit and invalid requests', async () => {
        const server = await setup([answer({ calls: [rectangle] })]);
        const bob = await server.user('bob@example.com');
        const path = `/ai/documents/${server.document.id}/requests`;

        expect(
            (
                await server.call('POST', path, {
                    cookie: server.ada.cookie,
                    body: EDIT,
                    headers: { origin: 'https://evil.example' }
                })
            ).status
        ).toBe(403);
        expect((await server.ask(EDIT, bob.cookie)).status).toBe(404);

        await server.db
            .insertInto('workspace_members')
            .values({
                workspace_id: server.ada.personal.id,
                user_id: await server.userId(bob.personal),
                role: 'viewer'
            })
            .execute();
        expect(await (await server.ask(EDIT, bob.cookie)).json()).toEqual({ code: 'FORBIDDEN' });

        const refused = async (body: object) => (await (await server.ask(body)).json()).code;

        expect(await refused({ ...EDIT, task: 'write code' })).toBe('INVALID_TASK');
        expect(await refused({ ...EDIT, prompt: '  ' })).toBe('INVALID_PROMPT');
        expect(await refused({ ...EDIT, context: [] })).toBe('INVALID_CONTEXT');
        expect(await refused({ ...EDIT, image: { data: btoa('<svg/>') } })).toBe('INVALID_IMAGE');
        expect(await refused({ ...EDIT, image: { data: 'not base64!' } })).toBe('INVALID_IMAGE');
        expect(server.replayed.sent).toHaveLength(0);
        expect(await server.requests()).toEqual([]);
    });

    it('sends an image checked by its content', async () => {
        const { ask, replayed } = await setup([answer({ calls: [rectangle] })]);

        await (await ask({ ...EDIT, image: { data: PNG } })).text();

        expect(replayed.sent[0].body.messages[0].content[1]).toEqual({
            type: 'image',
            source: { type: 'base64', media_type: 'image/png', data: PNG }
        });
    });

    it('sends the editor’s problem back once, after the answer as the model gave it', async () => {
        const first = answer({ calls: [rectangle, label] });
        const { ask, repair, replayed, requests, user } = await setup([
            first,
            answer({ calls: [rectangle], inputTokens: 100, outputTokens: 10 })
        ]);
        const [start] = await readEvents(await ask(EDIT));
        const requestId = String(start.requestId);
        const bob = await user('bob@example.com');

        expect((await repair(requestId, { operation: 1, problem: 'x' }, bob.cookie)).status).toBe(
            404
        );
        expect((await repair(requestId, { operation: -1, problem: 'x' })).status).toBe(400);

        const events = await readEvents(
            await repair(requestId, { operation: 1, problem: 'Operation 2: label is taken.' })
        );

        expect(events.map(({ type }) => type)).toEqual(['start', 'operation', 'done']);
        expect(events[0].requestId).toBe(requestId);

        const [, assistant, results] = replayed.sent[1].body.messages;

        expect(assistant.role).toBe('assistant');
        expect(assistant.content.map(({ type }) => type)).toEqual([
            'thinking',
            'tool_use',
            'tool_use'
        ]);
        expect(assistant.content[0]).toEqual({ type: 'thinking', thinking: '', signature: 'c2ln' });
        expect(assistant.content[1]).toEqual({
            type: 'tool_use',
            id: 'toolu_1',
            name: 'addShape',
            input: rectangle.input
        });
        expect(results.content).toEqual([
            { type: 'tool_result', tool_use_id: 'toolu_1', content: 'Valid.' },
            {
                type: 'tool_result',
                tool_use_id: 'toolu_2',
                content: 'Operation 2: label is taken.',
                is_error: true
            },
            { type: 'text', text: expect.stringContaining('None of these operations') }
        ]);
        expect(await requests()).toMatchObject([{ input_tokens: 1300, output_tokens: 310 }]);
        expect((await repair(requestId, { problem: 'Still wrong.' })).status).toBe(404);
    });

    it('limits what each person and each workspace use in a day', async () => {
        const limits = {
            personRequests: 2,
            personTokens: 1_000_000,
            workspaceRequests: 3,
            workspaceTokens: 1_000_000
        };
        const replayed = replay(Array.from({ length: 5 }, () => answer({ calls: [rectangle] })));
        const server = await serve({ ai: { provider: replayed.provider, limits } });
        const ada = await server.user('ada@example.com');
        const bob = await server.user('bob@example.com');
        await server.db
            .insertInto('workspace_members')
            .values({
                workspace_id: ada.personal.id,
                user_id: await userId(server)(bob.personal),
                role: 'editor'
            })
            .execute();

        const { id } = await server.json<DocumentSummary>(
            server.call('POST', `/workspaces/${ada.personal.id}/documents`, {
                cookie: ada.cookie,
                body: { name: 'Shared' }
            })
        );
        const ask = async (cookie: string) => {
            const response = await server.call('POST', `/ai/documents/${id}/requests`, {
                cookie,
                body: EDIT
            });

            return response.status === 200 ? 'answered' : (await response.json()).code;
        };

        expect(await ask(ada.cookie)).toBe('answered');
        expect(await ask(ada.cookie)).toBe('answered');
        expect(await ask(ada.cookie)).toBe('AI_LIMIT_REACHED');
        expect(await ask(bob.cookie)).toBe('answered');
        expect(await ask(bob.cookie)).toBe('AI_LIMIT_REACHED');
        expect(replayed.sent).toHaveLength(3);
    });

    it('limits the tokens a person uses in a day', async () => {
        const { ask } = await setup(
            [answer({ calls: [rectangle], inputTokens: 900, outputTokens: 200 })],
            {
                aiLimits: {
                    personRequests: 100,
                    personTokens: 1000,
                    workspaceRequests: 100,
                    workspaceTokens: 1_000_000
                }
            }
        );

        await (await ask(EDIT)).text();

        expect(await (await ask(EDIT)).json()).toEqual({ code: 'AI_LIMIT_REACHED' });
    });

    it('runs one request of a person at a time, and stops the model when the editor goes', async () => {
        const replayed = replay([answer({ calls: [rectangle, label] })], { holdAfter: 9 });
        const server = await serve({ ai: { provider: replayed.provider } });
        const ada = await server.user('ada@example.com');
        const { id } = await server.json<DocumentSummary>(
            server.call('POST', `/workspaces/${ada.personal.id}/documents`, {
                cookie: ada.cookie,
                body: { name: 'Draft' }
            })
        );
        const path = `/ai/documents/${id}/requests`;
        const cancel = new AbortController();
        const running = await server.call('POST', path, {
            cookie: ada.cookie,
            body: EDIT,
            signal: cancel.signal
        });
        const reader = running.body!.pipeThrough(new TextDecoderStream()).getReader();
        let streamed = '';

        while (!streamed.includes('"operation"')) {
            streamed += (await reader.read()).value ?? '';
        }
        expect(
            await (await server.call('POST', path, { cookie: ada.cookie, body: EDIT })).json()
        ).toEqual({ code: 'AI_BUSY' });

        cancel.abort();
        await vi.waitFor(() => expect(replayed.sent[0].signal.aborted).toBe(true));
        await vi.waitFor(async () =>
            expect(
                await server.db.selectFrom('ai_requests').select('input_tokens').execute()
            ).toEqual([{ input_tokens: 1200 }])
        );
    });

    it('tells the editor when the model fails or refuses', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const { ask } = await setup([answer({ text: 'No.', stopReason: 'refusal' })]);

        expect((await readEvents(await ask(EDIT))).at(-1)).toEqual({
            type: 'error',
            code: 'AI_REFUSED'
        });
        expect((await readEvents(await ask(EDIT))).at(-1)).toEqual({
            type: 'error',
            code: 'AI_FAILED'
        });
    });
});
