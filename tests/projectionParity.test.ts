import { json } from 'overmind';
import { booleanVisibility, simpleCondition } from 'src/app/prototypeState';
import { dataRecords } from 'src/app/data';
import { recordOverrides } from 'src/app/dataLists';
import type { Document, InstanceShape } from 'src/app/types';
import type { PreviewNode } from 'src/shared/previewProtocol';
import {
    canvasProjection,
    canvasShapes,
    exportProjection,
    nodeMarks,
    openDocument,
    previewProjection,
    type ParityStore
} from './support/projectionParity';
import { parityArtworkDocument } from './support/parityArtwork';
import { openPackage, packagePage } from './support/packageProjection';
import { DOCUMENT_FIXTURES } from './support/documentFixtures';

const fixture = (name: string) => DOCUMENT_FIXTURES.find(([label]) => label === name)![1];
/** Fixtures whose controls change variants or show hidden instances. */
const CONTROLS = [
    'primitives, nested instances, frame themes and state',
    'Inspector typography starter'
];
/** Fixtures with instances bound to records. */
const RECORDS = ['records repeated in a list', 'a selected record'];

const instanceOf = (document: Document, id: string) => document.shapes[id] as InstanceShape;
/** A plain copy of an opened document, to open again with changes. */
const copy = (document: Document): Document => JSON.parse(JSON.stringify(json(document)));

// An opened package page stubs the browser globals its runtime draws with.
afterEach(() => vi.unstubAllGlobals());

/** Whether Prototype opens with this shape hidden; the canvas always draws it. */
function hiddenAtStart(document: Document, id: string) {
    const shape = document.shapes[id];
    if (shape.type !== 'instance') {
        return false;
    }
    const followed = booleanVisibility(document, shape);
    const state = followed ? document.prototypeBooleans[followed.stateId] : undefined;

    return state ? state.initial !== followed!.when : shape.prototypeVisible === false;
}

/** The canvas after an edit, as a designer would make it to see what Prototype shows. */
async function canvasAfter(document: Document, edit: (document: Document) => void) {
    edit(document);

    return canvasProjection(await openDocument(document));
}

const views = (store: ParityStore) => [...canvasProjection(store).keys()];
const label = (store: ParityStore, viewId: string, shapeId?: string) =>
    [
        store.state.currentDocument.frames[viewId].name,
        shapeId && store.state.currentDocument.shapes[shapeId]?.name
    ]
        .filter(Boolean)
        .join(' › ');

describe.each(DOCUMENT_FIXTURES)('%s', (_, document) => {
    it('exports each View exactly as the canvas draws it', async () => {
        const store = await openDocument(document());
        for (const [viewId, shapes] of canvasProjection(store)) {
            store.actions.editFrame({ kind: 'select', id: viewId });
            expect(exportProjection(store).marks, label(store, viewId)).toEqual(
                [...shapes.values()].flat()
            );
        }
    });

    it.each(['preview', 'prototype'] as const)(
        'opens each View in %s as the canvas draws it',
        async (launch) => {
            const store = await openDocument(document());
            const opened = store.state.currentDocument;
            for (const [viewId, canvas] of canvasProjection(store)) {
                const preview = previewProjection(store, viewId, {}, launch).shapes;
                expect([...preview.keys()], label(store, viewId)).toEqual([...canvas.keys()]);
                for (const [shapeId, marks] of canvas) {
                    if (instanceOf(opened, shapeId).dataList) {
                        continue;
                    }
                    expect(preview.get(shapeId), label(store, viewId, shapeId)).toEqual(
                        hiddenAtStart(opened, shapeId) ? [] : marks
                    );
                }
            }
        }
    );

    it('downloads each View as a page that plays every screen as Prototype draws it', async () => {
        const store = await openDocument(document());
        const opened = store.state.currentDocument;
        for (const [viewId, canvas] of canvasProjection(store)) {
            const page = await openPackage(await packagePage(store, viewId));
            const { drawing, screen } = previewProjection(store, viewId, {}, 'prototype');
            expect(page.status, label(store, viewId)).toBeNull();
            expect(page.title).toBe(opened.name);
            const start = page.show(screen.id);
            expect([...start.keys()], label(store, viewId)).toEqual([...canvas.keys()]);
            for (const [shapeId, marks] of canvas) {
                if (!instanceOf(opened, shapeId).dataList) {
                    expect(start.get(shapeId), label(store, viewId, shapeId)).toEqual(
                        hiddenAtStart(opened, shapeId) ? [] : marks
                    );
                }
            }
            const launched = opened.frames[viewId];
            for (const other of drawing.screens) {
                const played = page.show(other.id);
                for (const node of other.nodes) {
                    const shapeId = node.key.slice(other.id.length + 1);
                    expect(played.get(shapeId), label(store, other.id, shapeId)).toEqual(
                        nodeMarks(node, other, drawing.states)
                    );
                }
                // Another screen plays at the launch size and modes, as a View of it set to them draws it.
                const shown = views(store).find(
                    (id) => id !== viewId && opened.frames[id].screenId === other.id
                );
                if (other.id === screen.id || !shown) {
                    continue;
                }
                const canvasOther = (
                    await canvasAfter(copy(opened), (edited) => {
                        const view = edited.frames[shown];
                        view.size = { ...launched.size };
                        view.modeOverrides = { ...launched.modeOverrides };
                        delete view.layoutId;
                        view.layoutMode = 'auto';
                    })
                ).get(shown)!;
                for (const [shapeId, marks] of canvasOther) {
                    if (!instanceOf(opened, shapeId).dataList) {
                        expect(played.get(shapeId), label(store, shown, shapeId)).toEqual(
                            hiddenAtStart(opened, shapeId) ? [] : marks
                        );
                    }
                }
            }
            page.close();
        }
    });

    it('downloads the same page wherever its Views sit and whatever the canvas shows', async () => {
        const store = await openDocument(document());
        const opened = store.state.currentDocument;
        const moved = copy(opened);
        for (const frame of Object.values(moved.frames)) {
            if (frame.kind === 'view') {
                frame.position = { x: frame.position.x + 1234, y: frame.position.y - 567 };
            }
        }
        moved.camera = { position: { x: -800, y: 300 }, scale: 0.25 };
        const elsewhere = await openDocument(moved);
        // The canvas shows the last mode of every dimension.
        for (const dimension of Object.values(opened.dimensions)) {
            elsewhere.actions.setPreviewMode({
                dimensionId: dimension.id,
                modeId: Object.keys(dimension.modes).at(-1)!
            });
        }
        for (const viewId of views(store)) {
            expect(await packagePage(elsewhere, viewId), label(store, viewId)).toBe(
                await packagePage(store, viewId)
            );
        }
    });
});

