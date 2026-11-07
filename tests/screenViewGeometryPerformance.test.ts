import { editableScreenView } from 'src/app/screenViewEditing';
import * as geometry from 'src/app/geometry';
import * as inputs from 'src/app/screenGeometryInputs';
import { screenGeometryInputs } from 'src/app/screenGeometryInputs';
import { resolveScreenViewGeometry } from 'src/app/screenViewGeometry';
import { screenLayoutsDocument } from './support/screenLayouts';
import { responsiveVariantsDocument } from './support/responsiveVariants';
import * as projection from 'src/app/screenProjection';
import { performance } from 'node:perf_hooks';
import { createDocument, createShape, createGroup } from 'src/app/factories';
import type { Frame, Text } from 'src/app/types';
import { createTestStore } from './support/store';

/** Several screens on one canvas; edits affect only the first screen's two views. */
function editingFixture() {
    const frames: Record<string, Frame> = {};
    const shapes = Array.from({ length: 8 }, (_, screen) => {
        const id = `screen-${screen}`;
        frames[id] = {
            id,
            name: id,
            kind: 'screen',
            definitionOnly: true,
            position: { x: 0, y: 0 },
            size: { width: 600, height: 800 },
            visible: true,
            locked: false,
            stack: { direction: 'column', padding: 16, gap: 8, align: 'start' }
        };
        for (const width of [320, 600]) {
            const viewId = `${id}-${width}`;
            frames[viewId] = {
                id: viewId,
                name: String(width),
                kind: 'view',
                screenId: id,
                position: { x: screen * 900 + width, y: 0 },
                size: { width, height: 800 },
                visible: true,
                locked: false
            };
        }

        return Array.from({ length: 20 }, (_, index) =>
            createShape({
                type: 'text',
                name: `Label ${screen}-${index}`,
                order: `a${String(index).padStart(2, '0')}`,
                position: { x: 16, y: index * 35 },
                fontSize: 16,
                value: `Editable screen ${screen}, label ${index}`,
                wrapWidth: 250,
                parentFrameId: id,
                selected: false
            })
        );
    }).flat();
    const { store } = createTestStore();
    store.actions.addDocument(
        createDocument({
            id: store.state.currentDocumentId,
            frames,
            shapes: Object.fromEntries(shapes.map((shape) => [shape.id, shape]))
        })
    );

    return { store, shapeId: shapes[0].id };
}

it('resolves successive text edits with several screens on the canvas', () => {
    const { store, shapeId } = editingFixture();
    const document = store.state.currentDocument;
    expect(document.screenViewGeometry).toHaveLength(16);
    const durations: number[] = [];
    for (let index = 0; index < 24; index++) {
        const start = performance.now();
        store.actions.updateShape({ id: shapeId, value: `Changed label ${index}` });
        const views = document.screenViewGeometry;
        durations.push(performance.now() - start);
        expect(
            views.find((item) => item.view.id === 'screen-0-320')?.projection?.shapes[0]
        ).toMatchObject({ value: `Changed label ${index}` });
    }
    if (process.env.PROFILE_SCREEN_EDITS) {
        process.stdout.write(`${JSON.stringify({ screenEditMs: durations })}\n`);
    }
});

it('recalculates only the edited screen views and retains unrelated geometry', () => {
    const { store, shapeId } = editingFixture();
    const document = store.state.currentDocument;
    const before = document.screenViewGeometry;
    const resolve = vi.spyOn(projection, 'projectScreen');
    store.actions.updateShape({ id: shapeId, value: 'A changed label' });
    const after = document.screenViewGeometry;
    expect(resolve).toHaveBeenCalledTimes(2);
    resolve.mockRestore();
    after.forEach((item, index) => {
        if (item.view.screenId === 'screen-0') {
            expect(item.projection).not.toBe(before[index].projection);

            return;
        }
        expect(item.projection).toBe(before[index].projection);
    });
    const wideBefore = after.find((item) => item.view.id === 'screen-0-600')!.projection;
    store.actions.editFrame({
        kind: 'update',
        id: 'screen-0-320',
        changes: { size: { width: 400, height: 800 } }
    });
    expect(
        document.screenViewGeometry.find((item) => item.view.id === 'screen-0-600')!.projection
    ).toBe(wideBefore);
    expect(
        document.screenViewGeometry.find((item) => item.view.id === 'screen-0-320')!.projection!
            .screen.size.width
    ).toBe(400);
});

