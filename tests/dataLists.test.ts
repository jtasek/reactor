import { responsiveVariantsDocument } from './support/responsiveVariants';
import type { InstanceShape } from 'src/app/types';
import { writeClipboard, readClipboard } from 'src/app/clipboard';
import { dataListFixture } from './support/dataList';
import { projectPreview, type PreviewDiagnostic } from 'src/preview/project';
import { readPreview, type PreviewNode } from 'src/preview/protocol';
import { listsUsing } from 'src/app/dataLists';
import { readEntity, copyDocument } from 'src/app/services/documentStorage';
import { buildVariable } from 'src/app/variables';
import { createCopies, settle, DOCUMENT_ID, shownDocument } from './support/collaboration';
import { createTestStore } from './support/store';
import { librarySnapshot } from 'src/app/componentLibrary';
import { createComponent, createShape } from 'src/app/factories';

const nodes = (items: PreviewNode[]): PreviewNode[] =>
    items.flatMap((item) => [
        item,
        ...nodes([...(item.children ?? []), ...Object.values(item.records ?? {})])
    ]);

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
    const warnings: string[] = [];
    const stale = projectPreview(document, {}, warnings);
    expect(warnings.filter((warning) => warning.includes('missing or incompatible'))).toHaveLength(
        1
    );
    expect(
        nodes(stale.screens[0].nodes)
            .filter((node) => node.control?.role === 'input')
            .map((node) => node.control?.value)
    ).toEqual(['Your name', 'Your name']);
    instance.dataList!.fields = {};
    document.dataRecords = {};
    expect(
        nodes(projectPreview(document, {}).screens[0].nodes).some(
            (node) => node.text === 'No records yet'
        )
    ).toBe(true);
    delete document.dataEntities.customers;
    const entityWarnings: string[] = [];
    const single = projectPreview(document, {}, entityWarnings);
    expect(entityWarnings.some((warning) => warning.includes('entity is unavailable'))).toBe(true);
    expect(nodes(single.screens[0].nodes).some((node) => node.control?.role === 'list')).toBe(
        false
    );
    expect(
        nodes(single.screens[0].nodes).filter((node) => node.control?.role === 'input')
    ).toHaveLength(1);
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

it.each([undefined, 'record'] as const)(
    'keeps responsive and explicit variants and inherited modes for data artwork (%s)',
    (mode) => {
        const document = responsiveVariantsDocument();
        const data = dataListFixture().document;
        document.dataEntities = data.dataEntities;
        document.dataFields = data.dataFields;
        document.dataRecords = data.dataRecords;
        const instance = document.shapes.button as InstanceShape;
        instance.dataList = { entityId: 'customers', fields: { label: 'name' }, gap: 8, mode };
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
            const text = nodes(output.screens[0].nodes).filter(
                (node) => node.tag === 'text' && !node.key.includes('/unselected/')
            );
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
                .filter((node) => node.tag === 'text' && !node.key.includes('/unselected/'))
                .map((node) => node.attrs['font-size'])
        ).toEqual([32, 32]);
    }
);

it('warns about a mapped property missing from the selected variant', () => {
    const document = responsiveVariantsDocument();
    const data = dataListFixture().document;
    document.dataEntities = data.dataEntities;
    document.dataFields = data.dataFields;
    document.dataRecords = data.dataRecords;
    const instance = document.shapes.button as InstanceShape;
    instance.dataList = { entityId: 'customers', fields: { label: 'name' }, gap: 8 };
    document.components.wide.props = [];
    const warnings: string[] = [];
    projectPreview(document, {}, warnings, {
        modes: {},
        screenId: 'screen',
        viewport: { width: 800, height: 480 }
    });
    expect(warnings.some((warning) => warning.includes('missing or incompatible'))).toBe(true);
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
    const diagnostics: PreviewDiagnostic[] = [];
    // The template's own broken property stops Preview as for any instance; the list's
    // mapping is reported too.
    expect(() => projectPreview(document, {}, [], undefined, undefined, diagnostics)).toThrow(
        'Label has an incompatible value'
    );
    expect(diagnostics.some((item) => item.message.includes('missing or incompatible field'))).toBe(
        true
    );
});

it('shows the template value with a warning for a blank, invalid or retyped record instead of stopping Prototype', () => {
    const { document } = dataListFixture();
    // Data View's Add record starts with no values.
    document.dataRecords.blank = { id: 'blank', entityId: 'customers', order: 2, values: {} };
    document.dataRecords.spaces = {
        id: 'spaces',
        entityId: 'customers',
        order: 3,
        values: { name: '  ' }
    };
    document.dataRecords.number = {
        id: 'number',
        entityId: 'customers',
        order: 4,
        values: { name: 42 }
    };
    const warnings: string[] = [];
    const drawing = projectPreview(document, {}, warnings);
    expect(
        nodes(drawing.screens[0].nodes)
            .filter((node) => node.control?.role === 'input')
            .map((node) => node.control?.value)
    ).toEqual(['Ada', 'Grace', 'Your name', 'Your name', 'Your name']);
    expect(warnings).toEqual(
        expect.arrayContaining([
            expect.stringContaining('Row 3: Name is required.'),
            expect.stringContaining('Row 4: Name is required.'),
            expect.stringContaining('Row 5: Name must be text.')
        ])
    );
});

it('keeps Prototype running after Data View deletes a mapped field or the entity, and counts the lists it affects', () => {
    const { document } = dataListFixture();
    const { store } = createTestStore();
    document.id = store.state.currentDocumentId;
    store.actions.addDocument(document);
    expect(listsUsing(store.state.currentDocument, { fieldId: 'name' })).toBe(1);
    expect(listsUsing(store.state.currentDocument, { entityId: 'customers' })).toBe(1);
    expect(listsUsing(store.state.currentDocument, { fieldId: 'other' })).toBe(0);
    expect(
        store.actions.editData({ kind: 'deleteField', documentId: document.id, id: 'name' }).applied
    ).toBe(true);
    expect(() => projectPreview(store.state.currentDocument, {})).not.toThrow();
    expect(
        store.actions.editData({ kind: 'deleteEntity', documentId: document.id, id: 'customers' })
            .applied
    ).toBe(true);
    expect(() => projectPreview(store.state.currentDocument, {})).not.toThrow();
});
