import { readFlowPositions } from 'src/pages/flowPositions';
import { projectFlow } from 'src/app/flowProjection';
import { createComponent, createShape } from 'src/app/factories';
import {
    serializePersistedState,
    restoreDocuments,
    migratePersistedState
} from 'src/app/services/documentStorage';
import { previewFixture } from './support/preview';
import { automaticLayoutsPrototype } from './support/automaticScreenLayouts';
import { createCopies, edit, settle, shownDocument, DOCUMENT_ID } from './support/collaboration';

function live(document: ReturnType<typeof previewFixture>) {
    document.groupsIds = Object.keys(document.groups);
    document.layersIds = Object.keys(document.layers);
    document.componentsIds = Object.keys(document.components);

    return document;
}

it('projects one node per definition across multiple placements and alternate layouts without changing geometry', () => {
    const document = live(automaticLayoutsPrototype());
    document.frames.desktop = { ...document.frames.view, id: 'desktop', name: 'Desktop' };
    const before = JSON.stringify(document);
    const graph = projectFlow(document);
    expect(graph.map((screen) => screen.id)).toEqual(['home', 'details']);
    expect(graph[0].controls.some((control) => control.instanceId === 'next')).toBe(true);
    expect(new Set(graph[0].controls.map((control) => control.key)).size).toBe(
        graph[0].controls.length
    );
    expect(JSON.stringify(document)).toBe(before);
});

it('retains missing and hidden destinations and distinguishes explicit none from inherited actions', () => {
    const document = live(previewFixture());
    document.frames.details.visible = false;
    expect(
        projectFlow(document)[0].controls.find((control) => control.instanceId === 'next')
    ).toMatchObject({ target: 'details', missing: true });
    delete document.frames.details;
    expect(
        projectFlow(document)[0].controls.find((control) => control.instanceId === 'next')?.target
    ).toBe('details');
    const instance = document.shapes.next;
    if (instance.type !== 'instance') {
        throw new Error('Expected instance');
    }
    instance.interactions = { activate: null };
    expect(
        projectFlow(document)[0].controls.find((control) => control.instanceId === 'next')
    ).toMatchObject({ target: undefined, missing: false });
});

it('projects nested controls without duplication and blocks editing locked or imported controls', () => {
    const document = live(previewFixture());
    const child = createShape({
        type: 'instance',
        name: 'Control',
        order: 'a5',
        componentId: 'button',
        position: { x: 0, y: 0 },
        overrides: {}
    });
    child.id = 'nested';
    child.name = 'Nested button';
    document.shapes.nested = child;
    document.components.container = createComponent({
        id: 'container',
        name: 'Container',
        sourceOnly: true,
        shapesIds: ['nested']
    });
    document.shapes.container = {
        ...createShape({
            type: 'instance',
            name: 'Control',
            order: 'a5',
            componentId: 'container',
            position: { x: 0, y: 0 },
            overrides: {}
        }),
        id: 'container',
        parentFrameId: 'home'
    };
    child.parentFrameId = 'home';
    const nested = () =>
        projectFlow(document)[0].controls.filter((control) => control.instanceId === 'nested');
    expect(nested()).toHaveLength(1);
    expect(nested()[0]).toMatchObject({
        key: 'container/container/nested',
        editable: true,
        target: 'details'
    });
    child.locked = true;
    expect(nested()[0].editable).toBe(false);
    delete document.shapes.nested;
    document.components.container.sourceShapes = { nested: child };
    expect(nested()[0].editable).toBe(false);
});

it('reflects shared action edits, undo and remote edits without changing screen geometry', async () => {
    const copies = await createCopies(2, (store) => {
        const document = previewFixture();
        document.id = store.state.currentDocumentId;
        const saved = serializePersistedState({
            currentDocumentId: document.id,
            documents: { [document.id]: document }
        });
        store.actions.addDocument(restoreDocuments(migratePersistedState(saved)!)[document.id]);
    });
    const [a, b] = copies;
    const target = (copy: typeof a) =>
        projectFlow(shownDocument(copy))[0].controls.find(
            (control) => control.instanceId === 'next'
        )?.target;
    edit(a, (actions) =>
        actions.editInteractions({
            target: 'instance',
            id: 'next',
            settings: { activate: { type: 'navigate', screenId: 'home' } }
        })
    );
    settle(copies);
    expect(target(a)).toBe('home');
    expect(target(b)).toBe('home');
    a.collaboration.undo(DOCUMENT_ID);
    settle(copies);
    expect(target(a)).toBe('details');
    expect(target(b)).toBe('details');
});

it('ignores invalid local diagram positions without reading them as document geometry', () => {
    expect(readFlowPositions(null)).toEqual({});
    expect(
        readFlowPositions({
            home: { x: 20, y: 40 },
            broken: { x: '20', y: 0 },
            infinite: { x: Infinity, y: 0 }
        })
    ).toEqual({ home: { x: 20, y: 40 } });
});
