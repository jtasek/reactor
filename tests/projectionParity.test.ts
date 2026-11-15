import { buildStarterTemplate } from 'src/templates/build';
import { STARTER_TEMPLATES } from 'src/templates/catalog';
import { createDocument } from 'src/app/factories';
import { dataRecords } from 'src/app/data';
import { recordOverrides } from 'src/app/dataLists';
import type { Document, InstanceShape } from 'src/app/types';
import type { PreviewNode } from 'src/preview/protocol';
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
import { prototypeDocument } from './support/prototype';
import { responsiveDocument } from './support/responsiveModes';
import { responsiveVariantsDocument } from './support/responsiveVariants';
import { screenLayoutsDocument } from './support/screenLayouts';
import { dataListFixture, recordDetailFixture } from './support/dataList';

/**
 * One fixture set drawn by the canvas, Prototype and SVG export and compared as what a
 * person sees. Intended differences: Prototype hides instances that start hidden, draws
 * records where an instance is bound to data, and swaps artwork as controls are used; the
 * canvas and export always draw the authored artwork.
 */
const FIXTURES: [string, () => Document][] = [
    ['primitives, nested instances, frame themes and state', parityArtworkDocument],
    ['theme and width modes', () => responsiveDocument()],
    ['automatic and explicit screen layouts', prototypeDocument],
    ['stacks with fill in two layouts', () => screenLayoutsDocument()],
    ['responsive component variants', () => responsiveVariantsDocument()],
    ['records repeated in a list', () => dataListFixture().document],
    ['a selected record', () => recordDetailFixture().document],
    ...STARTER_TEMPLATES.map(({ id, name }): [string, () => Document] => [
        `${name} starter`,
        () => {
            let next = 0;

            return createDocument({ id, ...buildStarterTemplate(id, () => `${id}-${next++}`) });
        }
    ])
];
const fixture = (name: string) => FIXTURES.find(([label]) => label === name)![1];
/** Fixtures whose controls change variants or show hidden instances. */
const CONTROLS = [
    'primitives, nested instances, frame themes and state',
    'Inspector typography starter'
];
/** Fixtures with instances bound to records. */
const RECORDS = ['records repeated in a list', 'a selected record'];

const instanceOf = (document: Document, id: string) => document.shapes[id] as InstanceShape;

/** Whether Prototype opens with this shape hidden; the canvas always draws it. */
function hiddenAtStart(document: Document, id: string) {
    const shape = document.shapes[id];
    if (shape.type !== 'instance') {
        return false;
    }
    const state = shape.prototypeVisibilityStateId
        ? document.prototypeBooleans[shape.prototypeVisibilityStateId]
        : undefined;

    return state
        ? state.initial !== (shape.prototypeVisibilityWhen ?? true)
        : shape.prototypeVisible === false;
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

describe.each(FIXTURES)('%s', (_, document) => {
    it('exports each View exactly as the canvas draws it', async () => {
        const store = await openDocument(document());
        for (const [viewId, shapes] of canvasProjection(store)) {
            store.actions.editFrame({ kind: 'select', id: viewId });
            expect(exportProjection(store).marks, label(store, viewId)).toEqual(
                [...shapes.values()].flat()
            );
        }
    });

    it('opens each View in Prototype as the canvas draws it', async () => {
        const store = await openDocument(document());
        const opened = store.state.currentDocument;
        for (const [viewId, canvas] of canvasProjection(store)) {
            const preview = previewProjection(store, viewId).shapes;
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
    });
});

it.each(CONTROLS)(
    '%s: shows each variant and hidden instance a control reveals as the canvas draws it',
    async (name) => {
        const store = await openDocument(fixture(name)());
        let compared = 0;
        for (const viewId of views(store)) {
            const { drawing, screen } = previewProjection(store, viewId);
            for (const node of screen.nodes) {
                const shapeId = node.key.slice(screen.id.length + 1);
                for (const variantId of Object.keys(node.variants ?? {})) {
                    const canvas = await canvasAfter(fixture(name)(), (document) => {
                        const shape = instanceOf(document, shapeId);
                        shape.variantId = variantId === shape.componentId ? undefined : variantId;
                        shape.variantMode = undefined;
                    });
                    const played = nodeMarks(node, screen, drawing.booleans, {
                        variants: { [node.variantKey!]: variantId }
                    });
                    expect(played, `${label(store, viewId, shapeId)} › ${variantId}`).toEqual(
                        canvas.get(viewId)!.get(shapeId)
                    );
                    compared += 1;
                }
                if (node.visibility) {
                    const { key, stateKey, when = true } = node.visibility;
                    const shown = nodeMarks(node, screen, drawing.booleans, {
                        visibility: { [stateKey ?? key]: stateKey ? when : true }
                    });
                    expect(shown, label(store, viewId, shapeId)).toEqual(
                        canvasProjection(store).get(viewId)!.get(shapeId)
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