it.each(CONTROLS)(
    '%s: shows each variant and hidden instance a control reveals as the canvas draws it',
    async (name) => {
        const store = await openDocument(fixture(name)());
        let compared = 0;
        const authored = canvasProjection(store);
        for (const viewId of authored.keys()) {
            const { drawing, screen } = previewProjection(store, viewId);
            for (const node of screen.nodes) {
                const shapeId = node.key.slice(screen.id.length + 1);
                for (const variantId of Object.keys(node.variants ?? {})) {
                    const canvas = await canvasAfter(fixture(name)(), (document) => {
                        const shape = instanceOf(document, shapeId);
                        shape.variantId = variantId === shape.componentId ? undefined : variantId;
                        shape.variantMode = undefined;
                    });
                    const played = nodeMarks(node, screen, drawing.states, {
                        variants: { [node.variantKey!]: variantId }
                    });
                    expect(played, `${label(store, viewId, shapeId)} › ${variantId}`).toEqual(
                        canvas.get(viewId)!.get(shapeId)
                    );
                    compared += 1;
                }
                if (node.visibility) {
                    const { key, condition } = node.visibility;
                    const simple = simpleCondition(condition);
                    const shown = nodeMarks(node, screen, drawing.states, {
                        visibility: { [key]: true },
                        ...(simple?.kind === 'equals' && simple.value !== null
                            ? { states: { [simple.stateId]: simple.value } }
                            : {})
                    });
                    expect(shown, label(store, viewId, shapeId)).toEqual(
                        authored.get(viewId)!.get(shapeId)
                    );
                    compared += 1;
                }
            }
        }
        expect(compared).toBeGreaterThan(1);
    }
);

it.each(RECORDS)(
    '%s: draws each record as the canvas draws the template with its values',
    async (name) => {
        const store = await openDocument(fixture(name)());
        let compared = 0;
        for (const viewId of views(store)) {
            const { screen } = previewProjection(store, viewId);
            for (const node of screen.nodes) {
                const shapeId = node.key.slice(screen.id.length + 1);
                const instance = instanceOf(store.state.currentDocument, shapeId);
                if (!instance.dataList) {
                    continue;
                }
                const records = dataRecords(
                    store.state.currentDocument,
                    instance.dataList.entityId
                );
                // A list draws each record in its own row; a selected record replaces the template.
                const drawn: [string, PreviewNode][] = node.records
                    ? [
                          ['template', node.children![0]],
                          ...Object.entries(node.records).map(
                              ([id, item]): [string, PreviewNode] => [id, item]
                          )
                      ]
                    : node.children!.map((row, index) => [records[index].id, row.children![0]]);
                for (const [recordId, item] of drawn) {
                    const index = records.findIndex((record) => record.id === recordId);
                    const canvas = await canvasAfter(fixture(name)(), (document) => {
                        const shape = instanceOf(document, shapeId);
                        if (index >= 0) {
                            shape.overrides = recordOverrides(
                                document,
                                shape,
                                records[index],
                                index + 1
                            ).overrides;
                        }
                        delete shape.dataList;
                    });
                    expect(
                        nodeMarks(item, screen),
                        `${label(store, viewId, shapeId)} › ${recordId}`
                    ).toEqual(canvas.get(viewId)!.get(shapeId));
                    compared += 1;
                }
            }
        }
        expect(compared).toBeGreaterThan(1);
    }
);

it('exports selected artwork outside Screens as the canvas draws it', async () => {
    const document = parityArtworkDocument();
    document.frames = {};
    for (const shape of Object.values(document.shapes)) {
        delete shape.parentFrameId;
    }
    const store = await openDocument(document);
    const drawn = store.state.currentDocument.shapesIds.filter(
        (id) => store.state.currentDocument.shapes[id].visible
    );
    drawn.forEach((id) => store.actions.selectShape(id));
    const exported = exportProjection(store);
    store.actions.unselectShapes();

    expect(exported.marks).toEqual(canvasShapes(store, exported.x, exported.y));
});
