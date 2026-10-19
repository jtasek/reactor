import * as Y from 'yjs';
import { projectFrameLayout, type LayoutNode, type StackRules } from './spikes/frameLayout';

const frame: LayoutNode = {
    id: 'screen',
    kind: 'frame',
    order: 'a',
    x: 100,
    y: 50,
    width: 400,
    height: 200,
    stack: { direction: 'row', gap: 10, padding: 20, align: 'center' }
};
const child = (id: string, order: string, changes: Partial<LayoutNode> = {}): LayoutNode => ({
    id,
    kind: 'shape',
    parentId: 'screen',
    order,
    x: 0,
    y: 0,
    width: 80,
    height: 40,
    ...changes
});
const fixture = () => [frame, child('first', 'a'), child('second', 'b')];

function sharedNode(record: LayoutNode) {
    const entries = Object.entries(record).map(([key, value]): [string, unknown] => [
        key,
        key === 'stack' && value ? new Y.Map(Object.entries(value)) : value
    ]);

    return new Y.Map<unknown>(entries);
}

/** Yjs keeps the concurrent map write of the copy with the higher client ID. */
const FIRST_CLIENT = 1;
const SECOND_CLIENT = 2;

/** Nested layout fields merge independently, as production entities do. */
function twoCopies(records = fixture()) {
    const first = new Y.Doc();
    first.clientID = FIRST_CLIENT;
    const table = first.getMap<Y.Map<unknown>>('nodes');
    for (const node of records) {
        table.set(node.id, sharedNode(node));
    }
    const second = new Y.Doc();
    second.clientID = SECOND_CLIENT;
    Y.applyUpdate(second, Y.encodeStateAsUpdate(first));

    onTestFinished(() => {
        first.destroy();
        second.destroy();
    });

    return [first, second];
}

const node = (doc: Y.Doc, id: string) => doc.getMap<Y.Map<unknown>>('nodes').get(id)!;
const rules = (doc: Y.Doc) => node(doc, 'screen').get('stack') as Y.Map<unknown>;
const project = (doc: Y.Doc) =>
    projectFrameLayout(Object.values(doc.getMap('nodes').toJSON()) as LayoutNode[]);

function merge(copies: Y.Doc[]) {
    const updates = copies.map((doc) => Y.encodeStateAsUpdate(doc));
    copies.forEach((doc) => updates.forEach((update) => Y.applyUpdate(doc, update)));
}

it('lays out a fixed-size row without changing authored positions', () => {
    const records = fixture();
    const before = structuredClone(records);
    const result = projectFrameLayout(records);
    expect(result.boxes.first).toEqual({ x: 120, y: 130, width: 80, height: 40 });
    expect(result.boxes.second).toEqual({ x: 210, y: 130, width: 80, height: 40 });
    expect(result.problems).toEqual([]);
    expect(records).toEqual(before);
    expect(projectFrameLayout([...records].reverse())).toEqual(result);
});

it.each(['start', 'center', 'end'] as const)('aligns a column at %s', (align) => {
    const result = projectFrameLayout([
        { ...frame, stack: { direction: 'column', gap: 10, padding: 20, align } },
        child('first', 'a'),
        child('second', 'b')
    ]);
    const x = { start: 120, center: 260, end: 400 }[align];
    expect(result.boxes.first).toEqual({ x, y: 70, width: 80, height: 40 });
    expect(result.boxes.second).toEqual({ x, y: 120, width: 80, height: 40 });
});

it('projects nested stacks and free frames into canvas coordinates', () => {
    const result = projectFrameLayout([
        { ...frame, stack: undefined },
        {
            ...child('nested', 'a'),
            kind: 'frame',
            x: 30,
            y: 15,
            width: 200,
            height: 100,
            stack: { direction: 'column', gap: 5, padding: 10, align: 'end' }
        },
        child('content', 'a', { parentId: 'nested' })
    ]);
    expect(result.boxes.nested).toEqual({ x: 130, y: 65, width: 200, height: 100 });
    expect(result.boxes.content).toEqual({ x: 240, y: 75, width: 80, height: 40 });
    expect(result.problems).toEqual([]);
});

