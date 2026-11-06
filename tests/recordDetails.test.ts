import { recordDetailFixture } from './support/dataList';
import { projectPreview } from 'src/preview/project';
import { readPreview, type PreviewNode } from 'src/preview/protocol';
import { readEntity, copyDocument } from 'src/app/services/documentStorage';
import { writeClipboard, readClipboard } from 'src/app/clipboard';
import { createCopies, settle, DOCUMENT_ID, shownDocument } from './support/collaboration';
import { createTestStore } from './support/store';

const nodes = (items: PreviewNode[]): PreviewNode[] =>
    items.flatMap((item) => [
        item,
        ...nodes(item.children ?? []),
        ...nodes(Object.values(item.records ?? {}))
    ]);

it('carries stable record identities to navigation and projects detail values without mutating records', () => {
    const { document } = recordDetailFixture();
    const before = JSON.stringify(document);
    const drawing = projectPreview(document, {});
    const app = readPreview({ ...drawing, images: {} });
    const home = app.screens.find((screen) => screen.id === 'home')!;
    const actions = nodes(home.nodes).filter((node) => node.control?.record);
    expect(actions.map((node) => node.control)).toEqual([
        expect.objectContaining({
            label: 'Ada',
            navigateTo: 'details',
            record: { entityId: 'customers', id: 'ada' }
        }),
        expect.objectContaining({
            label: 'Grace',
            navigateTo: 'details',
            record: { entityId: 'customers', id: 'grace' }
        })
    ]);
    const detail = app.screens
        .find((screen) => screen.id === 'details')!
        .nodes.find((node) => node.recordEntity)!;
    expect(detail.records!.ada.control?.value).toBe('Ada');
    expect(detail.records!.grace.control?.value).toBe('Grace');
    expect(detail.children![0].control?.value).toBe('Your name');
    expect(detail.records!.ada.control?.stateKey).not.toBe(detail.records!.grace.control?.stateKey);
    expect(JSON.stringify(document)).toBe(before);
});

it('retains record mode through readers, copying and cloning, and rejects unknown binding modes', () => {
    const { document, detail } = recordDetailFixture();
    expect(readEntity('shapes', detail)).toMatchObject({ dataList: detail.dataList });
    expect(copyDocument(document, 'copy').shapes.detail).toMatchObject({
        dataList: detail.dataList
    });
    expect(
        readClipboard(writeClipboard([detail], [], document.variables, document)).shapes[0]
    ).toMatchObject({ dataList: detail.dataList });
    expect(() =>
        readEntity('shapes', { ...detail, dataList: { ...detail.dataList, mode: 'unknown' } })
    ).toThrow('Invalid data binding mode');
    const { store } = createTestStore();
    store.actions.addDocument({ ...document, id: store.state.currentDocumentId });
    store.actions.cloneShapes([detail.id]);
    const current = store.state.currentDocument;
    expect(current.shapes[current.shapesIds.at(-1)!]).toMatchObject({ dataList: detail.dataList });
});

it('preserves compatible detail input identity when its instance changes between layouts', () => {
    const { document, detail } = recordDetailFixture();
    const keys = () => {
        const binding = projectPreview(document, {})
            .screens.find((screen) => screen.id === 'details')!
            .nodes.find((node) => node.records)!;

        return Object.values(binding.records!).map((node) => node.control?.stateKey);
    };
    const before = keys();
    delete document.shapes.detail;
    document.shapes.replacement = { ...detail, id: 'replacement' };
    document.shapesIds = document.shapesIds.map((id) => (id === 'detail' ? 'replacement' : id));
    expect(keys()).toEqual(before);
    document.shapes.replacement.interaction!.controlId = 'different';
    expect(keys()).not.toEqual(before);
    document.shapes.replacement.interaction!.controlId = 'customer-detail';
    document.dataFields.nickname = {
        ...document.dataFields.name,
        id: 'nickname',
        name: 'Nickname'
    };
    document.dataRecords.ada.values.nickname = 'A';
    document.dataRecords.grace.values.nickname = 'G';
    document.shapes.replacement.dataList!.fields.label = 'nickname';
    expect(keys()).not.toEqual(before);
});

it('falls back for missing entities, stale fields and invalid values, and removes deleted record artwork', () => {
    const { document } = recordDetailFixture();
    document.dataRecords.ada.values.name = 123;
    delete document.dataRecords.grace;
    const warnings: string[] = [];
    const drawing = projectPreview(document, {}, warnings);
    const detail = drawing.screens
        .find((screen) => screen.id === 'details')!
        .nodes.find((node) => node.records)!;
    expect(Object.keys(detail.records!)).toEqual(['ada']);
    expect(detail.records!.ada.control?.value).toBe('Your name');
    expect(warnings.some((warning) => warning.includes('Name must be text'))).toBe(true);
    delete document.dataFields.name;
    expect(() => readPreview({ ...projectPreview(document, {}), images: {} })).not.toThrow();
    delete document.dataEntities.customers;
    expect(
        nodes(projectPreview(document, {}).screens.flatMap((screen) => screen.nodes)).some(
            (node) => node.records
        )
    ).toBe(false);
});

it('validates record payloads inside the sandbox', () => {
    const { document } = recordDetailFixture();
    const drawing = projectPreview(document, {});
    const detail = drawing.screens
        .find((screen) => screen.id === 'details')!
        .nodes.find((node) => node.records)!;
    detail.records!.ada.control!.record = { entityId: 'customers', id: 'ada' };
    expect(() => readPreview(drawing)).toThrow('Invalid navigation record');
    delete detail.records!.ada.control!.record;
    delete detail.recordEntity;
    expect(() => readPreview(drawing)).toThrow('Invalid record binding entity');
    detail.recordEntity = 'customers';
    detail.records!.ada.attrs.onclick = 'alert(1)';
    expect(() => readPreview(drawing)).toThrow('Invalid preview drawing attributes');
});

it('shares binding mode changes and undoes them as one step', async () => {
    const copies = await createCopies(2, (store) => {
        const { document } = recordDetailFixture();
        store.actions.addDocument({ ...document, id: DOCUMENT_ID });
    });
    const [a, b] = copies;
    expect(
        a.store.actions.editData({
            kind: 'setList',
            documentId: DOCUMENT_ID,
            instanceId: 'detail',
            list: { entityId: 'customers', fields: { label: 'name' }, gap: 8 }
        }).applied
    ).toBe(true);
    settle(copies);
    expect(shownDocument(b).shapes.detail).not.toHaveProperty('dataList.mode');
    a.collaboration.undo(DOCUMENT_ID);
    settle(copies);
    expect(shownDocument(b).shapes.detail).toHaveProperty('dataList.mode', 'record');
    copies.forEach((copy) => copy.collaboration.dispose());
});
