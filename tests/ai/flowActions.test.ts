import { describe, expect, it } from 'vitest';
import { propose } from 'src/ai/client';
import { documentContext } from 'src/ai/context';
import { describeOperation } from 'src/ai/describe';
import { LOCAL_MODEL_TIMING, localSend } from 'src/ai/localModel';
import { interpret } from 'src/ai/local/interpret';
import { readOperations } from 'src/ai/operations';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { startScreen } from 'src/app/screens';
import type { Document } from 'src/app/types';
import { previewFixture } from '../support/preview';
import { createTestStore } from '../support/store';

/** Home with an unlinked Continue button and Details, and a second control when asked. */
function fixture({ second = false } = {}) {
    const document = previewFixture();
    const next = document.shapes.next;
    if (next.type !== 'instance') {
        throw new Error('Expected the Continue button');
    }
    next.interactions = { activate: null };
    if (second) {
        document.shapes.skip = {
            ...next,
            id: 'skip',
            name: 'Continue later',
            order: 'a5',
            position: { x: 24, y: 160 }
        };
    }

    return document;
}

async function storeWith(document: Document) {
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    const { store } = createTestStore({ reactor: JSON.stringify(saved) });
    await store.onInitialize();

    return store;
}

/** What the chat shares of the document, as the editor holds it. */
const contextOf = async (document: Document) =>
    documentContext((await storeWith(document)).state.currentDocument);

const proposeLocally = async (document: Document, prompt: string) => {
    const store = await storeWith(document);
    Object.assign(LOCAL_MODEL_TIMING, { eventMs: 0 });
    const result = await propose({
        send: localSend,
        documentId: document.id,
        request: { task: 'edit', prompt, context: documentContext(store.state.currentDocument) },
        check: (operations) =>
            store.actions.checkOperations({ documentId: document.id, operations }),
        signal: new AbortController().signal
    });

    return { store, result };
};

describe('the flow the chat shares', () => {
    it('lists each page’s controls with their labels, what they do, and the start', async () => {
        const document = fixture();
        Object.assign(document.shapes.next, {
            interactions: { activate: { type: 'navigate', screenId: 'details' } }
        });

        expect((await contextOf(document)).flow).toEqual({
            startScreenId: 'home',
            screens: {
                home: {
                    name: 'Home',
                    controls: {
                        next: { name: 'Continue button', label: 'Continue', does: 'opens Details' },
                        name: { name: 'Name field', label: 'Your name' }
                    }
                },
                details: { name: 'Details', controls: {} }
            },
            states: {}
        });
    });
});