it('keeps overflowing children at their authored sizes and reports the frame', () => {
    const result = projectFrameLayout([
        { ...frame, width: 100, height: 50 },
        child('first', 'a'),
        child('second', 'b')
    ]);
    expect(result.boxes.first.width).toBe(80);
    expect(result.boxes.second.x).toBe(210);
    expect(result.problems).toEqual([{ id: 'screen', code: 'overflow' }]);
});

it('breaks equal sibling orders by stable ID, independently of map insertion order', () => {
    const records = [frame, child('z', 'same'), child('a', 'same')];
    expect(projectFrameLayout(records).boxes.a.x).toBe(120);
    expect(projectFrameLayout(records.reverse()).boxes.z.x).toBe(210);
});

it('reflows a merged rule and child-size edit instead of sharing stale derived coordinates', () => {
    const copies = twoCopies();
    const [first, second] = copies;
    const original = project(first);
    rules(first).set('gap', 30);
    node(second, 'first').set('width', 120);
    expect(project(first).boxes.second.x).toBe(230);
    expect(project(second).boxes.second.x).toBe(250);
    merge(copies);
    expect(project(first)).toEqual(project(second));
    expect(project(first).boxes.second.x).toBe(270);
    expect(project(first).boxes.second).not.toEqual(original.boxes.second);
    expect(node(first, 'second').get('x')).toBe(0);
    expect(node(second, 'second').get('x')).toBe(0);
});

it('converges concurrent insertion, reordering and frame resizing after delayed and duplicate updates', () => {
    const copies = twoCopies();
    const [first, second] = copies;
    node(first, 'second').set('order', '0');
    node(first, 'screen').set('height', 300);
    second.getMap('nodes').set('third', sharedNode(child('third', 'a')));
    merge(copies);
    merge(copies);
    const result = project(first);
    expect(result).toEqual(project(second));
    expect(result.boxes.second.x).toBe(120);
    expect(result.boxes.first.x).toBe(210);
    expect(result.boxes.third.x).toBe(300);
    expect(result.boxes.first.y).toBe(180);
});

it.each([
    { moved: 0, winner: 'canvas', x: 0 },
    { moved: 1, winner: 'other', x: 720 }
])(
    'keeps the CRDT winner ($winner) of concurrent reparenting without duplicating a child',
    ({ moved, winner, x }) => {
        const copies = twoCopies([...fixture(), { ...frame, id: 'other', x: 700 }]);
        node(copies[moved], 'first').set('parentId', 'other');
        node(copies[1 - moved], 'first').set('parentId', undefined);
        merge(copies);
        const result = project(copies[0]);
        expect(result).toEqual(project(copies[1]));
        expect(node(copies[0], 'first').get('parentId')).toBe(
            winner === 'other' ? 'other' : undefined
        );
        expect(result.boxes.first).toEqual({
            x,
            y: winner === 'other' ? 130 : 0,
            width: 80,
            height: 40
        });
    }
);

it('keeps a child as a root when its parent is concurrently deleted, without repairing the CRDT', () => {
    const copies = twoCopies();
    const [first, second] = copies;
    first.getMap('nodes').delete('screen');
    second.getMap('nodes').set('added', sharedNode(child('added', 'c')));
    merge(copies);
    expect(project(first)).toEqual(project(second));
    expect(project(first).boxes.added).toEqual({ x: 0, y: 0, width: 80, height: 40 });
    expect(project(first).problems).toContainEqual({ id: 'added', code: 'invalid-parent' });
    expect(node(first, 'added').get('parentId')).toBe('screen');
});

