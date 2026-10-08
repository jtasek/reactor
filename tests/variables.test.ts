import { readClipboard } from 'src/app/clipboard';
import { readEntity } from 'src/app/services/documentStorage';
import { boundVariable, variableNamed } from 'src/app/variables';
import type { Variable } from 'src/app/types';
import {
    createCopies,
    edit,
    expectConsistent,
    settle,
    sharedContent,
    shownDocument
} from './support/collaboration';
import { createTestStore } from './support/store';

const rectangle = (x = 0) => ({
    type: 'rectangle' as const,
    position: { x, y: 0 },
    size: { width: 20, height: 10 }
});

type Store = ReturnType<typeof createTestStore>['store'];

function storeWithShapes(count = 1) {
    const { store } = createTestStore();

    for (let index = 0; index < count; index++) {
        store.actions.addShape(rectangle(index * 50));
    }

    const document = () => store.state.currentDocument;
    const shapes = () => document().shapesIds.map((id) => document().shapes[id]);

    return { store, document, shapes };
}

const create = (store: Store, name: string, type: Variable['type'], value: unknown) =>
    store.actions.createVariable({ name, type, value });

describe('variables', () => {
    it('are created with a unique valid name and a value of their type', () => {
        const { store, document } = storeWithShapes(0);
        const brand = create(store, 'brand/primary', 'color', '#3366ff');

        expect(brand).toBeDefined();
        expect(document().variables[brand!]).toMatchObject({
            name: 'brand/primary',
            type: 'color',
            values: { default: '#3366ff' }
        });
        expect(create(store, 'brand/primary', 'number', 4)).toBeUndefined();
        expect(create(store, ' padded', 'number', 4)).toBeUndefined();
        expect(create(store, 'a${b}', 'text', 'x')).toBeUndefined();
        expect(create(store, 'size', 'number', Infinity)).toBeUndefined();
        expect(create(store, 'shown', 'boolean', 'yes')).toBeUndefined();
        expect(create(store, 'tint', 'color', 'red')).toBeUndefined();
    });

    it('are listed by name and renamed only to a free valid name', () => {
        const { store, document } = storeWithShapes(0);
        const zeta = create(store, 'zeta', 'text', 'z')!;
        const alpha = create(store, 'alpha', 'text', 'a')!;

        expect(document().variablesIds).toEqual([alpha, zeta]);

        store.actions.renameVariable({ variableId: zeta, name: 'alpha' });
        store.actions.renameVariable({ variableId: zeta, name: '' });
        expect(document().variables[zeta].name).toBe('zeta');

        store.actions.renameVariable({ variableId: zeta, name: 'beta' });
        expect(document().variables[zeta].name).toBe('beta');
    });

    it('resolve a name shared after a merge to the lowest id', () => {
        const variable = (id: string): Variable => ({
            id,
            name: 'brand',
            type: 'color',
            values: { default: '#000000' }
        });

        expect(variableNamed({ b: variable('b'), a: variable('a') }, 'brand')?.id).toBe('a');
    });
});