it('invalidates every consumer of nested component artwork but leaves other screens cached', () => {
    const { store } = editingFixture();
    const document = store.state.currentDocument;
    store.actions.addShape({
        type: 'rectangle',
        position: { x: 0, y: 0 },
        size: { width: 40, height: 30 }
    });
    const sourceId = document.shapesIds.at(-1)!;
    store.actions.addComponent({
        id: 'leaf',
        name: 'Leaf',
        sourceOnly: true,
        shapesIds: [sourceId]
    });
    store.actions.addShape({
        type: 'instance',
        componentId: 'leaf',
        position: { x: 0, y: 0 },
        overrides: {}
    });
    store.actions.addComponent({
        id: 'nested',
        name: 'Nested',
        sourceOnly: true,
        shapesIds: [document.shapesIds.at(-1)!]
    });
    for (const screenId of ['screen-0', 'screen-1']) {
        store.actions.addShape({
            type: 'instance',
            componentId: 'nested',
            position: { x: 0, y: 0 },
            overrides: {},
            parentFrameId: screenId
        });
    }
    const before = document.screenViewGeometry;
    const resolve = vi.spyOn(projection, 'projectScreen');
    store.actions.updateShape({ id: sourceId, size: { width: 90, height: 60 } });
    const after = document.screenViewGeometry;
    expect(resolve).toHaveBeenCalledTimes(4);
    resolve.mockRestore();
    expect(after.find((item) => item.view.id === 'screen-2-320')!.projection).toBe(
        before.find((item) => item.view.id === 'screen-2-320')!.projection
    );
    for (const screenId of ['screen-0', 'screen-1']) {
        const instance = after
            .find((item) => item.view.id === `${screenId}-320`)!
            .projection!.shapes.find((shape) => shape.type === 'instance');
        expect(instance?.bounds).toMatchObject({ width: 90, height: 60 });
    }
});

it('keeps alternate layouts independent and matches responsive variant projection', () => {
    const { store } = createTestStore();
    store.actions.addDocument(screenLayoutsDocument(store.state.currentDocumentId));
    const document = store.state.currentDocument;
    const before = document.screenViewGeometry;
    store.actions.updateShape({ id: 'body', size: { width: 80, height: 75 } });
    const after = document.screenViewGeometry;
    expect(after.find((item) => item.view.id === 'mobile')!.projection).toBe(
        before.find((item) => item.view.id === 'mobile')!.projection
    );
    expect(after.find((item) => item.view.id === 'desktop')!.projection!.shapes[0]).toMatchObject({
        size: { height: 75 }
    });

    const responsive = responsiveVariantsDocument();
    const previous = resolveScreenViewGeometry(responsive);
    const wide = responsive.shapes['wide-text'];
    if (wide.type !== 'text') {
        throw new Error('Expected variant text');
    }
    wide.value = 'Updated wide variant';
    const current = resolveScreenViewGeometry(responsive);
    expect(current).not.toBe(previous);
    const uncached = projection.projectScreenViews(responsive, {}, { x: 0, y: 0 });
    expect(current.map((item) => item.projection?.shapes.map((shape) => shape.bounds))).toEqual(
        uncached.map((item) => item.projection?.shapes.map((shape) => shape.bounds))
    );
    expect(JSON.stringify(current)).toContain('Updated wide variant');
});

