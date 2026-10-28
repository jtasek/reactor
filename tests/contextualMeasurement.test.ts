import { editorHelpers, provideEditorHelpers } from 'src/app/editorHelpers';
import { json } from 'overmind';
import { createTestStore } from './support/store';
import { projectScreenViews } from 'src/app/screenProjection';
import { hasNumericLayout, projectContextualLayout } from 'src/app/contextualLayout';
import { layoutDocument } from 'src/app/frameLayout';
import { projectGeometry } from 'src/app/contextualGeometry';
import { pointerDocument } from 'src/app/screenViewEditing';
import { resolveVariable } from 'src/app/variableResolver';
import { projectPreview } from 'src/preview/project';
import {
    readEntity,
    serializePersistedState,
    hydrateDocument
} from 'src/app/services/documentStorage';
import { hitTestShape } from 'src/app/geometry';
import { writeClipboard, readClipboard } from 'src/app/clipboard';
import { createCopies, edit, settle, DOCUMENT_ID } from './support/collaboration';
import {
    exportDesignSystemPackage,
    planDesignSystemImport,
    parseDesignSystemPackage
} from 'src/app/designSystemPackages';

function setup(store = createTestStore().store) {
    store.actions.addDocument({
        id: store.state.currentDocumentId,
        dimensions: {
            density: {
                id: 'density',
                name: 'Density',
                order: 0,
                defaultModeId: 'small',
                modes: {
                    small: { id: 'small', name: 'Small', order: 0 },
                    large: { id: 'large', name: 'Large', order: 1 }
                }
            }
        }
    });
    const document = store.state.currentDocument;
    const result = store.actions.applyOperations({
        documentId: document.id,
        by: { kind: 'person' },
        operations: [
            {
                op: 'addVariable',
                key: 'size',
                name: 'Size',
                type: 'number',
                value: 20,
                dimensionId: 'density',
                modeValues: { large: 40 }
            },
            {
                op: 'addVariable',
                key: 'copy',
                name: 'Copy',
                type: 'text',
                value: 'Short',
                dimensionId: 'density',
                modeValues: { large: 'A much longer label' }
            },
            {
                op: 'addVariable',
                key: 'message',
                name: 'Message',
                type: 'text',
                value: '${copy}',
                dimensionId: 'density',
                modeValues: { large: 'Welcome ${copy}' }
            },
            {
                op: 'addShape',
                key: 'rect',
                shape: {
                    type: 'rectangle',
                    position: { x: 0, y: 0 },
                    size: { width: 20, height: 20 },
                    bindings: { width: 'size' }
                }
            },
            {
                op: 'addShape',
                key: 'text',
                shape: {
                    type: 'text',
                    position: { x: 0, y: 60 },
                    value: 'Short',
                    fontSize: 20,
                    wrapWidth: 120,
                    bindings: { text: 'copy', fontSize: 'size' }
                }
            },
            {
                op: 'addFrame',
                key: 'screen',
                frame: {
                    kind: 'screen',
                    name: 'Home',
                    visible: true,
                    locked: false,
                    position: { x: 0, y: 0 },
                    size: { width: 300, height: 300 }
                }
            }
        ]
    });
    if (!result.applied) {
        throw new Error(result.problem);
    }
    const ids: Record<string, string> = { ...result.ids, nested: '', instance: '' };
    store.actions.addComponent({
        id: 'leaf',
        name: 'Label',
        sourceOnly: true,
        shapesIds: [ids.rect, ids.text]
    });
    store.actions.addShape({
        type: 'instance',
        componentId: 'leaf',
        position: { x: 0, y: 0 },
        overrides: {}
    });
    ids.nested = document.shapesIds.at(-1)!;
    store.actions.addComponent({
        id: 'outer',
        name: 'Card',
        sourceOnly: true,
        shapesIds: [ids.nested]
    });
    store.actions.addShape({
        type: 'instance',
        componentId: 'outer',
        position: { x: 20, y: 20 },
        parentFrameId: ids.screen,
        overrides: {}
    });
    ids.instance = document.shapesIds.at(-1)!;
    const small = Object.values(document.frames).find((frame) => frame.kind === 'view')!.id;
    const large = store.actions.editFrame({
        kind: 'addView',
        screenId: ids.screen,
        name: 'Large',
        position: { x: 400, y: 0 },
        size: { width: 300, height: 300 }
    })!;
    store.actions.setModeOverride({
        target: { frameId: large },
        dimensionId: 'density',
        modeId: 'large'
    });

    return { store, document, ids, small, large };
}