describe('binding a property to a variable', () => {
    it('writes the value into the shapes and again whenever it changes', () => {
        const { store, shapes } = storeWithShapes(2);
        const brand = create(store, 'brand', 'color', '#3366ff')!;
        const shapeIds = shapes().map((shape) => shape.id);

        store.actions.bindProperty({ shapeIds, key: 'fill', variableId: brand });
        expect(shapes().map((shape) => shape.fill)).toEqual(['#3366ff', '#3366ff']);
        expect(shapes()[0].bindings).toEqual({ fill: brand });

        store.actions.setVariableValue({ variableId: brand, value: '#ff0000' });
        expect(shapes().map((shape) => shape.fill)).toEqual(['#ff0000', '#ff0000']);
    });

    it('writes a number as typed into the field, within its range', () => {
        const { store, shapes } = storeWithShapes();
        const half = create(store, 'half', 'number', 50)!;

        store.actions.bindProperty({
            shapeIds: [shapes()[0].id],
            key: 'opacity',
            variableId: half
        });
        expect(shapes()[0].opacity).toBe(0.5);

        store.actions.setVariableValue({ variableId: half, value: 250 });
        expect(shapes()[0].opacity).toBe(1);
        expect(shapes()[0].bindings).toEqual({ opacity: half });
    });

    it('takes only a variable of the property’s kind, on a shape it applies to', () => {
        const { store, shapes } = storeWithShapes();
        const label = create(store, 'label', 'text', 'Hello')!;
        const shapeIds = [shapes()[0].id];

        store.actions.bindProperty({ shapeIds, key: 'fill', variableId: label });
        store.actions.bindProperty({ shapeIds, key: 'text', variableId: label });
        store.actions.bindProperty({ shapeIds, key: 'width', variableId: label });
        expect(shapes()[0].bindings).toBeUndefined();

        store.actions.bindProperty({ shapeIds, key: 'name', variableId: label });
        expect(shapes()[0]).toMatchObject({ name: 'Hello', bindings: { name: label } });
    });

    it('ends when the property is set otherwise, as by a move or in the inspector', () => {
        const { store, shapes } = storeWithShapes(2);
        const left = create(store, 'left', 'number', 100)!;
        const brand = create(store, 'brand', 'color', '#3366ff')!;
        const [moved, edited] = shapes().map((shape) => shape.id);

        store.actions.bindProperty({ shapeIds: [moved], key: 'x', variableId: left });
        store.actions.bindProperty({ shapeIds: [edited], key: 'fill', variableId: brand });
        store.actions.updateShape({ id: moved, position: { x: 7, y: 0 } });
        store.actions.setShapesProperty({ shapeIds: [edited], key: 'fill', value: '#00ff00' });
        expect(shapes()[1].bindings).toBeUndefined();

        store.actions.setVariableValue({ variableId: left, value: 300 });
        store.actions.setVariableValue({ variableId: brand, value: '#000000' });
        expect(shapes()[0]).toMatchObject({ position: { x: 7, y: 0 } });
        expect(shapes()[0].bindings).toBeUndefined();
        expect(shapes()[1].fill).toBe('#00ff00');
    });

    it('holds through the noise of measuring the shape', () => {
        const { store, shapes, document } = storeWithShapes();
        const left = create(store, 'left', 'number', 100)!;
        const [id] = document().shapesIds;

        store.actions.bindProperty({ shapeIds: [id], key: 'x', variableId: left });
        store.actions.updateShape({ id, position: { x: 100.0000038, y: 0 } });

        expect(boundVariable(shapes()[0], 'x', document())?.id).toBe(left);
    });

    it('does not show a value the property refuses, and follows the next one', () => {
        const { store, shapes, document } = storeWithShapes();
        const label = create(store, 'label', 'text', 'Hello')!;
        const [id] = document().shapesIds;

        store.actions.bindProperty({ shapeIds: [id], key: 'name', variableId: label });
        store.actions.setVariableValue({ variableId: label, value: '' });
        expect(shapes()[0].name).toBe('Hello');
        expect(boundVariable(shapes()[0], 'name', document())).toBeUndefined();

        store.actions.setVariableValue({ variableId: label, value: 'World' });
        expect(shapes()[0].name).toBe('World');
        expect(boundVariable(shapes()[0], 'name', document())?.id).toBe(label);
    });

    it('keeps the value when unbound or when the variable is deleted', () => {
        const { store, shapes, document } = storeWithShapes(2);
        const brand = create(store, 'brand', 'color', '#3366ff')!;
        const [first, second] = shapes().map((shape) => shape.id);

        store.actions.bindProperty({ shapeIds: [first, second], key: 'fill', variableId: brand });
        store.actions.unbindProperty({ shapeIds: [first], key: 'fill' });
        store.actions.deleteVariable(brand);

        expect(document().variables).toEqual({});
        expect(shapes().map((shape) => [shape.fill, shape.bindings])).toEqual([
            ['#3366ff', undefined],
            ['#3366ff', undefined]
        ]);
    });
});

describe('saved variables and bindings', () => {
    it('are read back, and an invalid one is invalid', () => {
        const brand = { id: 'v', name: 'brand', type: 'color', values: { default: '#123456' } };

        expect(readEntity('variables', brand)).toEqual(brand);
        expect(() => readEntity('variables', { ...brand, values: { default: 'red' } })).toThrow();
        expect(() => readEntity('variables', { ...brand, name: 'a}' })).toThrow();
        expect(() => readEntity('variables', { ...brand, type: 'date' })).toThrow();
    });
});

