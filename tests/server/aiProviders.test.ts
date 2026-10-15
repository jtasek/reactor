import { providerFromEnv } from '../../server/ai';
import type { Conversation, TurnHandlers } from '../../server/aiTasks';
import { chatAnswer, answer, replay, type StreamEvent } from '../ai/replay';

const label = {
    name: 'addShape',
    input: { key: 'label', shape: { type: 'text', position: { x: 0, y: 0 }, value: 'Hi' } }
};
const box = {
    name: 'addShape',
    input: {
        key: 'box',
        shape: { type: 'rectangle', position: { x: 0, y: 0 }, size: { width: 20, height: 10 } }
    }
};

const conversation: Conversation = {
    request: {
        task: 'edit',
        prompt: 'Add a label',
        context: { shapes: {} },
        image: { mediaType: 'image/png', data: 'iVBORw0KGgo=' }
    },
    repairs: []
};

/** A provider's fetch answering with `round`, keeping the address and headers asked. */
function server(round: StreamEvent[], provider: 'anthropic' | 'openai') {
    const replayed = replay([round], { provider });
    const asked: Array<{ url: string; headers: Headers }> = [];
    const fetch = (url: string | URL | Request, init?: RequestInit) => {
        asked.push({ url: String(url), headers: new Headers(init?.headers) });

        return replayed.fetch(url, init);
    };

    return { fetch, asked, sent: replayed.sent };
}

/** Runs one turn, keeping what the provider streamed, in order. */
async function turn(env: NodeJS.ProcessEnv, fetch: typeof globalThis.fetch) {
    const told: unknown[] = [];
    const on: TurnHandlers = {
        operation: (operation) => told.push(operation),
        message: (text) => told.push(text),
        usage: () => {}
    };
    const result = await providerFromEnv(env, fetch).turn(
        conversation,
        new AbortController().signal,
        on
    );

    return { told, result };
}

describe('AI providers', () => {
    it('are configured by AI_PROVIDER, refusing an incomplete configuration', () => {
        expect(() => providerFromEnv({ AI_PROVIDER: 'anthropic' })).toThrow(/AI_API_KEY/);
        expect(() => providerFromEnv({ AI_PROVIDER: 'openai' })).toThrow(/AI_EDIT_MODEL/);
        expect(() => providerFromEnv({ AI_PROVIDER: 'elsewhere' })).toThrow(/anthropic, openai/);
        expect(providerFromEnv({ AI_PROVIDER: 'anthropic', AI_API_KEY: 'key' }).model('edit')).toBe(
            'claude-haiku-5-5'
        );
        expect(
            providerFromEnv({ AI_PROVIDER: 'openai', AI_EDIT_MODEL: 'local-model' }).model('edit')
        ).toBe('local-model');
    });

    it('call an OpenAI-compatible server at its address, with a key only when given', async () => {
        const local = server(chatAnswer({ calls: [label] }), 'openai');

        await turn(
            {
                AI_PROVIDER: 'openai',
                AI_BASE_URL: 'http://127.0.0.1:11434/v1/',
                AI_EDIT_MODEL: 'local-model'
            },
            local.fetch
        );

        expect(local.asked[0].url).toBe('http://127.0.0.1:11434/v1/chat/completions');
        expect(local.asked[0].headers.has('authorization')).toBe(false);

        const hosted = server(chatAnswer({ calls: [label] }), 'openai');

        await turn(
            { AI_PROVIDER: 'openai', AI_API_KEY: 'key', AI_EDIT_MODEL: 'hosted-model' },
            hosted.fetch
        );

        expect(hosted.asked[0].url).toBe('https://api.openai.com/v1/chat/completions');
        expect(hosted.asked[0].headers.get('authorization')).toBe('Bearer key');
        expect(hosted.sent[0].body).toMatchObject({
            model: 'hosted-model',
            stream: true,
            tool_choice: 'auto',
            tools: expect.arrayContaining([
                expect.objectContaining({
                    type: 'function',
                    function: expect.objectContaining({ name: 'addShape' })
                })
            ])
        });
        expect(hosted.sent[0].body.messages[0]).toMatchObject({ role: 'system' });
        expect(hosted.sent[0].body.messages[1].content[1]).toEqual({
            type: 'image_url',
            image_url: { url: 'data:image/png;base64,iVBORw0KGgo=' }
        });
    });

    it.each(['anthropic', 'openai'] as const)(
        'stream the words, then each call of %s, and answer them for a repair',
        async (provider) => {
            const round = (provider === 'anthropic' ? answer : chatAnswer)({
                text: 'Adding both.',
                calls: [label, box]
            });
            const { fetch } = server(round, provider);
            const { told, result } = await turn(
                { AI_PROVIDER: provider, AI_API_KEY: 'key', AI_EDIT_MODEL: 'model' },
                fetch
            );

            expect(told).toEqual([
                'Adding both.',
                { op: 'addShape', ...label.input },
                { op: 'addShape', ...box.input }
            ]);
            expect(result.stop).toBe('done');
            expect(result.answer.calls).toEqual([
                { id: expect.any(String), ...label },
                { id: expect.any(String), ...box }
            ]);
        }
    );

    it.each([
        ['anthropic', 'refusal', 'refused'],
        ['anthropic', 'max_tokens', 'incomplete'],
        ['openai', 'content_filter', 'refused'],
        ['openai', 'length', 'incomplete']
    ] as const)('read %s stopping for %s as %s', async (provider, stopReason, stop) => {
        const round = (provider === 'anthropic' ? answer : chatAnswer)({
            calls: [label],
            stopReason
        });
        const { fetch } = server(round, provider);
        const { result } = await turn(
            { AI_PROVIDER: provider, AI_API_KEY: 'key', AI_EDIT_MODEL: 'model' },
            fetch
        );

        expect(result.stop).toBe(stop);
    });
});