it('measures nested instances independently per view and keeps shared data unchanged', () => {
    const { store, document, ids, small, large } = setup();
    const before = serializePersistedState(store.state);
    const views = projectScreenViews(document);
    const instance = (id: string) =>
        views
            .find((view) => view.view.id === id)!
            .projection!.shapes.find((shape) => shape.id === ids.instance)!;
    const compact = instance(small);
    const comfortable = instance(large);
    expect(comfortable.bounds!.height).toBeGreaterThan(compact.bounds!.height);
    expect(comfortable.bounds!.width).toBeGreaterThan(compact.bounds!.width);
    expect(
        hitTestShape(
            comfortable,
            { x: comfortable.bounds!.topLeft.x + 5, y: comfortable.bounds!.bottomRight.y - 5 },
            0
        )
    ).toBe(true);
    expect(serializePersistedState(store.state)).toEqual(before);
    expect(JSON.stringify(before)).not.toContain('projectedSource');
    expect(JSON.stringify(before)).not.toContain('textLayout');

    store.actions.setModeOverride({
        target: { instanceId: ids.nested },
        dimensionId: 'density',
        modeId: 'small'
    });
    const reset = projectScreenViews(document)
        .find((view) => view.view.id === large)!
        .projection!.shapes.find((shape) => shape.id === ids.instance)!;
    expect(reset.bounds!.height).toBe(compact.bounds!.height);
});

it('shares contextual text lines and bounds with Preview and standalone Canvas', () => {
    const { store, document, ids } = setup();
    store.actions.addShape({
        type: 'text',
        position: { x: 500, y: 80 },
        value: 'Short',
        fontSize: 20,
        wrapWidth: 120,
        bindings: { text: ids.copy, fontSize: ids.size }
    });
    const canvasId = document.shapesIds.at(-1)!;
    store.actions.setPreviewMode({ dimensionId: 'density', modeId: 'large' });
    const projected = layoutDocument(
        document,
        projectContextualLayout(document, { simulation: { density: 'large' } })
    );
    const text = projected.shapes[canvasId];
    expect(text.type).toBe('text');
    if (text.type !== 'text') {
        throw new Error('Expected text');
    }
    expect(text.fontSize).toBe(40);
    expect(text.textLayout!.lines.length).toBeGreaterThan(1);
    expect(document.shapes[canvasId].bounds).toBeUndefined();
    expect(document.frameLayout.resolvedShapes![canvasId].bounds).toEqual(text.bounds);
    const copied = readClipboard(writeClipboard([text], [], document.variables, document))!;
    expect(copied.shapes[0]).toMatchObject({
        fontSize: 20,
        value: 'Short',
        bindings: { fontSize: ids.size, text: ids.copy }
    });
    const preview = projectPreview(document, { density: 'large' });
    expect(JSON.stringify(preview)).toContain('"font-size":40');
    expect(JSON.stringify(preview)).toContain('much');
    expect(JSON.stringify(preview)).not.toContain('projectedSource');
});

it('keeps explicit instance overrides ahead of source bindings, including mode-bound overrides', () => {
    const { store, document, ids } = setup();
    store.actions.exposeComponentProp({
        componentId: 'leaf',
        shapeId: ids.text,
        key: 'fontSize',
        label: 'Font size'
    });
    const propId = document.components.leaf.props![0].id;
    store.actions.setInstanceOverride({ instanceIds: [ids.nested], propId, value: 12 });
    const projected = () =>
        projectGeometry(document.shapes[ids.nested], document, { density: 'large' });
    const literal = projected();
    expect(
        literal.type === 'instance' &&
            literal.projectedSource?.shapes.find((shape) => shape.id === ids.text)
    ).toMatchObject({ fontSize: 12 });
    store.actions.bindInstanceOverride({ instanceIds: [ids.nested], propId, variableId: ids.size });
    const bound = projected();
    expect(
        bound.type === 'instance' &&
            bound.projectedSource?.shapes.find((shape) => shape.id === ids.text)
    ).toMatchObject({ fontSize: 40 });
    expect(document.shapes[ids.text]).toMatchObject({ fontSize: 20 });
});