describe('copying shapes bound to variables', () => {
    function copiedFrom(value = '#3366ff') {
        const { store, shapes } = storeWithShapes();
        const brand = create(store, 'brand', 'color', value)!;

        store.actions.bindProperty({ shapeIds: [shapes()[0].id], key: 'fill', variableId: brand });

        return { store, shapes, text: store.actions.copySelection()! };
    }

    it('adds the variables to a document that lacks them', () => {
        const { store, shapes, text } = copiedFrom();

        store.actions.newDocument();
        store.actions.pasteShapes(text);

        const [variable] = Object.values(store.state.currentDocument.variables);

        expect(variable).toMatchObject({ name: 'brand', values: { default: '#3366ff' } });
        expect(shapes()[0]).toMatchObject({ fill: '#3366ff', bindings: { fill: variable.id } });
    });

    it('uses a variable of the same name and type, with its value', () => {
        const { store, shapes, text } = copiedFrom();

        store.actions.newDocument();

        const brand = create(store, 'brand', 'color', '#000000')!;

        store.actions.pasteShapes(text);
        expect(Object.keys(store.state.currentDocument.variables)).toEqual([brand]);
        expect(shapes()[0]).toMatchObject({ fill: '#000000', bindings: { fill: brand } });
    });

    it('renames the copied variable when its name has another type', () => {
        const { store, shapes, text } = copiedFrom();

        store.actions.newDocument();
        create(store, 'brand', 'number', 3);
        store.actions.pasteShapes(text);

        const added = variableNamed(store.state.currentDocument.variables, 'brand 2');

        expect(added).toMatchObject({ type: 'color', values: { default: '#3366ff' } });
        expect(shapes()[0].bindings).toEqual({ fill: added!.id });
    });

    it('reads nothing when a shape follows a variable the text lacks', () => {
        const { text } = copiedFrom();
        const data = JSON.parse(text);

        expect(readClipboard(text).variables).toHaveLength(1);
        expect(readClipboard(JSON.stringify({ ...data, variables: [] })).shapes).toEqual([]);
    });
});

describe('variables shared between copies', () => {
    it('reach other copies with the values written into the shapes', async () => {
        const copies = await createCopies(2, (store) => store.actions.addShape(rectangle()));
        const [a, b] = copies;
        const [id] = shownDocument(a).shapesIds;
        let brand = '';

        edit(a, (actions) => {
            brand = actions.createVariable({ name: 'brand', type: 'color', value: '#3366ff' })!;
            actions.bindProperty({ shapeIds: [id], key: 'fill', variableId: brand });
        });
        settle(copies);
        edit(b, (actions) => actions.setVariableValue({ variableId: brand, value: '#ff0000' }));
        settle(copies);

        copies.forEach((copy) =>
            expect(shownDocument(copy).shapes[id]).toMatchObject({
                fill: '#ff0000',
                bindings: { fill: brand }
            })
        );
        expect(sharedContent(a)).toEqual(sharedContent(b));
    });

    it('leave a shape its value when another copy deletes the variable it is bound to', async () => {
        const copies = await createCopies(2, (store) => {
            store.actions.addShape(rectangle());
            store.actions.createVariable({ name: 'brand', type: 'color', value: '#3366ff' });
        });
        const [a, b] = copies;
        const [id] = shownDocument(a).shapesIds;
        const [brand] = Object.keys(shownDocument(a).variables);

        edit(a, (actions) => actions.deleteVariable(brand));
        edit(b, (actions) =>
            actions.bindProperty({ shapeIds: [id], key: 'fill', variableId: brand })
        );
        settle(copies);

        copies.forEach((copy) => {
            expect(shownDocument(copy).variables).toEqual({});
            expect(shownDocument(copy).shapes[id].fill).toBe('#3366ff');
            expectConsistent(copy);
        });
        expect(sharedContent(a)).toEqual(sharedContent(b));
    });
});
