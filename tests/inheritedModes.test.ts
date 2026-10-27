import { json } from 'overmind';
import { createTestStore } from './support/store';
import { resolveModes, instanceModes } from 'src/app/inheritedModes';
import { themeColors } from 'src/app/themeColors';
import { resolveVariable } from 'src/app/variableResolver';
import { projectPreview } from 'src/preview/project';
import { applyInstanceOverrides } from 'src/app/componentProps';
import {
    exportDesignSystemPackage,
    parseDesignSystemPackage,
    planDesignSystemImport
} from 'src/app/designSystemPackages';
import {
    readEntity,
    serializePersistedState,
    migratePersistedState,
    hydrateDocument
} from 'src/app/services/documentStorage';
import { writeClipboard, readClipboard } from 'src/app/clipboard';
import { writeClipboard as writeFrame, readClipboard as readFrame } from 'src/app/frameEdits';
import { createCopies, edit, settle, shownDocument, DOCUMENT_ID } from './support/collaboration';
import type { VariableDimension } from 'src/app/types';

const dimensions: Record<string, VariableDimension> = {
    palette: {
        id: 'palette',
        name: 'Palette',
        order: 0,
        defaultModeId: 'day',
        modes: {
            day: { id: 'day', name: 'Day', order: 0 },
            night: { id: 'night', name: 'Night', order: 1 }
        }
    },
    brand: {
        id: 'brand',
        name: 'Brand',
        order: 1,
        defaultModeId: 'main',
        modes: {
            main: { id: 'main', name: 'Main', order: 0 },
            accent: { id: 'accent', name: 'Accent', order: 1 }
        }
    }
};

function setup(store = createTestStore().store) {
    store.actions.addDocument({
        id: store.state.currentDocumentId,
        dimensions: structuredClone(dimensions)
    });
    const document = store.state.currentDocument;
    const screenId = store.actions.editFrame({
        kind: 'add',
        position: { x: 100, y: 80 },
        size: { width: 300, height: 200 }
    })!;
    store.actions.editFrame({ kind: 'update', id: screenId, changes: { kind: 'screen' } });
    const mobileId = Object.values(document.frames).find((frame) => frame.kind === 'view')!.id;
    const viewId = store.actions.editFrame({
        kind: 'addView',
        screenId,
        name: 'Desktop',
        position: { x: 500, y: 300 },
        size: { width: 500, height: 250 }
    })!;
    const frameId = store.actions.editFrame({
        kind: 'add',
        position: { x: 120, y: 100 },
        size: { width: 200, height: 150 }
    })!;
    store.actions.editFrame({ kind: 'update', id: frameId, changes: { parentFrameId: screenId } });
    const colorId = store.actions.createVariable({ name: 'Ink', type: 'color', value: '#112233' })!;
    store.actions.setVariableDimension({ variableId: colorId, dimensionId: 'palette' });
    store.actions.setVariableModeValue({ variableId: colorId, modeId: 'night', value: '#ddeeff' });
    const aliasId = store.actions.createVariable({
        name: 'Content',
        type: 'color',
        value: '#000000'
    })!;
    store.actions.setVariableAlias({ variableId: aliasId, sourceId: colorId });
    store.actions.addShape({
        type: 'rectangle',
        position: { x: 130, y: 110 },
        size: { width: 40, height: 40 },
        parentFrameId: frameId
    });
    const shapeId = document.shapesIds.at(-1)!;
    store.actions.bindProperty({ shapeIds: [shapeId], key: 'fill', variableId: aliasId });
    store.actions.addShape({
        type: 'rectangle',
        position: { x: 10, y: 10 },
        size: { width: 40, height: 40 }
    });
    const leafId = document.shapesIds.at(-1)!;
    store.actions.bindProperty({ shapeIds: [leafId], key: 'fill', variableId: aliasId });
    store.actions.addComponent({ id: 'leaf', name: 'Leaf', sourceOnly: true, shapesIds: [leafId] });
    store.actions.addShape({
        type: 'instance',
        componentId: 'leaf',
        position: { x: 20, y: 20 },
        overrides: {}
    });
    const nestedId = document.shapesIds.at(-1)!;
    store.actions.addComponent({
        id: 'card',
        name: 'Card',
        sourceOnly: true,
        shapesIds: [nestedId]
    });
    store.actions.drawShape({
        type: 'instance',
        componentId: 'card',
        position: { x: 200, y: 110 },
        overrides: {},
        parentFrameId: frameId
    });
    const instanceId = document.selectedShapesIds[0];
    const instance = document.shapes[instanceId];
    const nested = document.shapes[nestedId];
    if (instance.type !== 'instance' || nested.type !== 'instance') {
        throw new Error('Expected instances');
    }
    const setFrame = (id: string, dimensionId: string, modeId: string | null) =>
        store.actions.setModeOverride({ target: { frameId: id }, dimensionId, modeId });
    const setInstance = (id: string, dimensionId: string, modeId: string | null) =>
        store.actions.setModeOverride({ target: { instanceId: id }, dimensionId, modeId });

    return {
        store,
        document,
        screenId,
        mobileId,
        viewId,
        frameId,
        shapeId,
        leafId,
        colorId,
        aliasId,
        instance,
        nested,
        setFrame,
        setInstance
    };
}

