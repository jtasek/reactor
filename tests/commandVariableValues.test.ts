import { variableValues } from 'src/ui/components/CommandLine/variableValues';
import { createTestStore } from './support/store';
import { legacyTheme } from 'src/app/variableModes';

function setup() {
    const { store } = createTestStore();
    store.actions.addDocument({
        id: store.state.currentDocumentId,
        dimensions: { theme: legacyTheme() }
    });
    const screenId = store.actions.editFrame({
        kind: 'add',
        position: { x: 0, y: 0 },
        size: { width: 300, height: 200 }
    })!;
    store.actions.editFrame({ kind: 'update', id: screenId, changes: { kind: 'screen' } });
    const view = Object.values(store.state.currentDocument.frames).find(
        (frame) => frame.kind === 'view'
    )!;
    store.actions.editFrame({
        kind: 'update',
        id: view.id,
        changes: { modeOverrides: { theme: 'dark' } }
    });
    const id = store.actions.createVariable({ name: 'Ink', type: 'color', value: '#112233' })!;
    store.actions.setVariableDimension({ variableId: id, dimensionId: 'theme' });
    store.actions.setVariableModeValue({ variableId: id, modeId: 'dark', value: '#ddeeff' });
    store.actions.editFrame({ kind: 'select', id: view.id });

    return {
        store,
        id,
        view,
        screenId,
        variables: [{ id, name: 'Ink', type: 'color', bindsTo: ['fill'] }]
    };
}

it('resolves Screen view modes and aliases without mutating the document', () => {
    const { store, id, variables } = setup();
    const aliasId = store.actions.createVariable({
        name: 'Alias',
        type: 'color',
        value: '#000000'
    })!;
    store.actions.setVariableAlias({ variableId: aliasId, sourceId: id });
    const before = JSON.stringify(store.state.currentDocument);
    const result = variableValues(store.state, [
        ...variables,
        { id: aliasId, name: 'Alias', type: 'color' }
    ]);
    expect(result.map((variable) => variable.resolvedValue)).toEqual(['#ddeeff', '#ddeeff']);
    expect(result[0].provenance).toContain('Theme: Dark');
    expect(result[0].bindsTo).toEqual(['fill']);
    expect(JSON.stringify(store.state.currentDocument)).toBe(before);
});

it('refreshes after mode changes and reports fallback values', () => {
    const { store, variables, view } = setup();
    expect(variableValues(store.state, variables)[0].resolvedValue).toBe('#ddeeff');
    store.actions.editFrame({
        kind: 'update',
        id: view.id,
        changes: { modeOverrides: { theme: 'light' } }
    });
    expect(variableValues(store.state, variables)[0]).toMatchObject({ resolvedValue: '#112233' });
    expect(variableValues(store.state, variables)[0].provenance).toContain('Base value');
});

it('resolves responsive width modes after resizing a Screen view', () => {
    const { store, view, variables } = setup();
    const theme = store.state.currentDocument.dimensions.theme;
    store.actions.updateDimension({
        ...theme,
        selection: 'width',
        modes: {
            light: { ...theme.modes.light, minWidth: 0 },
            dark: { ...theme.modes.dark, minWidth: 400 }
        }
    });
    store.actions.editFrame({ kind: 'update', id: view.id, changes: { modeOverrides: {} } });
    expect(variableValues(store.state, variables)[0].resolvedValue).toBe('#112233');
    store.actions.editFrame({
        kind: 'update',
        id: view.id,
        changes: { size: { width: 500, height: 200 } }
    });
    const result = variableValues(store.state, variables)[0];
    expect(result.resolvedValue).toBe('#ddeeff');
    expect(result.provenance).toContain('Screen width · 500px');
});

it('resolves selected artwork in its Screen view and distinguishes mixed contexts', () => {
    const { store, view, screenId, variables } = setup();
    store.actions.drawShape({
        type: 'rectangle',
        position: { x: 10, y: 10 },
        size: { width: 40, height: 40 },
        parentFrameId: screenId
    });
    const state = {
        ...store.state,
        events: {
            ...store.state.events,
            pointer: {
                ...store.state.events.pointer,
                screenView: { documentId: store.state.currentDocumentId, viewId: view.id }
            }
        }
    };
    expect(variableValues(state, variables)[0].resolvedValue).toBe('#ddeeff');
    const sourceSelection = {
        ...state,
        currentDocument: { ...state.currentDocument, selectedFrameId: screenId }
    };
    expect(variableValues(sourceSelection, variables)[0].resolvedValue).toBe('#112233');

    // A second selected shape belongs to a different screen and must not inherit this view.
    const otherId = store.actions.editFrame({
        kind: 'add',
        position: { x: 400, y: 0 },
        size: { width: 300, height: 200 }
    })!;
    store.actions.editFrame({ kind: 'update', id: otherId, changes: { kind: 'screen' } });
    store.actions.addShape({
        type: 'rectangle',
        position: { x: 410, y: 10 },
        size: { width: 40, height: 40 },
        parentFrameId: otherId
    });
    const selection = {
        ...state,
        currentDocument: {
            ...store.state.currentDocument,
            selectedFrameId: undefined,
            selectedShapesIds: store.state.currentDocument.shapesIds
        }
    };
    expect(variableValues(selection, variables)[0].resolvedValue).toBe('Mixed values');
});
