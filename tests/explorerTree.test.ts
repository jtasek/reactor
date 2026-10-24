import { sceneLayers } from 'src/app/componentTree';
import { explorerLayers, explorerTree } from 'src/app/explorerTree';
import { outline } from 'src/app/membership';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { isShapeVisible } from 'src/app/utils';
import { createTestStore } from './support/store';

function framedScene() {
    const { store } = createTestStore();
    const document = store.state.currentDocument;
    const frame = (name: string, parentFrameId?: string) => {
        const id = store.actions.editFrame({
            kind: 'add',
            position: { x: 0, y: 0 },
            size: { width: 400, height: 300 }
        })!;

        store.actions.editFrame({ kind: 'update', id, changes: { name, parentFrameId } });

        return id;
    };
    const outer = frame('Home');
    const inner = frame('Card', outer);
    const other = frame('Settings');
    const shape = (name: string, parentFrameId?: string) => {
        store.actions.addShape({
            type: 'rectangle',
            name,
            parentFrameId,
            position: { x: 10, y: 20 },
            size: { width: 30, height: 40 }
        });

        return document.shapesIds.at(-1)!;
    };
    const title = shape('Title', outer);
    const artwork = shape('Artwork', inner);
    const button = shape('Button', inner);
    const loose = shape('Loose');

    store.actions.addGroup({ id: 'card-art', name: 'Card art', shapesIds: [artwork, button] });
    store.actions.addLayer({ id: 'shared', name: 'Shared layer', shapesIds: [title, loose] });

    return { store, document, outer, inner, other, title, artwork, button, loose };
}

describe('frame hierarchy in Explorer', () => {
    it('shows actual containment without layer wrappers, duplicate shapes or writes', () => {
        const { store, document, outer, inner, title, artwork, button, loose } = framedScene();
        const before = serializePersistedState(store.state);
        const tree = explorerTree(document, '');

        expect(tree.canvas).toEqual({ groups: [], shapesIds: [loose] });
        expect(tree.frames.find((frame) => frame.id === outer)?.contents).toEqual({
            groups: [],
            shapesIds: [title]
        });
        expect(tree.frames.find((frame) => frame.id === inner)).toEqual({
            id: inner,
            parentFrameId: outer,
            contents: {
                groups: [{ groupId: 'card-art', shapesIds: [artwork, button] }],
                shapesIds: []
            }
        });
        expect(serializePersistedState(store.state)).toEqual(before);
    });

    it('keeps global layers whole across frames, with layer-name search only in Layers', () => {
        const { document, title, loose } = framedScene();

        expect(explorerLayers(document, '').filter((layer) => layer.layerId === 'shared')).toEqual([
            { layerId: 'shared', groups: [], shapesIds: [title, loose] }
        ]);
        expect(explorerLayers(document, 'Shared layer')).toEqual([
            { layerId: 'shared', groups: [], shapesIds: [title, loose] }
        ]);
        expect(explorerTree(document, 'Shared layer')).toEqual({
            canvas: { groups: [], shapesIds: [] },
            frames: []
        });
    });

    it('reveals matching artwork with its group and complete frame ancestry', () => {
        const { document, outer, inner, artwork } = framedScene();
        const tree = explorerTree(document, 'ARTWORK');

        expect(tree.canvas).toEqual({ groups: [], shapesIds: [] });
        expect(tree.frames.map((frame) => frame.id).sort()).toEqual([outer, inner].sort());
        expect(tree.frames.find((frame) => frame.id === outer)?.contents).toEqual({
            groups: [],
            shapesIds: []
        });
        expect(tree.frames.find((frame) => frame.id === inner)?.contents.groups).toEqual([
            { groupId: 'card-art', shapesIds: [artwork] }
        ]);
    });

    it('a frame name matches all descendants, but not other screens or loose artwork', () => {
        const { document, outer, inner, artwork, button, other } = framedScene();
        const tree = explorerTree(document, 'home');

        expect(tree.canvas).toEqual({ groups: [], shapesIds: [] });
        expect(tree.frames.map((frame) => frame.id).sort()).toEqual([outer, inner].sort());
        expect(
            tree.frames.find((frame) => frame.id === inner)?.contents.groups[0].shapesIds
        ).toEqual([artwork, button]);
        expect(explorerTree(document, 'settings').frames).toEqual([
            { id: other, parentFrameId: undefined, contents: { groups: [], shapesIds: [] } }
        ]);
        expect(explorerTree(document, 'no match')).toEqual({
            canvas: { groups: [], shapesIds: [] },
            frames: []
        });
    });

    it('uses safe cycle roots and keeps orphaned shapes on Canvas without repairing data', () => {
        const { store, document: source, outer, inner, loose } = framedScene();
        const document = {
            ...source,
            frames: {
                ...source.frames,
                [outer]: { ...source.frames[outer], parentFrameId: inner }
            },
            shapes: {
                ...source.shapes,
                [loose]: { ...source.shapes[loose], parentFrameId: 'missing' }
            }
        };
        const before = serializePersistedState(store.state);
        const tree = explorerTree(document, '');

        expect(tree.frames.find((frame) => frame.id === outer)?.parentFrameId).toBeUndefined();
        expect(tree.frames.find((frame) => frame.id === inner)?.parentFrameId).toBeUndefined();
        expect(tree.canvas.shapesIds).toEqual([loose]);
        expect(serializePersistedState(store.state)).toEqual(before);
    });

    it('lists each member of a concurrently split group under its actual frame', () => {
        const { document: source, inner, other, artwork, button } = framedScene();
        const document = {
            ...source,
            shapes: {
                ...source.shapes,
                [button]: { ...source.shapes[button], parentFrameId: other }
            }
        };
        const tree = explorerTree(document, 'card art');

        expect(tree.frames.find((frame) => frame.id === inner)?.contents.groups).toEqual([
            { groupId: 'card-art', shapesIds: [artwork] }
        ]);
        expect(tree.frames.find((frame) => frame.id === other)?.contents.groups).toEqual([
            { groupId: 'card-art', shapesIds: [button] }
        ]);
    });
});