it('edits source values through inherited modes without baking the host’s property overrides', () => {
    const { store, document, ids, large } = setup();
    store.actions.exposeComponentProp({
        componentId: 'leaf',
        shapeId: ids.text,
        key: 'fontSize',
        label: 'Font size'
    });
    const propId = document.components.leaf.props![0].id;
    store.actions.drawShape({
        type: 'instance',
        componentId: 'leaf',
        position: { x: 80, y: 40 },
        parentFrameId: ids.screen,
        overrides: { [propId]: 12 },
        rotation: 30
    });
    store.actions.events.setScreenView(large);
    store.actions.editComponentSource('leaf');
    const focused = pointerDocument(store.state).shapes[ids.text];
    expect(focused).toMatchObject({ fontSize: 40, value: 'A much longer label', rotation: 30 });
    expect(document.shapes[ids.text]).toMatchObject({ fontSize: 20, value: 'Short' });
});

it('reflows wrapped text inside a fill frame and derives its hug height from measured lines', () => {
    const { store, document, ids, small, large } = setup();
    store.actions.editFrame({
        kind: 'update',
        id: ids.screen,
        changes: { stack: { direction: 'column', padding: 0, gap: 0, align: 'start' } }
    });
    const frameId = store.actions.editFrame({
        kind: 'add',
        position: { x: 0, y: 0 },
        size: { width: 300, height: 80 }
    })!;
    store.actions.editFrame({
        kind: 'update',
        id: frameId,
        changes: {
            parentFrameId: ids.screen,
            stack: { direction: 'column', padding: 10, gap: 0, align: 'start' },
            sizing: { width: { mode: 'fill' }, height: { mode: 'hug' } }
        }
    });
    store.actions.addShape({
        type: 'text',
        position: { x: 10, y: 30 },
        value: 'Wrapping across the available frame width',
        fontSize: 20,
        wrapWidth: 500,
        parentFrameId: frameId
    });
    const textId = document.shapesIds.at(-1)!;
    store.actions.editFrame({
        kind: 'update',
        id: small,
        changes: { size: { width: 100, height: 500 } }
    });
    store.actions.editFrame({
        kind: 'update',
        id: large,
        changes: { size: { width: 300, height: 500 } }
    });
    const views = projectScreenViews(document);
    const narrow = views.find((view) => view.view.id === small)!.projection!;
    const wide = views.find((view) => view.view.id === large)!.projection!;
    const text = narrow.shapes.find((shape) => shape.id === textId)!;
    expect(text.bounds!.height).toBeGreaterThan(
        wide.shapes.find((shape) => shape.id === textId)!.bounds!.height
    );
    expect(narrow.frames.find((frame) => frame.id === frameId)!.size.height).toBeCloseTo(
        text.bounds!.height + 20
    );
});

it('shares authored text modes and undo while keeping every copy’s measurements local', async () => {
    const copies = await createCopies(2, (store) => setup(store));
    const [a, b] = copies;
    const document = a.store.state.documents[DOCUMENT_ID];
    const copy = Object.values(document.variables).find((variable) => variable.name === 'Copy')!;
    edit(a, () =>
        a.store.actions.setVariableModeValue({
            variableId: copy.id,
            modeId: 'large',
            value: 'Changed remotely'
        })
    );
    settle(copies);
    projectScreenViews(a.store.state.documents[DOCUMENT_ID]);
    projectScreenViews(b.store.state.documents[DOCUMENT_ID]);
    expect(serializePersistedState(a.store.state).documents[DOCUMENT_ID]).toEqual(
        serializePersistedState(b.store.state).documents[DOCUMENT_ID]
    );
    expect(JSON.stringify(serializePersistedState(a.store.state))).not.toContain('textLayout');
    expect(JSON.stringify(serializePersistedState(a.store.state))).not.toContain('projectedSource');
    a.collaboration.undo(DOCUMENT_ID);
    settle(copies);
    expect(serializePersistedState(a.store.state).documents[DOCUMENT_ID]).toEqual(
        serializePersistedState(b.store.state).documents[DOCUMENT_ID]
    );
    expect(a.store.state.documents[DOCUMENT_ID].variables[copy.id].values).toMatchObject({
        large: 'A much longer label'
    });
    copies.forEach((copy) => copy.collaboration.dispose());
});

