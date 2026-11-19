import { createTestStore } from './support/store';
import { projectFrameLayout, renderedFrame, renderedShape } from 'src/app/frameLayout';
import { readEntity } from 'src/app/services/documentStorage';
import { allSides, stackPadding, withSides, withStackPadding } from 'src/app/boxModel';
import { borderDash } from 'src/app/border';
import { SHAPE_PROPERTIES, applyProperty } from 'src/app/properties';
import { spacingOf } from 'src/events/spacingDrag';
import type { HandleTarget } from 'src/events/types';
import { writeFrameNumber } from 'src/app/frameVariables';
import type { Shape, StackRules } from 'src/app/types';

type Store = ReturnType<typeof createTestStore>['store'];
type SpacingHandle = Extract<HandleTarget, { type: 'spacing' }>;
const column: StackRules = { direction: 'column', gap: 10, padding: 20, align: 'start' };

function setup(stack: StackRules = column) {
    const { store } = createTestStore();
    const root = store.actions.editFrame({
        kind: 'add',
        position: { x: 100, y: 100 },
        size: { width: 300, height: 400 }
    })!;
    const add = (width: number, height: number) => {
        store.actions.addShape({
            type: 'rectangle',
            position: { x: 900, y: 900 },
            size: { width, height },
            parentFrameId: root
        });

        return store.state.currentDocument.shapesIds.at(-1)!;
    };
    const a = add(40, 30);
    const b = add(50, 40);
    store.actions.editFrame({ kind: 'update', id: root, changes: { stack } });

    return { store, root, a, b };
}

const setMargin = (store: Store, id: string, margin: Shape['margin'] | null) =>
    store.actions.applyOperations({
        documentId: store.state.currentDocumentId,
        by: { kind: 'person' },
        operations: [{ op: 'updateShape', shape: id, changes: { margin } }]
    });

describe('margin in a stack', () => {
    it('keeps each side clear around an item, added to the gap and padding', () => {
        const { store, a, b } = setup();
        setMargin(store, a, { top: 8, right: 0, bottom: 6, left: 12 });
        const document = store.state.currentDocument;

        // Padding 20, then a's top margin.
        expect(renderedShape(document, a)).toMatchObject({ position: { x: 132, y: 128 } });
        // a's 30 high, its bottom margin, then the gap.
        expect(renderedShape(document, b)).toMatchObject({ position: { x: 120, y: 174 } });
    });

    it('centres an item with its margin across the stack', () => {
        const { store, a } = setup({ ...column, align: 'center' });
        setMargin(store, a, { top: 0, right: 0, bottom: 0, left: 20 });

        // 300 wide less padding 40, a's 40 and its margin 20 leaves 200; half is 100.
        expect(renderedShape(store.state.currentDocument, a)).toMatchObject({
            position: { x: 100 + 20 + 20 + 100 }
        });
    });

    it('counts margins when a stack hugs its contents and when items fill it', () => {
        const { store, root, a, b } = setup();
        setMargin(store, a, allSides(5));
        store.actions.editFrame({
            kind: 'update',
            id: root,
            changes: { sizing: { height: { mode: 'hug' }, width: { mode: 'hug' } } }
        });
        const hugged = renderedFrame(store.state.currentDocument, root)!;

        // 20 + (5 + 30 + 5) + 10 + 40 + 20 down; 20 + max(5 + 40 + 5, 50) + 20 across.
        expect(hugged.size).toEqual({ width: 90, height: 130 });

        store.actions.editFrame({
            kind: 'update',
            id: root,
            changes: { sizing: {} }
        });
        store.actions.applyOperations({
            documentId: store.state.currentDocumentId,
            by: { kind: 'person' },
            operations: [
                { op: 'updateShape', shape: b, changes: { sizing: { width: { mode: 'fill' } } } }
            ]
        });
        setMargin(store, b, { top: 0, right: 30, bottom: 0, left: 10 });

        expect(renderedShape(store.state.currentDocument, b)).toMatchObject({
            position: { x: 130 },
            size: { width: 300 - 40 - 40 }
        });
    });

    it('reports an overflow that only the margins cause', () => {
        const { store, root, a } = setup();
        setMargin(store, a, { top: 0, right: 0, bottom: 300, left: 0 });

        expect(projectFrameLayout(store.state.currentDocument).problems[root]).toMatch(/margins/);
    });

    it('takes a margin away with null', () => {
        const { store, a } = setup();
        setMargin(store, a, allSides(4));
        setMargin(store, a, null);

        expect(store.state.currentDocument.shapes[a].margin).toBeUndefined();
    });
});

describe('stack padding by side', () => {
    it('places items inside each side of the padding', () => {
        const { store, root, a } = setup();
        const stack = withStackPadding(column, { top: 4, left: 30 });
        store.actions.editFrame({ kind: 'update', id: root, changes: { stack } });

        expect(stack).toEqual({
            ...column,
            padding: 4,
            paddingSides: { top: 4, right: 20, bottom: 20, left: 30 }
        });
        expect(renderedShape(store.state.currentDocument, a)).toMatchObject({
            position: { x: 130, y: 104 }
        });
    });

    it('keeps one padding when every side is the same, as a variable sets it', () => {
        const uneven = withStackPadding(column, { top: 4 });
        expect(withStackPadding(uneven, { top: 20 })).toEqual(column);

        const frame = { stack: uneven } as Parameters<typeof writeFrameNumber>[0];
        writeFrameNumber(frame, 'padding', 12);
        expect(frame.stack).toEqual({ ...column, padding: 12 });
        expect(stackPadding(frame.stack!)).toEqual(allSides(12));
    });
});

