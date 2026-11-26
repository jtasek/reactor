import { propose, type ProposalEvent } from 'src/ai/client';
import { documentContext } from 'src/ai/context';
import { LOCAL_MODEL, LOCAL_MODEL_HELP, LOCAL_MODEL_TIMING, localSend } from 'src/ai/localModel';
import type { Point } from 'src/app/types';
import { createTestStore } from '../support/store';

const timing = { ...LOCAL_MODEL_TIMING };

beforeAll(() => Object.assign(LOCAL_MODEL_TIMING, { eventMs: 0, slowEventMs: 0 }));
afterAll(() => Object.assign(LOCAL_MODEL_TIMING, timing));

/** A shape the model drew, read loosely: each kind it draws has a position. */
type Drawn = { id: string; type: string; position: Point } & Record<string, unknown>;

/** Asks the local test model for `prompt` in `store`'s document, checked as the chat checks it. */
async function ask(
    store: ReturnType<typeof createTestStore>['store'],
    prompt: string,
    signal = new AbortController().signal
) {
    const documentId = store.state.currentDocumentId;
    const events: ProposalEvent[] = [];
    const result = await propose({
        send: localSend,
        documentId,
        request: { task: 'edit', prompt, context: documentContext(store.state.currentDocument) },
        check: (operations) => store.actions.checkOperations({ documentId, operations }),
        signal,
        onEvent: (event) => events.push(event)
    });

    return { result, events };
}

/** Asks for `prompt` and accepts the proposal, as Accept does. */
async function accept(store: ReturnType<typeof createTestStore>['store'], prompt: string) {
    const { result } = await ask(store, prompt);

    if (result.kind !== 'proposed') {
        throw new Error(`Nothing was proposed: ${JSON.stringify(result)}`);
    }
    expect(result.model).toBe(LOCAL_MODEL);
    expect(
        store.actions.applyOperations({
            documentId: store.state.currentDocumentId,
            by: { kind: 'ai', model: result.model, requestId: result.requestId },
            operations: result.operations
        }).applied
    ).toBe(true);

    return Object.values(store.state.currentDocument.shapes) as unknown as Drawn[];
}

