import { previewFixture } from './preview';

export function dataListFixture() {
    const document = previewFixture();
    document.dataEntities.customers = { id: 'customers', name: 'Customers' };
    document.dataFields.name = {
        id: 'name',
        entityId: 'customers',
        name: 'Name',
        type: 'text',
        required: true
    };
    document.dataRecords.ada = {
        id: 'ada',
        entityId: 'customers',
        order: 0,
        values: { name: 'Ada' }
    };
    document.dataRecords.grace = {
        id: 'grace',
        entityId: 'customers',
        order: 1,
        values: { name: 'Grace' }
    };
    const next = document.shapes.next;
    if (next.type === 'instance') {
        next.position.y = 200;
    }
    const instance = document.shapes.name;
    if (instance.type !== 'instance') {
        throw new Error('Invalid fixture');
    }
    instance.dataList = { entityId: 'customers', fields: { label: 'name' }, gap: 8 };
    instance.interaction = {
        role: 'input',
        props: { label: 'label', value: 'label' },
        controlId: 'customer'
    };

    return { document, instance };
}

/** A bound list opens a detail input for the clicked customer. */
export function recordDetailFixture() {
    const { document, instance } = dataListFixture();
    instance.interaction = {
        role: 'button',
        props: { label: 'label' },
        navigateTo: 'details'
    };
    instance.interactions = { activate: { type: 'navigate', screenId: 'details' } };
    document.shapes.detail = {
        ...structuredClone(instance),
        id: 'detail',
        name: 'Customer details',
        interactions: { activate: null },
        order: 'a5',
        parentFrameId: 'details',
        position: { x: 424, y: 100 },
        dataList: { ...instance.dataList!, mode: 'record' },
        interaction: {
            role: 'input',
            props: { label: 'label', value: 'label' },
            controlId: 'customer-detail'
        }
    };
    document.shapesIds.push('detail');

    return { document, instance, detail: document.shapes.detail };
}