describe('saving the box model', () => {
    it('reads margins, per-side padding and border style, and rejects others', () => {
        const { store, root, a } = setup();
        setMargin(store, a, allSides(3));
        const shape = { ...JSON.parse(JSON.stringify(store.state.currentDocument.shapes[a])) };
        const frame = JSON.parse(JSON.stringify(store.state.currentDocument.frames[root]));

        expect(
            readEntity('shapes', { ...shape, borderWidth: 4, borderStyle: 'dashed' })
        ).toMatchObject({
            margin: allSides(3),
            borderWidth: 4,
            borderStyle: 'dashed'
        });
        expect(() => readEntity('shapes', { ...shape, borderStyle: 'double' })).toThrow();
        expect(() =>
            readEntity('shapes', { ...shape, margin: { ...allSides(1), top: -1 } })
        ).toThrow();
        expect(
            readEntity('frames', {
                ...frame,
                margin: allSides(2),
                stack: { ...column, paddingSides: { top: 1, right: 2, bottom: 3, left: 4 } }
            })
        ).toMatchObject({
            margin: allSides(2),
            stack: { paddingSides: { top: 1, right: 2, bottom: 3, left: 4 } }
        });
    });
});

describe('border', () => {
    it('edits the width and style of an outline, keeping defaults unsaved', () => {
        const width = SHAPE_PROPERTIES.find((property) => property.key === 'borderWidth')!;
        const style = SHAPE_PROPERTIES.find((property) => property.key === 'borderStyle')!;
        const shape = { type: 'rectangle' } as Shape;

        applyProperty(width, shape, 4);
        applyProperty(style, shape, 'dotted');
        expect(shape).toMatchObject({ borderWidth: 4, borderStyle: 'dotted' });
        applyProperty(style, shape, 'wavy');
        expect(shape.borderStyle).toBe('dotted');
        applyProperty(width, shape, 2);
        applyProperty(style, shape, 'solid');
        expect(shape).not.toHaveProperty('borderWidth');
        expect(shape).not.toHaveProperty('borderStyle');
        expect(width.read({ type: 'text' } as Shape, {} as never)).toBeUndefined();
    });

    it('dashes in proportion to the width', () => {
        expect(borderDash('dashed', 2)).toBe('6 4');
        expect(borderDash('dotted', 3)).toBe('3 3');
        expect(borderDash('solid', 3)).toBeUndefined();
    });
});

describe('dragging a band', () => {
    const drag = (
        store: Store,
        handle: SpacingHandle,
        to: { x: number; y: number },
        cancel = false
    ) => {
        const events = store.actions.events;
        expect(events.beginGesture({ pointerId: 1, position: { x: 0, y: 0 }, handle })).toBe(true);
        events.movePointer({ pointerId: 1, position: to });
        if (cancel) {
            events.cancelGesture(1);
        } else {
            events.endGesture({ pointerId: 1, position: to });
        }
    };

    it('widens a margin as the grip goes out and padding as it goes in', () => {
        const { store, root, a } = setup();
        setMargin(store, a, allSides(10));
        const left: SpacingHandle = { type: 'spacing', box: 'margin', side: 'left', shapeId: a };

        drag(store, left, { x: -7.4, y: 50 });
        expect(store.state.currentDocument.shapes[a].margin).toEqual({ ...allSides(10), left: 17 });
        drag(store, left, { x: 40, y: 0 });
        expect(store.state.currentDocument.shapes[a].margin).toEqual({ ...allSides(10), left: 0 });

        drag(
            store,
            { type: 'spacing', box: 'padding', side: 'top', frameId: root },
            { x: 0, y: 6 }
        );
        expect(stackPadding(store.state.currentDocument.frames[root].stack!)).toEqual({
            ...allSides(20),
            top: 26
        });
    });

    it('puts the band back when the drag is canceled', () => {
        const { store, root } = setup();
        drag(
            store,
            { type: 'spacing', box: 'margin', side: 'top', frameId: root },
            { x: 0, y: -30 },
            true
        );

        expect(store.state.currentDocument.frames[root].margin).toBeUndefined();
    });

    it('cannot change a locked shape or padding of a free frame', () => {
        const { store, root, a } = setup();
        store.actions.editFrame({ kind: 'update', id: root, changes: { stack: null } });
        const document = store.state.currentDocument;

        expect(
            spacingOf(document, { type: 'spacing', box: 'padding', side: 'top', frameId: root })
        ).toBeUndefined();
        store.actions.setShapesProperty({ shapeIds: [a], key: 'locked', value: true });
        expect(
            spacingOf(document, { type: 'spacing', box: 'margin', side: 'top', shapeId: a })
        ).toBeUndefined();
    });
});

it('saves nothing for a margin of zero on every side', () => {
    expect(withSides(allSides(3), allSides(0))).toBeUndefined();
    expect(withSides(undefined, { left: -4, top: 2 })).toEqual({
        top: 2,
        right: 0,
        bottom: 0,
        left: 0
    });
});