it('lists each source only under Components and scene objects under their layer or Surface', () => {
    const { store } = createTestStore();
    store.actions.addShape({
        type: 'rectangle',
        position: { x: 10, y: 20 },
        size: { width: 30, height: 40 }
    });
    const document = store.state.currentDocument;
    const sourceId = document.shapesIds[0];
    store.actions.createComponentFromSelection();
    const componentId = document.componentsIds[0];
    const instanceId = document.shapesIds[1];
    store.actions.addShape({
        type: 'rectangle',
        position: { x: 100, y: 20 },
        size: { width: 30, height: 40 }
    });
    const sceneId = document.shapesIds[2];
    store.actions.addGroup({ id: 'scene-group', shapesIds: [sourceId, sceneId] });

    expect(sceneLayers(outline(document), document)).toEqual([
        {
            layerId: null,
            groups: [{ groupId: 'scene-group', shapesIds: [sceneId] }],
            shapesIds: [instanceId]
        }
    ]);
    expect(isShapeVisible(document, sourceId)).toBe(false);
    expect(explorerTree(document, '').canvas).toEqual({
        groups: [{ groupId: 'scene-group', shapesIds: [sceneId] }],
        shapesIds: [instanceId]
    });
    expect(explorerLayers(document, '')).toEqual(sceneLayers(outline(document), document));
    store.actions.editComponentSource(componentId);
    expect(isShapeVisible(document, sourceId)).toBe(true);
    expect(isShapeVisible(document, sceneId)).toBe(false);
    store.actions.leaveComponentSource();
    expect(isShapeVisible(document, sceneId)).toBe(true);
    expect(document.selectedShapesIds).toEqual([instanceId]);
});

it('selecting a layer leaves layer isolation to its separate control', () => {
    const { store } = createTestStore();
    store.actions.addShape({
        type: 'rectangle',
        position: { x: 10, y: 20 },
        size: { width: 30, height: 40 }
    });
    const document = store.state.currentDocument;
    store.actions.addLayer({ id: 'walls', name: 'Walls', shapesIds: [...document.shapesIds] });

    store.actions.selectExplorerLayer('walls');
    expect(document.layers.walls.selected).toBe(true);
    expect(document.shownLayerId).toBeUndefined();
    store.actions.selectShape(document.shapesIds[0]);
    expect(document.layers.walls.selected).toBe(true);
    store.actions.unselectShapes();
    expect(document.layers.walls.selected).toBe(false);
});

it('selects Surface without creating or saving a layer', () => {
    const { store } = createTestStore();
    const document = store.state.currentDocument;

    store.actions.selectExplorerLayer(null);
    expect(document.surfaceSelected).toBe(true);
    expect(document.layers).toEqual({});
    const saved = serializePersistedState(store.state);
    expect(saved.documents[document.id]).not.toHaveProperty('surfaceSelected');

    store.actions.addLayer({ id: 'walls', name: 'Walls' });
    store.actions.selectExplorerLayer('walls');
    expect(document.surfaceSelected).not.toBe(true);
    expect(document.layers.walls.selected).toBe(true);

    store.actions.selectExplorerLayer(null);
    expect(document.surfaceSelected).toBe(true);
    expect(document.layers.walls.selected).toBe(false);
    store.actions.unselectShapes();
    expect(document.surfaceSelected).not.toBe(true);
});

it('keeps existing canvas sources in their layer tree', () => {
    const { store } = createTestStore();
    store.actions.addShape({
        type: 'rectangle',
        position: { x: 10, y: 20 },
        size: { width: 30, height: 40 }
    });
    const document = store.state.currentDocument;
    const shapeId = document.shapesIds[0];
    store.actions.addComponent({ shapesIds: [shapeId] });

    expect(sceneLayers(outline(document), document)[0].shapesIds).toEqual([shapeId]);
    expect(isShapeVisible(document, shapeId)).toBe(true);
});