it('rechecks the shared node budget when a cached later view becomes blocked and unblocked', () => {
    const document = screenLayoutsDocument();
    delete document.frames.compact;
    delete document.frames.home.stack;
    document.frames.other = { ...document.frames.home, id: 'other' };
    document.frames.mobile.screenId = 'other';
    delete document.frames.mobile.layoutId;
    const base = document.shapes.body;
    delete base.sizing;
    document.shapes = {};
    for (const screen of ['home', 'other']) {
        for (let index = 0; index < 2498; index++) {
            const id = `${screen}-${index}`;
            document.shapes[id] = { ...base, id, parentFrameId: screen };
        }
    }
    document.shapesIds = Object.keys(document.shapes);
    const before = resolveScreenViewGeometry(document);
    expect(before.every((item) => item.projection !== null)).toBe(true);
    for (let index = 0; index < 3; index++) {
        const id = `extra-${index}`;
        document.shapes[id] = { ...base, id, parentFrameId: 'home' };
        document.shapesIds.push(id);
    }
    const blocked = resolveScreenViewGeometry(document);
    expect(blocked[1].projection).toBeNull();
    expect(blocked[1].problem).toContain('5000 projected nodes');
    const { store } = createTestStore();
    store.actions.addDocument({ ...document, id: store.state.currentDocumentId });
    expect(
        editableScreenView(store.state, {
            documentId: store.state.currentDocumentId,
            viewId: blocked[1].view.id
        })
    ).toBeNull();
    for (let index = 0; index < 3; index++) {
        delete document.shapes[`extra-${index}`];
    }
    document.shapesIds = Object.keys(document.shapes);
    expect(resolveScreenViewGeometry(document)[1].projection).toBe(before[1].projection);
});

it('invalidates views when unrelated wrapping toggles contextual layout', () => {
    const document = screenLayoutsDocument();
    document.variables.width = {
        id: 'width',
        name: 'Width',
        type: 'number',
        values: { default: 120 }
    };
    document.shapes.body.bindings = { width: 'width' };
    delete document.shapes.body.sizing;
    const text = createShape({
        type: 'text',
        name: 'Detached',
        order: 'a2',
        value: 'Outside',
        position: { x: 0, y: 0 },
        fontSize: 16
    });
    document.shapes[text.id] = text;
    document.shapesIds.push(text.id);
    const initial = resolveScreenViewGeometry(document);
    for (const wrapWidth of [40, 0]) {
        if (text.type !== 'text') {
            throw new Error('Expected text');
        }
        text.wrapWidth = wrapWidth;
        const cached = resolveScreenViewGeometry(document);
        const uncached = projection.projectScreenViews(document, {}, { x: 0, y: 0 });
        expect(cached[0].projection?.shapes[0]).toMatchObject({
            size: (uncached[0].projection?.shapes[0] as { size: unknown }).size
        });
        expect(cached[0].projection).not.toBe(initial[0].projection);
    }
});

it('visits a large group only once when collecting dependencies', () => {
    const document = screenLayoutsDocument();
    const base = document.shapes.body;
    const ids = Array.from({ length: 1000 }, (_, index) => `member-${index}`);
    ids.forEach((id) => {
        document.shapes[id] = { ...base, id };
    });
    document.shapesIds.push(...ids);
    document.groups.large = createGroup({ id: 'large', shapesIds: ids });
    const members = document.groups.large.shapesIds;
    const visit = vi.spyOn(members, 'forEach');
    screenGeometryInputs(document, 'home', document.frames.desktop);
    // One pass builds reverse memberships, one follows the group's members.
    expect(visit).toHaveBeenCalledTimes(2);
    visit.mockRestore();
});