it('keeps dimensions opt-in and resolves each dimension independently from broadest to nearest', () => {
    expect(resolveModes(createTestStore().store.state.currentDocument).modes).toEqual({});
    const { document, screenId, viewId, frameId, instance, nested, setFrame, setInstance } =
        setup();
    setFrame(screenId, 'palette', 'night');
    setFrame(screenId, 'brand', 'accent');
    setFrame(viewId, 'palette', 'day');
    setFrame(frameId, 'brand', 'main');
    setInstance(instance.id, 'palette', 'night');
    setInstance(nested.id, 'brand', 'accent');
    const root = resolveModes(document, { simulation: { palette: 'day' }, viewId });
    expect(root.modes).toEqual({ palette: 'day', brand: 'accent' });
    expect(root.sources.palette).toContain('View');
    const child = resolveModes(document, { viewId, frameId, instances: [instance, nested] });
    expect(child.modes).toEqual({ palette: 'night', brand: 'accent' });
    expect(child.sources.brand).toBe(`Instance ${nested.name}`);
    expect(instanceModes(document, root.modes, instance).palette).toBe('night');
});

it('renders different modes through aliases in two views without shared writes from resolution or simulation', () => {
    const { store, document, viewId, mobileId, frameId, shapeId, aliasId, setFrame } = setup();
    setFrame(viewId, 'palette', 'night');
    const before = serializePersistedState(store.state);
    const mobile = resolveModes(document, { viewId: mobileId, frameId }).modes;
    const desktop = resolveModes(document, { viewId, frameId }).modes;
    expect(themeColors(document.shapes[shapeId], document, mobile).fill).toBe('#112233');
    expect(themeColors(document.shapes[shapeId], document, desktop).fill).toBe('#ddeeff');
    expect(resolveVariable(document.variables[aliasId], document.variables, desktop)).toBe(
        '#ddeeff'
    );
    store.actions.setPreviewMode({ dimensionId: 'palette', modeId: 'night' });
    expect(serializePersistedState(store.state)).toEqual(before);
    expect(document.shapes[shapeId].fill).toBe('#112233');
    expect(document.shapes[shapeId].bindings).toEqual({ fill: aliasId });
});

it('inherits ancestor changes per dimension, resets locally and diagnoses missing references without deleting them', () => {
    const { store, document, screenId, viewId, frameId, setFrame } = setup();
    setFrame(screenId, 'palette', 'night');
    setFrame(viewId, 'brand', 'accent');
    expect(resolveModes(document, { viewId, frameId }).modes).toEqual({
        palette: 'night',
        brand: 'accent'
    });
    setFrame(viewId, 'palette', 'day');
    setFrame(viewId, 'palette', null);
    expect(resolveModes(document, { viewId, frameId }).modes.palette).toBe('night');
    store.actions.applyOperations({
        documentId: document.id,
        by: { kind: 'person' },
        operations: [
            {
                op: 'updateFrame',
                frame: viewId,
                changes: { modeOverrides: { palette: 'removed', gone: 'missing' } }
            }
        ]
    });
    const before = json(document.frames[viewId]);
    const resolved = resolveModes(document, { viewId });
    expect(resolved.modes.palette).toBe('day');
    expect(resolved.problems).toHaveLength(2);
    expect(document.frames[viewId]).toEqual(before);
    setFrame(viewId, 'gone', null);
    expect(document.frames[viewId].modeOverrides).toEqual({ palette: 'removed' });
});

