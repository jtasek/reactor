import { responsiveVariantsDocument } from './support/responsiveVariants';
import type { InstanceShape } from 'src/app/types';
import { writeClipboard, readClipboard } from 'src/app/clipboard';
import { dataListFixture } from './support/dataList';
import { projectPreview } from 'src/preview/project';
import { readPreview, type PreviewNode } from 'src/preview/protocol';
import { readEntity, copyDocument } from 'src/app/services/documentStorage';
import { buildVariable } from 'src/app/variables';
import { createCopies, settle, DOCUMENT_ID, shownDocument } from './support/collaboration';
import { createTestStore } from './support/store';
import { librarySnapshot } from 'src/app/componentLibrary';
import { createComponent, createShape } from 'src/app/factories';

const nodes = (items: PreviewNode[]): PreviewNode[] =>
    items.flatMap((item) => [item, ...nodes(item.children ?? [])]);

it('renders ordered records with literal text and independent stable input identities without changing the document', () => {
    const { document } = dataListFixture();
    document.variables.secret = buildVariable('secret', 'Secret', 'text', 'must not expand')!;
    document.dataRecords.ada.values.name = '${Secret}';
    const before = JSON.stringify(document);
    const drawing = projectPreview(document, {});
    expect(() => readPreview({ ...drawing, images: {} })).not.toThrow();
    const inputs = nodes(drawing.screens[0].nodes).filter((node) => node.control?.role === 'input');
    expect(inputs.map((node) => node.control?.value)).toEqual(['${Secret}', 'Grace']);
    expect(new Set(inputs.map((node) => node.control?.stateKey)).size).toBe(2);
    expect(JSON.stringify(document)).toBe(before);
    const graceKey = inputs[1].control!.stateKey;
    delete document.dataRecords.ada;
    const after = nodes(projectPreview(document, {}).screens[0].nodes).find(
        (node) => node.control?.role === 'input'
    );
    expect(after?.control?.stateKey).toBe(graceKey);
});

it('remeasures wrapped record text and separates rows by measured height plus gap', () => {
    const { document } = dataListFixture();
    const text = document.shapes.field;
    if (text.type !== 'text') {
        throw new Error('Invalid fixture');
    }
    text.wrapWidth = 60;
    document.dataRecords.ada.values.name = 'A very long customer name on several lines';
    const list = projectPreview(document, {}).screens[0].nodes.find(
        (node) => node.control?.role === 'list'
    )!;
    const first = list.children![0].children![0];
    expect(first.control!.height).toBeGreaterThan(30);
    expect(list.children![1].attrs.transform).toBe(`translate(0 ${first.control!.height + 8})`);
});

it('preserves bindings through rename, clone and durable readers, diagnoses stale references and empty records', () => {
    const { document, instance } = dataListFixture();
    document.dataFields.name.name = 'Full name';
    expect(readEntity('shapes', instance)).toMatchObject({ dataList: instance.dataList });
    expect(copyDocument(document, 'copy').shapes.name).toMatchObject({
        dataList: instance.dataList
    });
    delete document.dataFields.name;
    expect(() => projectPreview(document, {})).toThrow('missing or incompatible');
    instance.dataList!.fields = {};
    document.dataRecords = {};
    expect(
        nodes(projectPreview(document, {}).screens[0].nodes).some(
            (node) => node.text === 'No records yet'
        )
    ).toBe(true);
    delete document.dataEntities.customers;
    expect(() => projectPreview(document, {})).toThrow('entity is unavailable');
    expect(() =>
        readEntity('shapes', { ...instance, dataList: { ...instance.dataList, gap: -1 } })
    ).toThrow();
});

it('validates list edits and rejects locked, read-only and stale document edits', () => {
    const { document, instance } = dataListFixture();
    const { store } = createTestStore();
    document.id = store.state.currentDocumentId;
    store.actions.addDocument(document);
    expect(
        store.actions.editData({
            kind: 'setList',
            documentId: document.id,
            instanceId: instance.id,
            list: instance.dataList!
        }).applied
    ).toBe(true);
    const update = () =>
        store.actions.editData({
            kind: 'setList',
            documentId: document.id,
            instanceId: instance.id,
            list: { ...instance.dataList!, fields: { missing: 'name' } }
        });
    expect(update().applied).toBe(false);
    store.actions.lockShape(instance.id);
    expect(
        store.actions.editData({
            kind: 'setList',
            documentId: document.id,
            instanceId: instance.id,
            list: null
        }).applied
    ).toBe(false);
    store.actions.unlockShape(instance.id);
    store.actions.setDocumentAccess({ [document.id]: { role: 'viewer' } });
    expect(
        store.actions.editData({
            kind: 'setList',
            documentId: document.id,
            instanceId: instance.id,
            list: null
        }).applied
    ).toBe(false);
    store.actions.setDocumentAccess({ [document.id]: { role: 'editor' } });
    expect(
        store.actions.editData({
            kind: 'setList',
            documentId: 'stale',
            instanceId: instance.id,
            list: null
        }).applied
    ).toBe(false);
});