it('leaves views cached when an unrelated component changes, but not one listing their shapes', () => {
    const { store, shapeId } = editingFixture();
    const document = store.state.currentDocument;
    store.actions.addShape({
        type: 'rectangle',
        position: { x: 0, y: -400 },
        size: { width: 40, height: 30 }
    });
    store.actions.addComponent({
        id: 'unrelated',
        name: 'Unrelated',
        shapesIds: [document.shapesIds.at(-1)!]
    });
    const before = document.screenViewGeometry;
    const resolve = vi.spyOn(projection, 'projectScreen');
    store.actions.updateComponent({ id: 'unrelated', name: 'Renamed' });
    const after = document.screenViewGeometry;
    expect(resolve).not.toHaveBeenCalled();
    after.forEach((item, index) => expect(item.projection).toBe(before[index].projection));

    // A source-only component hides the screen shapes it lists.
    store.actions.addComponent({
        id: 'listing',
        name: 'Listing',
        sourceOnly: true,
        shapesIds: [shapeId]
    });
    const hidden = document.screenViewGeometry;
    expect(resolve).toHaveBeenCalledTimes(2);
    resolve.mockRestore();
    expect(hidden.find((item) => item.view.id === 'screen-0-320')!.projection!.shapes).toHaveLength(
        19
    );
});

it('collects one layout dependency set for all views of that layout', () => {
    const { store, shapeId } = editingFixture();
    const document = store.state.currentDocument;
    void document.screenViewGeometry;
    const collect = vi.spyOn(inputs, 'screenLayoutInputs');
    store.actions.updateShape({ id: shapeId, value: 'Changed once' });
    void document.screenViewGeometry;
    // Eight screens with two views each, both views drawing the screen itself.
    expect(collect).toHaveBeenCalledTimes(8);
    collect.mockRestore();
});

it('places only the requested editing view, with live selection and isolated shape copies', () => {
    const { store, shapeId } = editingFixture();
    const document = store.state.currentDocument;
    const cached = document.screenViewGeometry;
    const local = cached.find((item) => item.view.id === 'screen-0-320')!.projection!;
    const localText = local.shapes[0] as Text;
    const translate = vi.spyOn(geometry, 'translateShape');
    try {
        const address = { documentId: document.id, viewId: 'screen-0-320' };
        const first = editableScreenView(store.state, address)!;
        const firstText = first.projection.shapes[0] as Text;
        expect(translate).toHaveBeenCalledTimes(20);
        expect(first.projection.shapes).toHaveLength(20);
        expect(firstText.position.x).toBe(
            localText.position.x + document.frames[address.viewId].position.x
        );
        expect(first.projection.shapes[0].selected).toBe(false);

        store.actions.selectShape(shapeId);
        const second = editableScreenView(store.state, address)!;
        const secondText = second.projection.shapes[0] as Text;
        expect(translate).toHaveBeenCalledTimes(40);
        expect(second.projection.shapes[0].selected).toBe(true);
        expect(first.projection.shapes[0].selected).toBe(false);
        expect(document.screenViewGeometry).toBe(cached);
        secondText.position.x += 100;
        expect(firstText.position.x).not.toBe(secondText.position.x);
        expect(localText.position.x).toBe(16);
    } finally {
        translate.mockRestore();
    }
});

it('keeps screen geometry cached while an unrelated canvas shape is resized or rounded', () => {
    const { store } = editingFixture();
    const document = store.state.currentDocument;
    store.actions.addShape({
        type: 'rectangle',
        position: { x: 9000, y: 0 },
        size: { width: 100, height: 100 }
    });
    const id = document.shapesIds.at(-1)!;
    const before = document.screenViewGeometry;
    for (let step = 1; step <= 10; step++) {
        store.actions.updateShape({
            id,
            size: { width: 100 + step, height: 100 + step },
            cornerRadius: step
        });
        expect(document.screenViewGeometry).toBe(before);
    }

    // Once that artwork belongs to a screen, geometry edits must reach its views.
    store.actions.updateShape({ id, parentFrameId: 'screen-0' });
    const included = document.screenViewGeometry;
    expect(included).not.toBe(before);
    store.actions.updateShape({ id, cornerRadius: 30 });
    expect(
        document.screenViewGeometry[0].projection?.shapes.find((shape) => shape.id === id)
    ).toMatchObject({ cornerRadius: 30 });
});