it('retains authored modes through persistence, operations and v14 loading, rejecting invalid batches atomically', () => {
    const { store, document, viewId, instance, setFrame, setInstance } = setup();
    setFrame(viewId, 'palette', 'night');
    setInstance(instance.id, 'brand', 'accent');
    const saved = serializePersistedState(store.state);
    const restored = hydrateDocument(
        migratePersistedState({ ...saved, version: 14 })!.documents[document.id]
    );
    expect(restored.frames[viewId].modeOverrides).toEqual({ palette: 'night' });
    expect(restored.shapes[instance.id]).toMatchObject({ modeOverrides: { brand: 'accent' } });
    expect(() =>
        readEntity('frames', { ...json(document.frames[viewId]), modeOverrides: { palette: 3 } })
    ).toThrow();
    expect(
        store.actions.applyOperations({
            documentId: document.id,
            by: { kind: 'person' },
            operations: [
                {
                    op: 'updateFrame',
                    frame: viewId,
                    changes: { modeOverrides: { palette: 'day' } }
                },
                {
                    op: 'updateShape',
                    shape: instance.id,
                    changes: { modeOverrides: { palette: 'night' } }
                }
            ]
        }).applied
    ).toBe(true);
    expect(document.frames[viewId].modeOverrides).toEqual({ palette: 'day' });
    expect(document.shapes[instance.id]).toMatchObject({ modeOverrides: { palette: 'night' } });
    const before = serializePersistedState(store.state);
    expect(
        store.actions.applyOperations({
            documentId: document.id,
            by: { kind: 'person' },
            operations: [
                {
                    op: 'updateFrame',
                    frame: viewId,
                    changes: { modeOverrides: { palette: 'night' } }
                },
                {
                    op: 'updateShape',
                    shape: document.shapesIds.find(
                        (id) => document.shapes[id].type === 'rectangle'
                    )!,
                    changes: { modeOverrides: { palette: 'night' } }
                }
            ]
        }).applied
    ).toBe(false);
    expect(serializePersistedState(store.state)).toEqual(before);
});

it('copies instance mode dependencies even when no variable uses that dimension', () => {
    const { store, document, instance, setInstance } = setup();
    setInstance(instance.id, 'brand', 'accent');
    const copied = readClipboard(
        writeClipboard([json(instance)], [], document.variables, document)
    );
    expect(copied.dimensions?.brand).toEqual(dimensions.brand);
    const { store: target } = createTestStore();
    expect(
        target.actions.pasteShapes(
            writeClipboard([json(instance)], [], document.variables, document)
        )
    ).toBe('pasted');
    expect(target.state.currentDocument.dimensions.brand).toEqual(dimensions.brand);
    expect(target.state.currentDocument.selectedShapes[0]).toMatchObject({
        modeOverrides: { brand: 'accent' }
    });
    store.actions.cloneShapes([instance.id]);
    expect(document.selectedShapes[0]).toMatchObject({ modeOverrides: { brand: 'accent' } });
});

it('copies mode dimensions with an empty frame', () => {
    const { store, document, setFrame } = setup();
    const id = store.actions.editFrame({
        kind: 'add',
        position: { x: 900, y: 50 },
        size: { width: 100, height: 100 }
    })!;
    setFrame(id, 'brand', 'accent');
    const copied = readFrame(writeFrame(document.frames[id], document))!;
    expect(copied.artwork.dimensions?.brand).toEqual(dimensions.brand);
    const { store: target } = createTestStore();
    const newId = target.actions.editFrame({
        kind: 'paste',
        frame: copied.frame,
        target: null,
        copied
    })!;
    expect(target.state.currentDocument.frames[newId].modeOverrides).toEqual({ brand: 'accent' });
    expect(target.state.currentDocument.dimensions.brand).toEqual(dimensions.brand);
});