describe('the local test model', () => {
    it('adds shapes in words, with a count, color, size and name', async () => {
        const { store } = createTestStore();

        const circles = await accept(store, 'Add 3 red circles named "Dot"');
        expect(circles.map(({ type, name, fill }) => ({ type, name, fill }))).toEqual([
            { type: 'ellipse', name: 'Dot 1', fill: '#e5484d' },
            { type: 'ellipse', name: 'Dot 2', fill: '#e5484d' },
            { type: 'ellipse', name: 'Dot 3', fill: '#e5484d' }
        ]);

        const shapes = await accept(store, 'add a 200x60 #112233 rectangle');
        const rectangle = shapes.find((shape) => shape.type === 'rectangle')!;
        expect(rectangle).toMatchObject({ size: { width: 200, height: 60 }, fill: '#112233' });
        // Below the circles, not over them.
        expect(rectangle.position.y).toBeGreaterThan(
            Math.max(...circles.map(({ position, radius }) => position.y + (radius as Point).y))
        );

        const texts = await accept(store, 'Add text "Welcome"');
        expect(texts.find((shape) => shape.type === 'text')).toMatchObject({ value: 'Welcome' });
    });

    it('changes the selected shapes: color, name, position and delete', async () => {
        const { store } = createTestStore();
        const [first] = await accept(store, 'add two squares');
        const id = first.id;

        store.actions.selectShape(id);
        expect(
            (await accept(store, 'make it green')).find((shape) => shape.id === id)
        ).toMatchObject({
            fill: '#30a46c'
        });
        expect(
            (await accept(store, 'rename to "Card"')).find((shape) => shape.id === id)
        ).toMatchObject({
            name: 'Card'
        });
        const before = (store.state.currentDocument.shapes[id] as unknown as Drawn).position;
        expect(
            (await accept(store, 'move it right 40')).find((shape) => shape.id === id)?.position
        ).toEqual({
            x: before.x + 40,
            y: before.y
        });
        expect((await accept(store, 'delete it')).map((shape) => shape.id)).not.toContain(id);
        expect(Object.keys(store.state.currentDocument.shapes)).toHaveLength(1);
    });

    it('changes the selected text, and asks for a selection rather than adding text', async () => {
        const { store } = createTestStore();
        const [{ id }] = await accept(store, 'add text "Hello"');

        const unselected = await ask(store, 'change text to "Ahoj"');
        expect(unselected.result).toMatchObject({ kind: 'failed' });
        expect(unselected.events).toContainEqual(
            expect.objectContaining({
                type: 'message',
                text: expect.stringContaining('Select what to change')
            })
        );

        store.actions.selectShape(id);
        const [changed] = await accept(store, 'change text to "Ahoj"');
        expect(changed).toMatchObject({ id, value: 'Ahoj' });
        expect(Object.keys(store.state.currentDocument.shapes)).toHaveLength(1);
    });

    it('proposes changes the editor accepts: properties, copies, alignment and groups', async () => {
        const { store } = createTestStore();
        const [first, second] = await accept(store, 'add two squares');

        await accept(store, 'add text "Title" font size 32 bold');
        store.actions.selectShape(first.id);
        await accept(store, 'corner radius 12, opacity 50% and wider by 20');
        expect(store.state.currentDocument.shapes[first.id]).toMatchObject({
            cornerRadius: 12,
            opacity: 0.5,
            size: { width: 100, height: 80 }
        });

        const copies = await accept(store, 'duplicate');
        expect(copies.filter((shape) => shape.type === 'rectangle')).toHaveLength(3);

        // Nothing selected: shapes are found by what the request says.
        store.actions.unselectShapes();
        await accept(store, 'move all rectangles down 30');
        const moved = await accept(store, 'align top all rectangles');
        const tops = moved
            .filter((shape) => shape.type === 'rectangle')
            .map((shape) => shape.position.y);
        expect(new Set(tops).size).toBe(1);

        store.actions.selectShape(first.id);
        store.actions.selectShape(second.id);
        await accept(store, 'group as "Pair"');
        expect(Object.values(store.state.currentDocument.groups)).toMatchObject([
            { name: 'Pair', shapesIds: [first.id, second.id] }
        ]);
        await accept(store, 'ungroup');
        expect(Object.values(store.state.currentDocument.groups)).toEqual([]);
    });

    it('fixes a broken first answer with /repair, with or without a request', async () => {
        const { store } = createTestStore();
        const { result, events } = await ask(store, '/repair add a circle');

        expect(events.some((event) => event.type === 'repairing')).toBe(true);
        expect(result).toMatchObject({
            kind: 'proposed',
            operations: [{ op: 'addShape', shape: { type: 'ellipse' } }]
        });
        expect((await ask(store, '/repair')).result).toMatchObject({
            kind: 'proposed',
            operations: [{ op: 'addShape', shape: { type: 'rectangle' } }]
        });
    });

    it('reads how far to move before or after the direction', async () => {
        const { store } = createTestStore();
        const [{ id, position }] = await accept(store, 'add a square');

        store.actions.selectShape(id);
        await accept(store, 'move 30 down');
        const [moved] = await accept(store, 'move left');

        expect(moved.position).toEqual({ x: position.x - 20, y: position.y + 30 });
    });

    it.each([
        ['limit', 'used up today’s AI requests'],
        ['busy', 'still running'],
        ['refused', 'declined this request'],
        ['incomplete', 'too long'],
        ['off', 'turned AI off'],
        ['network', 'could not be reached']
    ])('reports /fail %s as the server would', async (failure, problem) => {
        const { store } = createTestStore();
        const { result } = await ask(store, `/fail ${failure}`);

        expect(result.kind).toBe('failed');
        expect(result.kind === 'failed' && result.problem).toContain(problem);
    });

    it('answers in words, and with what it understands when it does not', async () => {
        const { store } = createTestStore();

        expect((await ask(store, '/words Hello there')).result).toEqual({
            kind: 'failed',
            problem: 'Hello there'
        });
        // An unknown request gets a short answer, not the whole help again.
        const unknown = await ask(store, 'make a website');
        expect(unknown.result).toMatchObject({
            kind: 'failed',
            problem: expect.stringContaining("I didn't understand “website”")
        });
        expect(unknown.result).not.toMatchObject({ problem: LOCAL_MODEL_HELP });
        expect((await ask(store, 'help')).result).toEqual({
            kind: 'failed',
            problem: LOCAL_MODEL_HELP
        });
        expect((await ask(store, '/fail nonsense')).result).toEqual({
            kind: 'failed',
            problem: LOCAL_MODEL_HELP
        });
    });

    it('stops when cancelled', async () => {
        const { store } = createTestStore();
        const controller = new AbortController();
        const asked = ask(store, '/slow add a circle', controller.signal);

        controller.abort();
        expect((await asked).result).toEqual({ kind: 'cancelled' });
    });
});
