import { SHAPE_PROPERTIES } from 'src/app/properties';
import { buildVariable, renderTemplate, templateProblems, variableNamed } from 'src/app/variables';
import type { Text, Variable } from 'src/app/types';
import { createCopies, edit, settle, shownDocument } from './support/collaboration';
import { createTestStore } from './support/store';

const textProperty = SHAPE_PROPERTIES.find((property) => property.key === 'text')!;

const variable = (id: string, name: string, type: Variable['type'], value: unknown) =>
    buildVariable(id, name, type, value)!;

const variables = Object.fromEntries(
    [
        variable('f', 'first name', 'text', 'Ada'),
        variable('l', 'last name', 'text', 'Lovelace'),
        variable('full', 'full name', 'text', '${f} ${l}'),
        variable('n', 'count', 'number', 3),
        variable('b', 'shown', 'boolean', true),
        variable('loop', 'loop', 'text', 'again ${loop}')
    ].map((item) => [item.id, item])
);

describe('templates', () => {
    it('show variables by id or name, a text variable’s own template made too', () => {
        expect(renderTemplate('${full} has ${count} notes: ${b}', variables)).toBe(
            'Ada Lovelace has 3 notes: true'
        );
        expect(renderTemplate('${first name}', variables)).toBe('Ada');
    });

    it('keep `\\${` and names of no variable as written, and stop at a loop', () => {
        expect(renderTemplate('\\${f} ${nobody}', variables)).toBe('${f} ${nobody}');
        expect(renderTemplate('${loop}', variables)).toBe('again ${loop}');
        expect(templateProblems('${nobody} ${loop} ${f}', variables)).toEqual(['nobody', 'loop']);
    });
});

function storeWithText() {
    const { store } = createTestStore();

    store.actions.addShape({ type: 'text', position: { x: 0, y: 20 }, value: 'Hello' });

    const document = () => store.state.currentDocument;
    const text = () => document().shapes[document().shapesIds[0]] as Text;
    const type = (value: string) =>
        store.actions.setShapesProperty({ shapeIds: [text().id], key: 'text', value });
    const create = (name: string, value: string) =>
        store.actions.createVariable({ name, type: 'text', value })!;

    return { store, document, text, type, create };
}

describe('a text with a template', () => {
    it('shows what its template makes, and the template with names in the inspector', () => {
        const { store, document, text, type, create } = storeWithText();
        const first = create('first name', 'Ada');

        create('last name', 'Lovelace');
        store.actions.createVariable({
            name: 'full name',
            type: 'text',
            value: '${first name} ${last name}'
        });
        type('Hi ${full name}!');

        expect(text().value).toBe('Hi Ada Lovelace!');
        expect(textProperty.read(text(), document())).toBe('Hi ${full name}!');

        store.actions.setVariableValue({ variableId: first, value: 'Grace' });
        expect(text().value).toBe('Hi Grace Lovelace!');
    });

    it('keeps its text when a variable it names is renamed', () => {
        const { store, document, text, type, create } = storeWithText();
        const first = create('first name', 'Ada');

        type('Hi ${first name}');
        store.actions.renameVariable({ variableId: first, name: 'given name' });

        expect(text().value).toBe('Hi Ada');
        expect(textProperty.read(text(), document())).toBe('Hi ${given name}');
    });

    it('shows a variable it names once the variable is created', () => {
        const { document, text, type, create } = storeWithText();

        type('Hi ${nobody}');
        expect(text().value).toBe('Hi ${nobody}');

        const nobody = create('nobody', 'there');

        expect(text().value).toBe('Hi there');
        expect(document().variables[nobody].name).toBe('nobody');
    });

    it('keeps plain text, `${` included, without a template', () => {
        const { document, text, type } = storeWithText();

        type('costs \\${5}');
        expect(text()).toMatchObject({ value: 'costs ${5}', template: 'costs \\${5}' });
        expect(textProperty.read(text(), document())).toBe('costs \\${5}');

        type('plain');
        expect(text().template).toBeUndefined();
    });

    it('drops its template once its text is set otherwise', () => {
        const { store, text, type, create } = storeWithText();
        const first = create('first name', 'Ada');

        type('Hi ${first name}');
        store.actions.updateShape({ id: text().id, value: 'Typed over' });
        store.actions.setVariableValue({ variableId: first, value: 'Grace' });

        expect(text().value).toBe('Typed over');
        expect(text().template).toBeUndefined();
    });

    it('looks the same once a variable it holds is deleted', () => {
        const { store, document, text, type, create } = storeWithText();
        const first = create('first name', 'Ada');

        store.actions.createVariable({ name: 'greeting', type: 'text', value: 'Hi ${first name}' });
        type('${greeting}!');
        store.actions.deleteVariable(first);

        expect(text().value).toBe('Hi Ada!');
        expect(variableNamed(document().variables, 'greeting')?.values.default).toBe('Hi Ada');

        store.actions.setVariableValue({
            variableId: variableNamed(document().variables, 'greeting')!.id,
            value: 'Hello'
        });
        expect(text().value).toBe('Hello!');
    });

    it('takes a bound text variable’s text as its template makes it', () => {
        const { store, text, create } = storeWithText();

        create('first name', 'Ada');
        store.actions.createVariable({ name: 'greeting', type: 'text', value: 'Hi ${first name}' });

        const greeting = variableNamed(store.state.currentDocument.variables, 'greeting')!;

        store.actions.bindProperty({ shapeIds: [text().id], key: 'text', variableId: greeting.id });
        expect(text().value).toBe('Hi Ada');
    });

    it('is pasted into another document with the variables it holds, nested ones too', () => {
        const { store, text, type, create } = storeWithText();

        create('first name', 'Ada');
        store.actions.createVariable({ name: 'greeting', type: 'text', value: 'Hi ${first name}' });
        type('${greeting}!');

        const copied = store.actions.copySelection()!;

        store.actions.newDocument();
        store.actions.pasteShapes(copied);

        const { variables } = store.state.currentDocument;

        expect(
            Object.values(variables)
                .map((item) => item.name)
                .sort()
        ).toEqual(['first name', 'greeting']);
        expect(text().value).toBe('Hi Ada!');

        store.actions.setVariableValue({
            variableId: variableNamed(variables, 'first name')!.id,
            value: 'Grace'
        });
        expect(text().value).toBe('Hi Grace!');
    });
});

describe('templates shared between copies', () => {
    it('keep showing a variable another copy renames at the same time', async () => {
        const copies = await createCopies(2, (store) => {
            store.actions.addShape({ type: 'text', position: { x: 0, y: 20 }, value: 'Hello' });
            store.actions.createVariable({ name: 'first name', type: 'text', value: 'Ada' });
        });
        const [a, b] = copies;
        const [id] = shownDocument(a).shapesIds;
        const [first] = Object.keys(shownDocument(a).variables);

        edit(a, (actions) =>
            actions.setShapesProperty({ shapeIds: [id], key: 'text', value: 'Hi ${first name}' })
        );
        edit(b, (actions) => actions.renameVariable({ variableId: first, name: 'given name' }));
        settle(copies);

        copies.forEach((copy) => {
            const document = shownDocument(copy);

            expect(document.shapes[id]).toMatchObject({ value: 'Hi Ada' });
            expect(textProperty.read(document.shapes[id], document)).toBe('Hi ${given name}');
        });
    });
});