describe('setting what a tap does', () => {
    it('reads setAction as the change to the control’s action, described as Flow says it', () => {
        const document = fixture();
        const operations = readOperations({
            op: 'setAction',
            control: 'next',
            action: { type: 'navigate', screenId: 'details' }
        });

        expect(operations).toEqual([
            {
                op: 'updateShape',
                shape: 'next',
                changes: { interactions: { activate: { type: 'navigate', screenId: 'details' } } }
            }
        ]);
        expect(describeOperation(operations[0], document)).toBe(
            'On “Home”, “Continue button” opens “Details”'
        );
    });

    it('refuses actions the Flow menu would refuse', async () => {
        const document = fixture();
        const store = await storeWith(document);
        const check = (action: unknown) =>
            store.actions.checkOperations({
                documentId: document.id,
                operations: readOperations({ op: 'setAction', control: 'next', action })
            });

        expect(check({ type: 'navigate', screenId: 'details' })).toEqual({ valid: true });
        expect(check(null)).toEqual({ valid: true });
        expect(check({ type: 'navigate', screenId: 'nowhere' })).toMatchObject({
            valid: false,
            problem: expect.stringContaining('nowhere is not a page.')
        });
        expect(check({ type: 'toggleVisibility', instanceId: 'next' })).toMatchObject({
            valid: false,
            problem: expect.stringContaining('another instance on its page')
        });
        expect(check({ type: 'state', change: 'toggle', stateId: 'missing' })).toMatchObject({
            valid: false,
            problem: expect.stringContaining('The state it changes was deleted.')
        });
    });

    it.each(['details', 'home'])(
        'validates a moved control against its new page (%s)',
        async (targetPage) => {
            const document = fixture({ second: true });
            document.shapes.skip.parentFrameId = targetPage;
            const store = await storeWith(document);
            const result = store.actions.checkOperations({
                documentId: document.id,
                operations: [
                    {
                        op: 'updateShape',
                        shape: 'next',
                        changes: {
                            parentFrameId: 'details',
                            interactions: {
                                activate: { type: 'toggleVisibility', instanceId: 'skip' }
                            }
                        }
                    }
                ]
            });

            expect(result.valid).toBe(targetPage === 'details');
            expect(store.state.currentDocument.shapes.next.parentFrameId).toBe('home');
        }
    );

    it('validates against a target moved in the same batch', async () => {
        const document = fixture({ second: true });
        const store = await storeWith(document);
        const result = store.actions.checkOperations({
            documentId: document.id,
            operations: [
                {
                    op: 'updateShape',
                    shape: 'next',
                    changes: {
                        parentFrameId: 'details',
                        interactions: { activate: { type: 'toggleVisibility', instanceId: 'skip' } }
                    }
                },
                { op: 'updateShape', shape: 'skip', changes: { parentFrameId: 'details' } }
            ]
        });

        expect(result).toEqual({ valid: true });
    });

    it('links a control from a sentence with the local test model', async () => {
        const document = fixture();
        const { store, result } = await proposeLocally(
            document,
            'Open Details when I click Continue'
        );

        expect(result).toMatchObject({
            kind: 'proposed',
            operations: [
                {
                    op: 'updateShape',
                    shape: 'next',
                    changes: {
                        interactions: { activate: { type: 'navigate', screenId: 'details' } }
                    }
                }
            ]
        });
        if (result.kind !== 'proposed') {
            return;
        }
        expect(
            store.actions.applyOperations({
                documentId: document.id,
                by: { kind: 'person' },
                operations: result.operations
            })
        ).toEqual({ applied: true, ids: {} });
        expect(store.state.currentDocument.shapes.next).toMatchObject({
            interactions: { activate: { type: 'navigate', screenId: 'details' } }
        });
    });

    it('starts the prototype on a page', async () => {
        const document = fixture();
        const { store, result } = await proposeLocally(document, 'start on Details');

        expect(result).toMatchObject({
            kind: 'proposed',
            operations: [{ op: 'updateFrame', frame: 'details', changes: { start: true } }]
        });
        if (result.kind !== 'proposed') {
            return;
        }
        expect(describeOperation(result.operations[0], document)).toBe(
            'Start the prototype on “Details”'
        );
        store.actions.applyOperations({
            documentId: document.id,
            by: { kind: 'person' },
            operations: result.operations
        });
        expect(startScreen(store.state.currentDocument)?.id).toBe('details');
    });
});

describe('local test model link sentences', () => {
    const read = async (prompt: string, document = fixture()) =>
        interpret(prompt, (await contextOf(document)) as never);
    const link = {
        op: 'setAction',
        control: 'next',
        action: { type: 'navigate', screenId: 'details' }
    };

    it.each([
        'open Details when I click Continue',
        'go to the Details page when someone taps the Continue button',
        'When I tap Continue on Home, open Details',
        'link Continue button to Details',
        'Continue opens Details'
    ])('reads “%s”', async (prompt) => {
        expect(await read(prompt)).toEqual({ operations: [link], text: '' });
    });

    it.each(['make Continue bigger to fit', 'the Continue button goes to the top'])(
        'leaves “%s” to the other requests',
        async (prompt) => {
            expect((await read(prompt)).text).not.toContain('No page is named like');
        }
    );

    it('takes a link away', async () => {
        expect((await read('unlink Continue')).operations).toEqual([
            { op: 'setAction', control: 'next', action: null }
        ]);
    });

    it('asks which control when two fit equally, offering a sentence for each', async () => {
        const { operations, text } = await read(
            'open Details when I click Continue',
            fixture({ second: true })
        );

        expect(operations).toEqual([]);
        expect(text).toBe(
            [
                'Which “Continue”? Pick one:',
                '- `open Details when I click Continue button on Home`',
                '- `open Details when I click Continue later on Home`'
            ].join('\n')
        );
        expect(
            (
                await read(
                    'open Details when I click Continue later on Home',
                    fixture({ second: true })
                )
            ).operations
        ).toEqual([{ ...link, control: 'skip' }]);
    });

    it('names the pages when the one asked for is missing', async () => {
        expect((await read('open Settings when I click Continue')).text).toBe(
            'No page is named like `Settings`. Pages: `Home` · `Details`'
        );
    });

    it('offers a link example made from the document’s pages in help', async () => {
        expect((await read('help')).text).toContain(
            '**Link**\n- `open Details when I click Continue`'
        );
    });
});