it('preserves authored colors and partial nested mode overrides when detaching an instance', () => {
    const { store, document, instance, nested, setInstance } = setup();
    setInstance(instance.id, 'palette', 'night');
    setInstance(instance.id, 'brand', 'accent');
    setInstance(nested.id, 'brand', 'main');
    store.actions.detachInstances([instance.id]);
    const detached = document.selectedShapes.find((shape) => shape.type === 'instance')!;
    expect(detached).toMatchObject({ modeOverrides: { palette: 'night', brand: 'main' } });
    store.actions.detachInstances([detached.id]);
    expect(document.selectedShapes[0]).toMatchObject({ type: 'rectangle', fill: '#ddeeff' });
});

it('blocks authored mode changes under inherited locks, read-only access and during a gesture', () => {
    const { store, document, screenId, viewId, instance, setFrame, setInstance } = setup();
    store.actions.editFrame({ kind: 'toggle', id: screenId, flag: 'locked' });
    const before = serializePersistedState(store.state);
    setInstance(instance.id, 'palette', 'night');
    expect(serializePersistedState(store.state)).toEqual(before);
    store.actions.editFrame({ kind: 'toggle', id: viewId, flag: 'locked' });
    setFrame(viewId, 'palette', 'night');
    expect(document.frames[viewId].modeOverrides).toEqual({});
    store.actions.editFrame({ kind: 'toggle', id: viewId, flag: 'locked' });
    store.actions.events.beginGesture({ pointerId: 1, position: { x: 10, y: 10 } });
    setFrame(viewId, 'palette', 'night');
    expect(document.frames[viewId].modeOverrides).toEqual({});
    store.actions.events.cancelGesture();
    store.actions.setDocumentAccess({ [document.id]: { role: 'viewer' } });
    setFrame(viewId, 'palette', 'night');
    expect(document.frames[viewId].modeOverrides).toEqual({});
});

it('applies exposed color-variable overrides in the nested instance context and imports their native mode definitions', () => {
    const { store, document, leafId, nested, aliasId } = setup();
    store.actions.exposeComponentProp({
        componentId: 'leaf',
        shapeId: leafId,
        key: 'fill',
        label: 'Surface'
    });
    const component = document.components.leaf;
    store.actions.bindInstanceOverride({
        instanceIds: [nested.id],
        propId: component.props![0].id,
        variableId: aliasId
    });
    const resolved = applyInstanceOverrides(document.shapes[leafId], nested, component, document, {
        palette: 'night'
    });
    expect(resolved.fill).toBe('#ddeeff');
    expect(document.shapes[leafId].fill).toBe('#112233');
    const data = parseDesignSystemPackage(exportDesignSystemPackage(document));
    const { store: target } = createTestStore();
    let id = 0;
    const operations = planDesignSystemImport(
        json(target.state.currentDocument),
        data,
        'reuse',
        () => `import-${id++}`
    );
    expect(
        target.actions.applyOperations({
            documentId: target.state.currentDocumentId,
            by: { kind: 'person' },
            operations
        }).applied
    ).toBe(true);
    const imported = Object.values(target.state.currentDocument.variables).find(
        (variable) => variable.name === 'Ink'
    )!;
    if (imported.type !== 'color' || !imported.dimensionId) {
        throw new Error('Expected a color with a dimension');
    }
    const context = resolveModes(target.state.currentDocument, {
        simulation: { [imported.dimensionId]: 'night' }
    });
    expect(resolveVariable(imported, target.state.currentDocument.variables, context.modes)).toBe(
        '#ddeeff'
    );
});