it('handles a parent cycle created by two individually valid offline changes', () => {
    const copies = twoCopies([
        { ...frame, id: 'a' },
        { ...frame, id: 'b' },
        child('content', 'a', { parentId: 'a' })
    ]);
    const [first, second] = copies;
    node(first, 'a').set('parentId', 'b');
    node(second, 'b').set('parentId', 'a');
    expect(project(first).problems.filter(({ code }) => code === 'parent-cycle')).toEqual([]);
    expect(project(second).problems.filter(({ code }) => code === 'parent-cycle')).toEqual([]);
    merge(copies);
    expect(project(first)).toEqual(project(second));
    expect(project(first).problems.filter(({ code }) => code === 'parent-cycle')).toEqual([
        { id: 'a', code: 'parent-cycle' },
        { id: 'b', code: 'parent-cycle' }
    ]);
    expect(project(first).boxes.content.x).toBe(120);
    expect(node(first, 'a').get('parentId')).toBe('b');
});

it('undoes an authored rule without undoing another copy’s child-size edit', () => {
    const copies = twoCopies();
    const [first, second] = copies;
    const local = {};
    const undo = new Y.UndoManager(first.getMap('nodes'), { trackedOrigins: new Set([local]) });
    first.transact(() => rules(first).set('direction', 'column'), local);
    node(second, 'first').set('height', 60);
    merge(copies);
    expect(project(first).boxes.second.y).toBe(140);
    undo.undo();
    merge(copies);
    expect(project(first)).toEqual(project(second));
    expect(project(first).boxes.first.height).toBe(60);
    expect(project(first).boxes.second.x).toBe(210);
    undo.destroy();
});

it('diagnoses invalid geometry and does not allow a shape to be a parent', () => {
    const result = projectFrameLayout([
        frame,
        child('invalid', 'a', { width: -1 }),
        child('first', 'a'),
        child('second', 'b', { parentId: 'first' })
    ]);
    expect(result.boxes.invalid).toBeUndefined();
    expect(result.boxes.second.x).toBe(0);
    expect(result.problems).toEqual([
        { id: 'invalid', code: 'invalid-geometry' },
        { id: 'second', code: 'invalid-parent' }
    ]);
});

it.each([
    ['an unknown direction', { direction: 'diagonal' }],
    ['an unknown alignment', { align: 'middle' }],
    ['a missing gap', { gap: undefined }],
    ['a negative padding', { padding: -1 }]
])('keeps a frame with %s and places its children freely', (_, changes) => {
    const stack = { ...frame.stack, ...changes } as unknown as StackRules;
    const result = projectFrameLayout([{ ...frame, stack }, child('first', 'a', { x: 5, y: 6 })]);
    expect(result.boxes.screen).toEqual({ x: 100, y: 50, width: 400, height: 200 });
    expect(result.boxes.first).toEqual({ x: 105, y: 56, width: 80, height: 40 });
    expect(result.problems).toEqual([{ id: 'screen', code: 'invalid-stack' }]);
});

it('merges edits to different layout fields instead of replacing the entire stack rule', () => {
    const copies = twoCopies();
    const [first, second] = copies;
    rules(first).set('direction', 'column');
    rules(second).set('gap', 30);
    merge(copies);
    expect(rules(first).get('direction')).toBe('column');
    expect(rules(first).get('gap')).toBe(30);
    expect(project(first)).toEqual(project(second));
    expect(project(first).boxes.second.y).toBe(140);
});

it('handles deeply nested free frames without recursive traversal', () => {
    const count = 2000;
    const records: LayoutNode[] = Array.from({ length: count }, (_, index) => ({
        id: `frame-${index}`,
        parentId: index === 0 ? undefined : `frame-${index - 1}`,
        kind: 'frame',
        order: 'a',
        x: 1,
        y: 1,
        width: 10,
        height: 10
    }));
    const result = projectFrameLayout(records);
    expect(result.problems).toEqual([]);
    expect(result.boxes[`frame-${count - 1}`]).toEqual({
        x: count,
        y: count,
        width: 10,
        height: 10
    });
});
