import { explorerTree } from 'src/app/explorerTree';
import { createCopies, DOCUMENT_ID, settle, shownDocument } from './support/collaboration';
import type { Copy } from './support/collaboration';

type Actions = Copy['store']['actions'];

/** A Home frame holding Title on a shared layer, with Loose on the same layer on Canvas. */
function scene(actions: Actions, state: Copy['store']['state']) {
    actions.addDocument({ id: DOCUMENT_ID, name: 'Drops' });
    const frame = (name: string) => {
        const id = actions.editFrame({
            kind: 'add',
            position: { x: 0, y: 0 },
            size: { width: 400, height: 300 }
        })!;

        actions.editFrame({ kind: 'update', id, changes: { name } });

        return id;
    };

    frame('Home');
    frame('Settings');
    actions.addShape({
        type: 'rectangle',
        name: 'Title',
        position: { x: 10, y: 20 },
        size: { width: 30, height: 40 }
    });
    actions.addShape({
        type: 'rectangle',
        name: 'Loose',
        position: { x: 500, y: 20 },
        size: { width: 30, height: 40 }
    });
    const [title, loose] = state.currentDocument.shapesIds.slice(-2);

    actions.addLayer({ id: 'shared', name: 'Shared layer', shapesIds: [title, loose] });
}

async function setup() {
    const copies = await createCopies(2, (store) => scene(store.actions, store.state));
    const [first] = copies;
    const document = shownDocument(first);
    const frameNamed = (name: string) =>
        Object.values(document.frames).find((frame) => frame.name === name)!.id;
    const home = frameNamed('Home');
    const [title, loose] = document.layers.shared.shapesIds;

    first.store.actions.editFrame({
        kind: 'reparentShapes',
        ids: [title],
        parentFrameId: home
    });
    settle(copies);

    return { copies, first, document, home, title, loose, settings: frameNamed('Settings') };
}

describe('dropping on a layer row in the explorer', () => {
    it('moves the shape into the frame whose branch lists the layer, as one undo step', async () => {
        const { copies, first, document, home, title, loose } = await setup();

        first.store.actions.addLayer({ id: 'other', name: 'Other layer', shapesIds: [] });
        settle(copies);
        first.store.actions.moveShapesToLayer({
            shapeIds: [loose],
            layerId: 'other',
            parentFrameId: home
        });
        settle(copies);

        expect(document.shapes[loose].parentFrameId).toBe(home);
        expect(shownDocument(copies[1]).shapes[loose].parentFrameId).toBe(home);
        expect(
            explorerTree(document, '').frames.find((frame) => frame.id === home)?.layers
        ).toEqual([
            { layerId: 'shared', groups: [], shapesIds: [title] },
            { layerId: 'other', groups: [], shapesIds: [loose] }
        ]);

        first.collaboration.undo(DOCUMENT_ID);
        settle(copies);

        expect(document.shapes[loose].parentFrameId).toBeUndefined();
        expect(document.layers.shared.shapesIds).toContain(loose);
        expect(document.layers.other.shapesIds).not.toContain(loose);
        copies.forEach((copy) => copy.collaboration.dispose());
    });

    it('moves a shape onto Canvas from a layer row under Canvas, and on to another layer', async () => {
        const { copies, first, document, title } = await setup();

        first.store.actions.addLayer({ id: 'other', name: 'Other layer', shapesIds: [] });
        first.store.actions.moveShapesToLayer({
            shapeIds: [title],
            layerId: 'other',
            parentFrameId: null
        });
        settle(copies);

        expect(document.shapes[title].parentFrameId).toBeUndefined();
        expect(document.layers.other.shapesIds).toEqual([title]);
        copies.forEach((copy) => copy.collaboration.dispose());
    });

    it('changes nothing when the frame is locked', async () => {
        const { copies, first, document, loose, settings } = await setup();

        first.store.actions.editFrame({ kind: 'toggle', id: settings, flag: 'locked' });
        first.store.actions.addLayer({ id: 'other', name: 'Other layer', shapesIds: [] });
        first.store.actions.moveShapesToLayer({
            shapeIds: [loose],
            layerId: 'other',
            parentFrameId: settings
        });

        expect(document.shapes[loose].parentFrameId).toBeUndefined();
        expect(document.layers.shared.shapesIds).toContain(loose);
        copies.forEach((copy) => copy.collaboration.dispose());
    });

    it('keeps the old layer-only move when no frame is given', async () => {
        const { copies, first, document, title } = await setup();

        first.store.actions.moveShapesToLayer({ shapeIds: [title], layerId: null });

        expect(document.shapes[title].parentFrameId).toBeDefined();
        expect(document.layers.shared.shapesIds).not.toContain(title);
        copies.forEach((copy) => copy.collaboration.dispose());
    });
});
