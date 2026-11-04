import { selectionOperations } from 'src/ui/components/CommandLine/selection';
import { editorForInput, editorInput } from 'src/ui/components/CommandLine/parameters';
import { createTestStore } from './support/store';

function setup(type: 'rectangle' | 'text' = 'rectangle') {
    const { store } = createTestStore();
    store.actions.addShape(
        type === 'rectangle'
            ? { type, position: { x: 10, y: 20 }, size: { width: 80, height: 40 }, fill: '#112233' }
            : { type, position: { x: 10, y: 20 }, value: 'Original', fontSize: 16 }
    );
    const id = store.state.currentDocument.shapesIds.at(-1)!;
    store.actions.selectShape(id);
    const run = (input: string) =>
        store.actions.applyOperations({
            documentId: store.state.currentDocumentId,
            by: { kind: 'person' },
            operations: selectionOperations(input, store.state)
        });
    const variable = (name: string, type: 'color' | 'number' | 'text', value: string | number) => {
        store.actions.createVariable({ name, type, value });

        return Object.keys(store.state.currentDocument.variables).at(-1)!;
    };

    return { store, id, run, variable, shape: () => store.state.currentDocument.shapes[id] };
}

it('edits literal colors and detaches only the edited binding', () => {
    const { run, variable, shape } = setup();
    const fill = variable('brand/primary', 'color', '#3366ff');
    const width = variable('width', 'number', 120);
    expect(run('bind property=fill variable="brand/primary"').applied).toBe(true);
    expect(run(`bind property=w variable="${width}"`).applied).toBe(true);
    expect(shape()).toMatchObject({ fill: '#3366ff', bindings: { fill, width } });
    expect(run('fill=#abcdef stroke=#123456').applied).toBe(true);
    expect(shape()).toMatchObject({ fill: '#abcdef', stroke: '#123456', bindings: { width } });
    expect(shape().bindings?.fill).toBeUndefined();
});

it('removes one size binding without detaching the other or losing its held value', () => {
    const { run, variable, shape } = setup();
    variable('width', 'number', 120);
    const height = variable('height', 'number', 60);
    run('bind property=w variable=width');
    run('bind property=h variable=height');
    expect(run('unbind property=w').applied).toBe(true);
    expect(shape()).toMatchObject({ size: { width: 120, height: 60 }, bindings: { height } });
    expect(shape().bindings?.width).toBeUndefined();
});

it('edits text and font styling and removes its old text binding', () => {
    const { run, variable, shape } = setup('text');
    variable('label', 'text', 'Bound');
    expect(run('bind property=text variable=label').applied).toBe(true);
    expect(run('text="Continue shopping" fs=18 fc=#123456').applied).toBe(true);
    expect(shape()).toMatchObject({
        value: 'Continue shopping',
        fontSize: 18,
        fontColor: '#123456'
    });
    expect(shape().bindings?.text).toBeUndefined();
    const editor = editorForInput('text="Continue shopping" fs=18')!;
    expect(editor.creation).toBe(false);
    expect(editorInput(editor)).toBe('value="Continue shopping" fontSize=18');
});

it.each([
    'fill=red',
    'fill=#abc',
    'text=" "',
    'bind property=fill variable=missing',
    'unbind property=invalid'
])('rejects %s atomically', (input) => {
    const { run, shape } = setup();
    const before = JSON.stringify(shape());
    expect(() => run(input)).toThrow();
    expect(JSON.stringify(shape())).toBe(before);
});

it('rejects incompatible variables and locked selections', () => {
    const { run, variable, store, id } = setup();
    variable('number', 'number', 12);
    expect(() => run('bind property=fill variable=number')).toThrow(/compatible/);
    store.actions.lockShape(id);
    expect(() => run('fill=#abcdef')).toThrow(/editable/);
});

it('validates mixed selections before changing any shape', () => {
    const { store, run, shape } = setup('text');
    store.actions.addShape({
        type: 'rectangle',
        position: { x: 0, y: 0 },
        size: { width: 10, height: 10 }
    });
    store.actions.selectShape(store.state.currentDocument.shapesIds.at(-1)!);
    expect(() => run('text="Changed"')).toThrow(/cannot be edited/);
    expect(shape()).toMatchObject({ value: 'Original' });
});

it('does not remove a text template when removing an absent property binding', () => {
    const { store, id, variable, run, shape } = setup('text');
    const person = variable('Person', 'text', 'Ada');
    store.actions.setShapesProperty({ shapeIds: [id], key: 'text', value: 'Hi ${Person}' });
    const before = JSON.stringify(shape());
    expect(run('unbind property=text').applied).toBe(true);
    expect(JSON.stringify(shape())).toBe(before);
    store.actions.setVariableValue({ variableId: person, value: 'Grace' });
    expect(shape()).toMatchObject({ value: 'Hi Grace' });
});

it('typed text follows variables like the Inspector, and plain text clears a template', () => {
    const { variable, run, shape, store } = setup('text');
    const person = variable('Person', 'text', 'Ada');
    expect(run('text="Hi ${Person}"').applied).toBe(true);
    expect(shape()).toMatchObject({ value: 'Hi Ada' });
    expect((shape() as { template?: string }).template).toContain(person);
    store.actions.setVariableValue({ variableId: person, value: 'Grace' });
    expect(shape()).toMatchObject({ value: 'Hi Grace' });
    expect(run('text="Plain \\\\${Person}"').applied).toBe(true);
    expect(shape()).toMatchObject({ value: 'Plain ${Person}' });
    expect(run('text="Plain"').applied).toBe(true);
    expect(shape()).toMatchObject({ value: 'Plain' });
    expect((shape() as { template?: string }).template).toBeUndefined();
});

it('rejects typed text whose variables resolve to blank', () => {
    const { variable, run, shape } = setup('text');
    variable('Empty', 'text', ' ');
    const before = JSON.stringify(shape());
    expect(() => run('text="${Empty}"')).toThrow(/blank/);
    expect(JSON.stringify(shape())).toBe(before);
});