it('snapshots screen-root modes on Preview launch, then applies descendant and nested instance overrides', () => {
    const { store, document, viewId, frameId, nested, setFrame, setInstance } = setup();
    setFrame(viewId, 'palette', 'night');
    store.actions.editFrame({ kind: 'select', id: viewId });
    const durable = serializePersistedState(store.state);
    store.actions.togglePreview();
    expect(serializePersistedState(store.state)).toEqual(durable);
    const session = json(store.state.previewModeContext)!;
    expect(session.modes.palette).toBe('night');
    setFrame(viewId, 'palette', 'day');
    expect(store.state.previewModeContext).toEqual(session);
    const colors = (value: unknown): string[] => {
        if (!value || typeof value !== 'object') {
            return [];
        }
        return Object.entries(value).flatMap(([key, item]) =>
            key === 'fill' && typeof item === 'string' ? [item] : colors(item)
        );
    };
    expect(colors(projectPreview(document, {}, [], session))).toContain('#ddeeff');
    setFrame(frameId, 'palette', 'day');
    expect(colors(projectPreview(document, {}, [], session))).not.toContain('#ddeeff');
    setInstance(nested.id, 'palette', 'night');
    expect(colors(projectPreview(document, {}, [], session))).toContain('#ddeeff');
    store.actions.closePreview();
    expect(store.state.previewModeContext).toBeNull();
});

it('manual Preview launch inherits each screen instead of copying the canvas simulation into the session', () => {
    const { store, document, screenId, viewId, setFrame } = setup();
    setFrame(screenId, 'palette', 'night');
    setFrame(viewId, 'palette', 'day');
    store.actions.setPreviewMode({ dimensionId: 'palette', modeId: 'day' });
    store.actions.events.setScreenView(viewId);
    store.actions.editFrame({ kind: 'select', id: screenId });
    store.actions.togglePreview();
    expect(store.state.previewModeContext?.modes).toEqual({});
    expect(store.state.previewModeContext?.screenId).toBe(screenId);
    expect(
        JSON.stringify(projectPreview(document, {}, [], store.state.previewModeContext))
    ).toContain('#ddeeff');
});

it('merges different dimension overrides and undoes only this author’s mode change', async () => {
    const copies = await createCopies(2, (store) => setup(store));
    const [a, b] = copies;
    const viewId = Object.values(shownDocument(a).frames).find(
        (frame) => frame.kind === 'view' && frame.position.x === 500
    )!.id;
    edit(a, (actions) =>
        actions.setModeOverride({
            target: { frameId: viewId },
            dimensionId: 'palette',
            modeId: 'night'
        })
    );
    edit(b, (actions) =>
        actions.setModeOverride({
            target: { frameId: viewId },
            dimensionId: 'brand',
            modeId: 'accent'
        })
    );
    settle(copies);
    expect(shownDocument(a).frames[viewId].modeOverrides).toEqual({
        palette: 'night',
        brand: 'accent'
    });
    expect(shownDocument(b).frames[viewId].modeOverrides).toEqual({
        palette: 'night',
        brand: 'accent'
    });
    a.collaboration.undo(DOCUMENT_ID);
    settle(copies);
    expect(shownDocument(b).frames[viewId].modeOverrides).toEqual({ brand: 'accent' });
});

it('keeps mode choices separate from adjacent edits within the normal undo merge window', async () => {
    const [copy] = await createCopies(1, (store) => setup(store), 500);
    const document = shownDocument(copy);
    const viewId = Object.values(document.frames).find((frame) => frame.kind === 'view')!.id;
    const setMode = (dimensionId: string, modeId: string) =>
        edit(copy, (actions) =>
            actions.setModeOverride({ target: { frameId: viewId }, dimensionId, modeId })
        );
    edit(copy, (actions) =>
        actions.editFrame({ kind: 'update', id: viewId, changes: { name: 'Renamed' } })
    );
    setMode('palette', 'night');
    setMode('brand', 'accent');
    copy.collaboration.undo(DOCUMENT_ID);
    expect(document.frames[viewId]).toMatchObject({
        name: 'Renamed',
        modeOverrides: { palette: 'night' }
    });
    copy.collaboration.undo(DOCUMENT_ID);
    expect(document.frames[viewId]).toMatchObject({ name: 'Renamed', modeOverrides: {} });
    copy.collaboration.undo(DOCUMENT_ID);
    expect(document.frames[viewId].name).not.toBe('Renamed');
});
