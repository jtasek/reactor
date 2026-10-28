import { json } from 'overmind';
import { createTestStore } from './support/store';
import { projectScreenViews } from 'src/app/screenProjection';
import {
    contextualDocument,
    hasNumericLayout,
    projectContextualLayout as projectFrameLayout
} from 'src/app/contextualLayout';
import { frameHandleBlocked } from 'src/app/frameLayout';
import { projectPreview } from 'src/preview/project';
import { resolveVariable } from 'src/app/variableResolver';
import { pointerDocument } from 'src/app/screenViewEditing';
import {
    serializePersistedState,
    hydrateDocument,
    migratePersistedState,
    readEntity
} from 'src/app/services/documentStorage';
import { readClipboard, writeClipboard } from 'src/app/frameEdits';
import {
    exportDesignSystemPackage,
    parseDesignSystemPackage,
    planDesignSystemImport
} from 'src/app/designSystemPackages';
import { createCopies, edit, settle, shownDocument, DOCUMENT_ID } from './support/collaboration';

export function setup(store = createTestStore().store) {
    store.actions.addDocument({
        id: store.state.currentDocumentId,
        dimensions: {
            density: {
                id: 'density',
                name: 'Density',
                order: 0,
                defaultModeId: 'compact',
                modes: {
                    compact: { id: 'compact', name: 'Compact', order: 0 },
                    comfortable: { id: 'comfortable', name: 'Comfortable', order: 1 }
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
                key: 'space',
                name: 'Space',
                type: 'number',
                value: 10,
                dimensionId: 'density',
                modeValues: { comfortable: 20 }
            },
            {
                op: 'addVariable',
                key: 'width',
                name: 'Control width',
                type: 'number',
                value: 40,
                dimensionId: 'density',
                modeValues: { comfortable: 80 }
            },
            {
                op: 'addVariable',
                key: 'alias',
                name: 'Control size',
                type: 'number',
                value: 40,
                alias: 'width'
            },
            {
                op: 'addFrame',
                key: 'screen',
                frame: {
                    kind: 'screen',
                    name: 'Home',
                    position: { x: 100, y: 100 },
                    size: { width: 400, height: 250 },
                    visible: true,
                    locked: false
                }
            },
            {
                op: 'addFrame',
                key: 'content',
                frame: {
                    name: 'Content',
                    parentFrameId: 'screen',
                    position: { x: 110, y: 110 },
                    size: { width: 250, height: 100 },
                    stack: { direction: 'row', gap: 10, padding: 10, align: 'start' },
                    bindings: { gap: 'space', padding: 'space' },
                    visible: true,
                    locked: false
                }
            },
            {
                op: 'addShape',
                key: 'first',
                shape: {
                    type: 'rectangle',
                    name: 'First',
                    parentFrameId: 'content',
                    position: { x: 120, y: 120 },
                    size: { width: 40, height: 30 },
                    bindings: { width: 'alias' }
                }
            },
            {
                op: 'addShape',
                key: 'second',
                shape: {
                    type: 'rectangle',
                    name: 'Second',
                    parentFrameId: 'content',
                    position: { x: 180, y: 120 },
                    size: { width: 40, height: 30 }
                }
            }
        ]
    });
    if (!result.applied) {
        throw new Error(result.problem);
    }

    const { screen, content, first, second, space, width, alias } = result.ids;
    const compact = Object.values(document.frames).find((frame) => frame.kind === 'view')!.id;
    const comfortable = store.actions.editFrame({
        kind: 'addView',
        screenId: screen,
        name: 'Comfortable',
        position: { x: 600, y: 100 },
        size: { width: 400, height: 250 }
    })!;
    store.actions.setModeOverride({
        target: { frameId: comfortable },
        dimensionId: 'density',
        modeId: 'comfortable'
    });

    return {
        store,
        document,
        screen,
        content,
        first,
        second,
        compact,
        comfortable,
        space,
        width,
        alias
    };
}

it('resolves number aliases before layout independently per view without changing source values', () => {
    const { store, document, first, second, comfortable, alias } = setup();
    expect(
        resolveVariable(document.variables[alias], document.variables, { density: 'comfortable' })
    ).toBe(80);
    const before = serializePersistedState(store.state);
    const views = projectScreenViews(document);
    const roomy = views.find((item) => item.view.id === comfortable)!.projection!;
    const compact = views.find((item) => item.view.id !== comfortable)!.projection!;
    expect(roomy.shapes.find((shape) => shape.id === first)).toMatchObject({
        size: { width: 80 },
        position: { x: 630, y: 130 }
    });
    expect(roomy.shapes.find((shape) => shape.id === second)).toMatchObject({
        position: { x: 730, y: 130 }
    });
    expect(compact.shapes.find((shape) => shape.id === first)).toMatchObject({
        size: { width: 40 },
        position: { x: 120, y: 120 }
    });
    expect(document.shapes[first]).toMatchObject({ size: { width: 40 } });
    expect(serializePersistedState(store.state)).toEqual(before);
});

it('passes local simulation through the layout projector but lets authored view choices win', () => {
    const { document, first, compact, comfortable } = setup();
    const projected = projectScreenViews(document, { density: 'comfortable' });
    for (const id of [compact, comfortable]) {
        expect(
            projected
                .find((item) => item.view.id === id)!
                .projection!.shapes.find((shape) => shape.id === first)
        ).toMatchObject({ size: { width: 80 } });
    }
});

it('reflows nested hug stacks from mode spacing and retains sizing-cycle diagnostics', () => {
    const { store, document, content, first, space, comfortable } = setup();
    const result = store.actions.applyOperations({
        documentId: document.id,
        by: { kind: 'person' },
        operations: [
            {
                op: 'addFrame',
                key: 'inner',
                frame: {
                    name: 'Inner',
                    parentFrameId: content,
                    position: { x: 200, y: 140 },
                    size: { width: 30, height: 60 },
                    visible: true,
                    locked: false,
                    sizing: { width: { mode: 'hug' } },
                    stack: { direction: 'row', gap: 0, padding: 10, align: 'start' },
                    bindings: { padding: space }
                }
            },
            {
                op: 'addShape',
                key: 'leaf',
                shape: {
                    type: 'rectangle',
                    position: { x: 210, y: 150 },
                    size: { width: 10, height: 20 },
                    parentFrameId: 'inner'
                }
            }
        ]
    });
    expect(result.applied).toBe(true);
    if (!result.applied) {
        return;
    }

    const view = projectScreenViews(document).find(
        (item) => item.view.id === comfortable
    )!.projection!;
    expect(view.frames.find((frame) => frame.id === result.ids.inner)?.size.width).toBe(50);
    expect(
        store.actions.applyOperations({
            documentId: document.id,
            by: { kind: 'person' },
            operations: [
                {
                    op: 'updateFrame',
                    frame: content,
                    changes: { sizing: { width: { mode: 'hug' } } }
                },
                {
                    op: 'updateShape',
                    shape: first,
                    changes: { sizing: { width: { mode: 'fill' } } }
                }
            ]
        }).applied
    ).toBe(true);
    const layout = projectFrameLayout(document, { simulation: { density: 'comfortable' } });
    expect(layout.problems[content]).toContain('Sizing cycle');
    expect(Number.isFinite(layout.shapeSizes[first].width)).toBe(true);
    store.actions.setVariableModeValue({ variableId: space, modeId: 'comfortable', value: -1 });
    const problems = projectScreenViews(document).find((item) => item.view.id === comfortable)!
        .projection!.problems;
    expect(problems.some((problem) => problem.includes('Sizing cycle'))).toBe(true);
    expect(problems.some((problem) => problem.includes('authored value'))).toBe(true);
});

it('clamps contextual frame dimensions while each view retains its independent viewport', () => {
    const { store, document, content, comfortable } = setup();
    const result = store.actions.applyOperations({
        documentId: document.id,
        by: { kind: 'person' },
        operations: [
            {
                op: 'addVariable',
                key: 'frameWidth',
                name: 'Frame width',
                type: 'number',
                value: 120,
                dimensionId: 'density',
                modeValues: { comfortable: 240 }
            },
            {
                op: 'updateFrame',
                frame: content,
                changes: {
                    bindings: { ...document.frames[content].bindings, width: 'frameWidth' },
                    sizing: { width: { mode: 'fixed', min: 100, max: 200 } }
                }
            }
        ]
    });
    expect(result.applied).toBe(true);
    const views = projectScreenViews(document);
    expect(
        views
            .find((item) => item.view.id === comfortable)!
            .projection!.frames.find((frame) => frame.id === content)?.size.width
    ).toBe(200);
    expect(
        views
            .find((item) => item.view.id !== comfortable)!
            .projection!.frames.find((frame) => frame.id === content)?.size.width
    ).toBe(120);
    expect(views.every((item) => item.projection?.screen.size.width === 400)).toBe(true);
});

it('refuses a size binding on a top-level Screen, whose views set its size', () => {
    const { store, document, screen, width } = setup();
    const result = store.actions.applyOperations({
        documentId: document.id,
        by: { kind: 'person' },
        operations: [{ op: 'updateFrame', frame: screen, changes: { bindings: { width } } }]
    });
    expect(result.applied).toBe(false);
    expect(document.frames[screen].size.width).toBe(400);
    expect(json(document.frames[screen].bindings)).toEqual({});
});

it('rejects malformed numeric modes and incompatible frame bindings as a whole batch', () => {
    const { store, document, content, width, comfortable } = setup();
    const before = serializePersistedState(store.state);
    const apply = (operations: import('src/app/operations').Operation[]) =>
        store.actions.applyOperations({
            documentId: document.id,
            by: { kind: 'person' },
            operations
        });
    expect(
        apply([
            { op: 'updateFrame', frame: content, changes: { name: 'Changed' } },
            { op: 'updateVariable', variable: width, modeValues: { comfortable: '#abcdef' } }
        ]).applied
    ).toBe(false);
    expect(
        apply([{ op: 'updateFrame', frame: comfortable, changes: { bindings: { width } } }]).applied
    ).toBe(false);
    expect(serializePersistedState(store.state)).toEqual(before);
});

it('preserves number aliases and base bindings when promoting a new dimension default', () => {
    const { store, document, content, first } = setup();
    store.actions.updateDimension({
        ...json(document.dimensions.density),
        defaultModeId: 'comfortable'
    });
    expect(document.frames[content].stack).toMatchObject({ gap: 20, padding: 20 });
    expect(document.shapes[first]).toMatchObject({ size: { width: 80 } });
    const view = projectScreenViews(document).find(
        (item) => item.view.kind === 'view'
    )!.projection!;
    expect(view.shapes.find((shape) => shape.id === first)).toMatchObject({ size: { width: 80 } });
});

it('retains frame bindings and number modes through reload, copy/paste and native packages', () => {
    const { store, document, content, first } = setup();
    const saved = serializePersistedState(store.state);
    const restored = hydrateDocument(migratePersistedState(saved)!.documents[document.id]);
    expect(restored.frames[content].bindings).toEqual(document.frames[content].bindings);
    const copied = readClipboard(writeClipboard(document.frames[content], document))!;
    const target = createTestStore().store;
    const id = target.actions.editFrame({
        kind: 'paste',
        frame: copied.frame,
        copied,
        target: null
    });
    expect(id).toBeDefined();
    const copiedFrame = target.state.currentDocument.frames[id!];
    expect(Object.keys(copiedFrame.bindings!)).toEqual(['gap', 'padding']);
    expect(
        Object.values(target.state.currentDocument.variables).find(
            (variable) => variable.name === 'Control width'
        )
    ).toMatchObject({ dimensionId: 'density', values: { comfortable: 80 } });
    const packageData = parseDesignSystemPackage(exportDesignSystemPackage(document));
    const other = createTestStore().store;
    let next = 0;
    const operations = planDesignSystemImport(
        json(other.state.currentDocument),
        packageData,
        'reuse',
        () => `import-${next++}`
    );
    expect(
        other.actions.applyOperations({
            documentId: other.state.currentDocumentId,
            by: { kind: 'person' },
            operations
        }).applied
    ).toBe(true);
    expect(restored.shapes[first].bindings).toEqual(document.shapes[first].bindings);
});

it('uses contextual layout in Preview and preserves descendant overrides after a launch snapshot', () => {
    const { store, document, content } = setup();
    const drawing = projectPreview(document, {}, [], { modes: { density: 'comfortable' } });
    expect(JSON.stringify(drawing)).toContain('"width":80');
    store.actions.setModeOverride({
        target: { frameId: content },
        dimensionId: 'density',
        modeId: 'compact'
    });
    expect(
        JSON.stringify(projectPreview(document, {}, [], { modes: { density: 'comfortable' } }))
    ).not.toContain('"width":80');
});

it('keeps another Screen’s numeric mode when Preview launches from a view', () => {
    const { store, document, screen, comfortable, width } = setup();
    const other = store.actions.editFrame({
        kind: 'add',
        position: { x: 2000, y: 0 },
        size: { width: 300, height: 200 }
    })!;
    store.actions.editFrame({
        kind: 'update',
        id: other,
        changes: { kind: 'screen', stack: { direction: 'row', gap: 0, padding: 0, align: 'start' } }
    });
    store.actions.setModeOverride({
        target: { frameId: other },
        dimensionId: 'density',
        modeId: 'compact'
    });
    store.actions.drawShape({
        type: 'rectangle',
        name: 'Other',
        position: { x: 2010, y: 10 },
        size: { width: 40, height: 30 },
        parentFrameId: other
    });
    store.actions.bindProperty({
        shapeIds: [document.selectedShapesIds[0]],
        key: 'width',
        variableId: width
    });
    store.actions.editFrame({ kind: 'select', id: comfortable });
    store.actions.togglePreview();
    const drawing = projectPreview(document, {}, [], json(store.state.previewModeContext));
    expect(JSON.stringify(drawing.screens.find((item) => item.id === screen))).toContain(
        '"width":80'
    );
    expect(JSON.stringify(drawing.screens.find((item) => item.id === other))).toContain(
        '"width":40'
    );
});

it('remaps copied frame modes while preserving numeric bindings and their dimensions', () => {
    const { store, document, content } = setup();
    const theme = store.actions.createDimension('Appearance')!;
    store.actions.addDimensionMode({ dimensionId: theme, name: 'Night' });
    const night = Object.values(document.dimensions[theme].modes).find(
        (mode) => mode.name === 'Night'
    )!.id;
    store.actions.setModeOverride({
        target: { frameId: content },
        dimensionId: theme,
        modeId: night
    });
    const copied = readClipboard(writeClipboard(document.frames[content], document))!;
    const target = createTestStore().store;
    target.actions.addDocument({
        id: target.state.currentDocumentId,
        dimensions: {
            other: {
                id: 'other',
                name: 'Appearance',
                order: 0,
                defaultModeId: 'day',
                modes: {
                    day: { id: 'day', name: 'Default', order: 0 },
                    dark: { id: 'dark', name: 'Night', order: 1 }
                }
            }
        }
    });
    const id = target.actions.editFrame({
        kind: 'paste',
        frame: copied.frame,
        copied,
        target: null
    })!;
    const frame = target.state.currentDocument.frames[id];
    expect(frame.modeOverrides).toEqual({ other: 'dark' });
    expect(Object.keys(frame.bindings!)).toEqual(['gap', 'padding']);
    expect(target.state.currentDocument.dimensions.density).toBeDefined();
});

it('captures the launched viewport and keeps later view resizing out of the Preview session', () => {
    const { store, document, comfortable, content, screen } = setup();
    store.actions.editFrame({
        kind: 'update',
        id: screen,
        changes: { stack: { direction: 'row', gap: 0, padding: 0, align: 'start' } }
    });
    store.actions.editFrame({
        kind: 'update',
        id: comfortable,
        changes: { size: { width: 600, height: 300 } }
    });
    store.actions.editFrame({
        kind: 'update',
        id: content,
        changes: { sizing: { width: { mode: 'fill' } } }
    });
    store.actions.editFrame({ kind: 'select', id: comfortable });
    const before = serializePersistedState(store.state);
    store.actions.togglePreview();
    const session = json(store.state.previewModeContext)!;
    expect(session.viewport).toEqual({ width: 600, height: 300 });
    expect(projectPreview(document, {}, [], session).screens[0].width).toBe(600);
    expect(serializePersistedState(store.state)).toEqual(before);
    store.actions.editFrame({
        kind: 'update',
        id: comfortable,
        changes: { size: { width: 700, height: 400 } }
    });
    expect(projectPreview(document, {}, [], session).screens[0].width).toBe(600);
});

it('refreshes hit geometry when a numeric mode value changes during a marquee', () => {
    const { store, first, width, comfortable } = setup();
    store.actions.events.beginGesture({
        pointerId: 1,
        position: { x: 950, y: 250 },
        screenViewId: comfortable
    });
    expect(store.state.events.pointer.gesture.kind).toBe('marquee');
    expect(pointerDocument(store.state).shapes[first]).toMatchObject({ size: { width: 80 } });
    store.actions.setVariableModeValue({ variableId: width, modeId: 'comfortable', value: 90 });
    expect(pointerDocument(store.state).shapes[first]).toMatchObject({ size: { width: 90 } });
    store.actions.events.cancelGesture();
    expect(store.state.currentDocument.shapes[first]).toMatchObject({ size: { width: 40 } });
});

it('falls back safely for invalid numeric overrides without repairing authored data', () => {
    const { store, document, space, content, first } = setup();
    const number = document.variables[space];
    if (number.type !== 'number') {
        throw new Error('Expected number');
    }
    store.actions.setVariableModeValue({ variableId: space, modeId: 'comfortable', value: -20 });
    const before = json(number);
    const layout = projectFrameLayout(document, { simulation: { density: 'comfortable' } });
    expect(layout.modeProblems?.[content]).toContain('authored value');
    expect(layout.problems[content]).toBeUndefined();
    expect(layout.shapeSizes[first].width).toBe(80);
    expect(number).toEqual(before);
    expect(() =>
        readEntity('variables', {
            id: 'invalid',
            name: 'Invalid',
            type: 'number',
            values: { default: 1, comfortable: Infinity },
            dimensionId: 'density'
        })
    ).toThrow();
});

it('keeps base binding behavior on edits and detaches a frame field only when explicitly changed', () => {
    const { store, document, content, space } = setup();
    store.actions.setVariableValue({ variableId: space, value: 12 });
    expect(document.frames[content].stack).toMatchObject({ gap: 12, padding: 12 });
    store.actions.editFrame({
        kind: 'update',
        id: content,
        changes: { stack: { ...document.frames[content].stack!, gap: 8 } }
    });
    expect(document.frames[content].bindings).toEqual({ padding: space });
    store.actions.deleteVariable(space);
    expect(document.frames[content].bindings).toEqual({});
    expect(document.frames[content].stack?.padding).toBe(12);
});

it('allows invalid inherited frame inputs to be reset independently', () => {
    const { store, document, content, space } = setup();
    store.actions.setVariableValue({ variableId: space, value: -1 });
    store.actions.editFrame({
        kind: 'update',
        id: content,
        changes: { bindings: { padding: space } }
    });
    expect(document.frames[content].bindings).toEqual({ padding: space });
    store.actions.editFrame({ kind: 'update', id: content, changes: { bindings: {} } });
    expect(document.frames[content].bindings).toEqual({});
});

it('supports number modes for typography while retaining ordinary base-only font bindings', () => {
    const { store, document, width } = setup();
    store.actions.drawShape({
        type: 'text',
        value: 'Label',
        fontSize: 14,
        position: { x: 500, y: 400 }
    });
    const id = document.selectedShapesIds[0];
    store.actions.bindProperty({ shapeIds: [id], key: 'fontSize', variableId: width });
    expect(document.shapes[id]).toMatchObject({ fontSize: 40 });
    expect(document.shapes[id].bindings?.fontSize).toBe(width);
    expect(
        projectFrameLayout(document, { simulation: { density: 'comfortable' } }).resolvedShapes?.[
            id
        ]
    ).toMatchObject({ fontSize: 80 });
    const base = store.actions.createVariable({ name: 'Base font', type: 'number', value: 18 })!;
    store.actions.bindProperty({ shapeIds: [id], key: 'fontSize', variableId: base });
    expect(document.shapes[id]).toMatchObject({ fontSize: 18, bindings: { fontSize: base } });
});

it('merges independent frame bindings and undoes only the local change', async () => {
    const copies = await createCopies(2, (store) => setup(store));
    const [a, b] = copies;
    const document = shownDocument(a);
    const content = Object.values(document.frames).find((frame) => frame.name === 'Content')!.id;
    const space = Object.values(document.variables).find(
        (variable) => variable.name === 'Space'
    )!.id;
    edit(a, (actions) =>
        actions.editFrame({ kind: 'update', id: content, changes: { bindings: { gap: space } } })
    );
    edit(b, (actions) =>
        actions.editFrame({
            kind: 'update',
            id: content,
            changes: { bindings: { padding: space } }
        })
    );
    settle(copies);
    expect(shownDocument(b).frames[content].bindings).toEqual({});
    a.collaboration.undo(DOCUMENT_ID);
    settle(copies);
    expect(shownDocument(b).frames[content].bindings).toEqual({ padding: space });
});

it('blocks only resize handles whose every axis follows a variable', () => {
    const { document, content, width } = setup();
    const frame = { ...json(document.frames[content]), bindings: { width } };
    expect(frameHandleBlocked(frame, 'middleRight')).toBe(true);
    expect(frameHandleBlocked(frame, 'middleLeft')).toBe(true);
    expect(frameHandleBlocked(frame, 'middleBottom')).toBe(false);
    expect(frameHandleBlocked(frame, 'bottomRight')).toBe(false);
    expect(frameHandleBlocked({ ...frame, bindings: { width, height: width } }, 'topLeft')).toBe(
        true
    );
});

it('drops a mode size binding when a rectangle leaves its stack, keeping base-only ones', () => {
    const { store, document, first, second, screen } = setup();
    const plain = store.actions.applyOperations({
        documentId: document.id,
        by: { kind: 'person' },
        operations: [
            { op: 'addVariable', key: 'plain', name: 'Plain', type: 'number', value: 30 },
            { op: 'updateShape', shape: second, changes: { bindings: { height: 'plain' } } }
        ]
    });
    expect(plain.applied).toBe(true);
    const result = store.actions.applyOperations({
        documentId: document.id,
        by: { kind: 'person' },
        operations: [
            { op: 'updateShape', shape: first, changes: { parentFrameId: screen } },
            { op: 'updateShape', shape: second, changes: { parentFrameId: screen } }
        ]
    });
    expect(result.applied).toBe(true);
    expect(json(document.shapes[first].bindings ?? {})).not.toHaveProperty('width');
    expect(json(document.shapes[second].bindings)).toHaveProperty('height');
});

it('skips mode work for documents and frames with no bound mode inputs', () => {
    const { store, document, content, first, space, alias } = setup();
    expect(hasNumericLayout(document)).toBe(true);
    const result = store.actions.applyOperations({
        documentId: document.id,
        by: { kind: 'person' },
        operations: [
            { op: 'updateFrame', frame: content, changes: { bindings: {} } },
            { op: 'deleteShapes', shapes: [first] }
        ]
    });
    expect(result.applied).toBe(true);
    expect(document.variables[space]).toMatchObject({ dimensionId: 'density' });
    expect(document.variables[alias]).toBeDefined();
    expect(hasNumericLayout(document)).toBe(false);
    expect(contextualDocument(document)).toBe(document);
});