it('shares a list binding and restores it in one undo step', async () => {
    const copies = await createCopies(2, (store) => {
        const { document } = dataListFixture();
        store.actions.addDocument({ ...document, id: DOCUMENT_ID });
    });
    const [a, b] = copies;
    expect(
        a.store.actions.editData({
            kind: 'setList',
            documentId: DOCUMENT_ID,
            instanceId: 'name',
            list: null
        }).applied
    ).toBe(true);
    settle(copies);
    expect(shownDocument(b).shapes.name).not.toHaveProperty('dataList');
    a.collaboration.undo(DOCUMENT_ID);
    settle(copies);
    expect(shownDocument(b).shapes.name).toHaveProperty('dataList.fields.label', 'name');
    copies.forEach((copy) => copy.collaboration.dispose());
});

it('strips document-local data bindings from portable library snapshots', () => {
    const { document } = dataListFixture();
    document.components.card = createComponent({ id: 'card', name: 'Card', shapesIds: ['name'] });
    const snapshot = librarySnapshot(document, 'card', { components: {} })!;
    const card = snapshot.find((component) => component.id === 'card')!;
    expect(card.sourceShapes!.name).not.toHaveProperty('dataList');
});

it('keeps responsive and explicit variants and inherited modes for repeated item artwork', () => {
    const document = responsiveVariantsDocument();
    const data = dataListFixture().document;
    document.dataEntities = data.dataEntities;
    document.dataFields = data.dataFields;
    document.dataRecords = data.dataRecords;
    const instance = document.shapes.button as InstanceShape;
    instance.dataList = { entityId: 'customers', fields: { label: 'name' }, gap: 8 };
    document.shapes['base-text'].fontColor = '#112233';
    document.shapes['wide-text'].fontColor = '#112233';
    document.shapes['base-text'].bindings = { fontColor: 'ink' };
    document.shapes['wide-text'].bindings = { fontColor: 'ink' };
    for (const [width, font] of [
        [360, 16],
        [800, 32]
    ]) {
        const output = projectPreview(document, { theme: 'dark' }, [], {
            modes: { theme: 'dark' },
            screenId: 'screen',
            viewport: { width, height: 480 }
        });
        const text = nodes(output.screens[0].nodes).filter((node) => node.tag === 'text');
        expect(text.map((node) => node.text)).toEqual(['Ada', 'Grace']);
        expect(text.map((node) => node.attrs['font-size'])).toEqual([font, font]);
        expect(text.map((node) => node.attrs.fill)).toEqual(['#ddeeff', '#ddeeff']);
    }
    instance.variantId = 'wide';
    const output = projectPreview(document, {}, [], {
        modes: {},
        screenId: 'screen',
        viewport: { width: 360, height: 480 }
    });
    expect(
        nodes(output.screens[0].nodes)
            .filter((node) => node.tag === 'text')
            .map((node) => node.attrs['font-size'])
    ).toEqual([32, 32]);
});

it('diagnoses a mapped property missing from the selected variant rather than showing template text', () => {
    const document = responsiveVariantsDocument();
    const data = dataListFixture().document;
    document.dataEntities = data.dataEntities;
    document.dataFields = data.dataFields;
    document.dataRecords = data.dataRecords;
    const instance = document.shapes.button as InstanceShape;
    instance.dataList = { entityId: 'customers', fields: { label: 'name' }, gap: 8 };
    document.components.wide.props = [];
    expect(() =>
        projectPreview(document, {}, [], {
            modes: {},
            screenId: 'screen',
            viewport: { width: 800, height: 480 }
        })
    ).toThrow('incompatible with the item property');
});

it('keeps document-local list bindings through copying and cloning the template instance', () => {
    const { document, instance } = dataListFixture();
    expect(
        readClipboard(writeClipboard([instance], [], document.variables, document)).shapes[0]
    ).toMatchObject({ dataList: instance.dataList });
    const { store } = createTestStore();
    store.actions.addDocument({ ...document, id: store.state.currentDocumentId });
    store.actions.cloneShapes([instance.id]);
    const current = store.state.currentDocument;
    expect(current.shapes[current.shapesIds.at(-1)!]).toMatchObject({
        dataList: instance.dataList
    });
});

it('diagnoses a mapped property whose source no longer supports that property', () => {
    const { document } = dataListFixture();
    document.shapes.field = createShape({
        type: 'rectangle',
        id: 'field',
        name: 'Replacement',
        order: 'a0',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 30 }
    });
    expect(() => projectPreview(document, {})).toThrow('missing or incompatible field or property');
});