it('resolves mode templates transitively and keeps them through save and package import', () => {
    const { store, document, ids } = setup();
    expect(
        resolveVariable(document.variables[ids.message], document.variables, { density: 'large' })
    ).toBe('Welcome A much longer label');
    const saved = serializePersistedState(store.state);
    const restored = hydrateDocument(saved.documents[document.id]);
    expect(
        resolveVariable(restored.variables[ids.message], restored.variables, { density: 'large' })
    ).toBe('Welcome A much longer label');
    const target = createTestStore().store;
    const data = parseDesignSystemPackage(exportDesignSystemPackage(document));
    let next = 0;
    const plan = planDesignSystemImport(
        target.state.currentDocument,
        data,
        'separate',
        () => `import-${next++}`
    );
    const applied = target.actions.applyOperations({
        documentId: target.state.currentDocumentId,
        by: { kind: 'person' },
        operations: plan
    });
    expect(applied.applied).toBe(true);
    const imported = target.state.currentDocument;
    const message = Object.values(imported.variables).find(
        (variable) => variable.name === 'Message'
    )!;
    const dimension = Object.values(imported.dimensions)[0];
    const large = Object.values(dimension.modes).find((mode) => mode.name === 'Large')!;
    expect(resolveVariable(message, imported.variables, { [dimension.id]: large.id })).toBe(
        'Welcome A much longer label'
    );
});

it('remeasures after a value edit and does not retain bounds from another width or instance path', () => {
    const { store, document, ids } = setup();
    const source = document.shapes[ids.text];
    const narrow = projectGeometry(source, document, { density: 'large' }, 'narrow', 50);
    const wide = projectGeometry(source, document, { density: 'large' }, 'wide', 120);
    expect(narrow.bounds!.height).toBeGreaterThan(wide.bounds!.height);
    store.actions.setVariableModeValue({ variableId: ids.copy, modeId: 'large', value: 'Hi' });
    const edited = projectGeometry(source, document, { density: 'large' }, 'narrow', 50);
    expect(edited.bounds!.height).toBeLessThan(narrow.bounds!.height);
    const stripped = readEntity('shapes', json(edited));
    expect('textLayout' in stripped).toBe(false);
});

it('invalidates Canvas geometry measured before the editor finished loading', () => {
    const { store, document } = setup();
    const helpers = editorHelpers();
    provideEditorHelpers(undefined);
    store.actions.setEditorReady();
    expect(document.frameLayout.resolvedShapes).toBeUndefined();
    provideEditorHelpers(helpers);
    store.actions.setEditorReady();
    expect(document.frameLayout.resolvedShapes).toBeDefined();
});

it('detects text mode dependencies used only by an instance override template', () => {
    const { store, document, ids } = setup();
    const source = json(document);
    Object.values(source.shapes).forEach((shape) => {
        delete shape.bindings;
        if (shape.type === 'text') {
            delete shape.wrapWidth;
            delete shape.template;
        }
    });
    expect(hasNumericLayout(source)).toBe(false);
    const instance = source.shapes[ids.nested];
    if (instance.type !== 'instance') {
        throw new Error('Expected instance');
    }
    store.actions.setVariableModeValue({
        variableId: ids.message,
        modeId: 'large',
        value: 'Welcome ${Copy}'
    });
    expect(document.variables[ids.message]).toMatchObject({
        values: { large: `Welcome \${${ids.copy}$Copy}` }
    });
    instance.overrides.copy = '${Copy}';
    expect(hasNumericLayout(source)).toBe(true);
});
