import { configuresAi, providerFromEnv } from '../../server/ai';
import type { Conversation } from '../../server/aiTasks';
import { answer, chatAnswer, replay, type StreamEvent } from '../ai/replay';

const label = {
    name: 'addShape',
    input: { key: 'label', shape: { type: 'text', position: { x: 0, y: 0 }, value: 'Hi' } }
};
const box = {
    name: 'addShape',
    input: {
        key: 'box',
        shape: { type: 'rectangle', position: { x: 0, y: 20 }, size: { width: 20, height: 10 } }
    }
};
const conversation: Conversation = {
    request: { task: 'edit', prompt: 'Add two shapes', context: {} },
    repairs: []
};

async function turn(provider: 'anthropic' | 'openai', events: StreamEvent[]) {
    const operations: object[] = [];
    const recorded = replay([events], { provider });
    const result = await providerFromEnv(
        { AI_PROVIDER: provider, AI_API_KEY: 'test', AI_EDIT_MODEL: 'test-model' },
        recorded.fetch
    ).turn(conversation, new AbortController().signal, {
        operation: (operation) => operations.push(operation),
        message: () => {},
        usage: () => {}
    });

    return { result, operations };
}

describe('provider compatibility', () => {
    it('keeps the original Anthropic environment configuration working', () => {
        const env = { ANTHROPIC_API_KEY: 'legacy-key' };

        expect(configuresAi(env)).toBe(true);
        expect(providerFromEnv(env).model('edit')).toBe('claude-haiku-5-5');
        expect(
            providerFromEnv({ ...env, AI_PROVIDER: 'openai', AI_EDIT_MODEL: 'local-model' }).model(
                'edit'
            )
        ).toBe('local-model');
    });

    it('assembles interleaved calls before streaming their complete operations in order', async () => {
        const chunk = (toolCalls: object[], finishReason: string | null = null) => ({
            choices: [{ index: 0, delta: { tool_calls: toolCalls }, finish_reason: finishReason }]
        });
        const { result, operations } = await turn('openai', [
            chunk([
                { index: 0, id: 'label-call', function: { name: label.name, arguments: '' } },
                { index: 1, id: 'box-call', function: { name: box.name, arguments: '' } }
            ]),
            chunk([{ index: 1, function: { arguments: JSON.stringify(box.input) } }]),
            chunk([{ index: 0, function: { arguments: JSON.stringify(label.input) } }]),
            chunk([], 'tool_calls')
        ]);

        expect(result.stop).toBe('done');
        expect(operations).toEqual([
            { op: label.name, ...label.input },
            { op: box.name, ...box.input }
        ]);
        expect(result.answer.calls.map(({ input }) => input)).toEqual([label.input, box.input]);
    });

    it('reads calls from a server that sends them without an index', async () => {
        const chunk = (toolCalls: object[], finishReason: string | null = null) => ({
            choices: [{ index: 0, delta: { tool_calls: toolCalls }, finish_reason: finishReason }]
        });
        const { result, operations } = await turn('openai', [
            chunk([{ id: 'label-call', function: { name: label.name, arguments: '' } }]),
            chunk([{ function: { arguments: JSON.stringify(label.input) } }]),
            chunk([
                {
                    id: 'box-call',
                    function: { name: box.name, arguments: JSON.stringify(box.input) }
                }
            ]),
            chunk([], 'tool_calls')
        ]);

        expect(result.stop).toBe('done');
        expect(operations).toEqual([
            { op: label.name, ...label.input },
            { op: box.name, ...box.input }
        ]);
        expect(result.answer.calls.map(({ id }) => id)).toEqual(['label-call', 'box-call']);
    });

    it.each(['anthropic', 'openai'] as const)(
        'does not accept %s ending before its completion events',
        async (provider) => {
            const events = (provider === 'anthropic' ? answer : chatAnswer)({ calls: [label] });
            // Keep a completed call, but leave out the answer's final status and usage.
            const { result } = await turn(provider, events.slice(0, -2));

            expect(result.stop).toBe('incomplete');
        }
    );

    it.each(['anthropic', 'openai'] as const)(
        'does not treat an unknown %s stop reason as success',
        async (provider) => {
            const events = (provider === 'anthropic' ? answer : chatAnswer)({
                calls: [label],
                stopReason: 'unknown'
            });
            const { result } = await turn(provider, events);

            expect(result.stop).toBe('incomplete');
        }
    );

    it('requires Anthropic to finish the message, even after reporting its stop reason', async () => {
        const events = answer({ calls: [label] });
        const { result } = await turn('anthropic', events.slice(0, -1));

        expect(result.stop).toBe('incomplete');
    });
});
