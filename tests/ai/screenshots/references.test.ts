import { colorDistance } from './color';
import { documentContext } from 'src/ai/context';
import {
    screenshotReferences,
    reusedControls,
    repeatedScreenText,
    isolatedDocument,
    unboundPaletteColors
} from './references';

it('builds 30 repeatable cases without leaking target screens into model context', () => {
    const cases = screenshotReferences();
    expect(cases).toHaveLength(30);
    expect(new Set(cases.map(({ name }) => name)).size).toBe(30);
    expect(
        cases.map(({ variant }) => variant).filter((variant) => variant === 'original')
    ).toHaveLength(12);
    expect(
        cases.map(({ name, seed }) => [name, documentContext({ ...seed, selectedShapesIds: [] })])
    ).toEqual(
        screenshotReferences().map(({ name, seed }) => [
            name,
            documentContext({ ...seed, selectedShapesIds: [] })
        ])
    );
    cases.forEach(({ seed, target, viewId }) => {
        expect(seed.frames).toEqual({});
        expect(Object.keys(seed.components)).toHaveLength(2);
        expect(Object.values(seed.shapes).every((shape) => !shape.parentFrameId)).toBe(true);
        expect(target.frames[viewId].kind).toBe('view');
        expect(JSON.stringify(documentContext({ ...seed, selectedShapesIds: [] }))).not.toContain(
            'Sample prototype'
        );
    });
});

it('does not count one instance twice when labels repeat', () => {
    const reference = screenshotReferences()[0];
    const instances = Object.values(reference.target.shapes).filter(
        (shape) =>
            shape.type === 'instance' &&
            shape.parentFrameId === reference.target.frames[reference.viewId].screenId
    );
    const shape = instances[0];
    if (shape.type !== 'instance') {
        throw new Error('Expected a control');
    }
    const document = { ...reference.seed, shapes: { [shape.id]: shape } };
    const expected = reference.expectedControls[0];
    expect(reusedControls(document, [expected, expected])).toBe(1);
    const inputId = Object.keys(document.components).find(
        (id) => document.components[id].interaction?.role === 'input'
    )!;
    expect(
        reusedControls(
            { ...document, shapes: { [shape.id]: { ...shape, componentId: inputId } } },
            [expected]
        )
    ).toBe(0);
});

it('measures palette proximity in D65 Lab rather than RGB distance', () => {
    expect(colorDistance('#ffffff', '#ffffff')).toBe(0);
    expect(colorDistance('#000000', '#ffffff')).toBeCloseTo(100, 3);
    expect(colorDistance('#275de5', '#275de6')).toBeLessThan(2);
    expect(colorDistance('#275de5', '#7638ba')).toBeGreaterThan(2);
});

it('keeps the comparison baseline isolated from edits and detects unbound near-palette colors', () => {
    const seed = screenshotReferences()[0].seed;
    const copy = isolatedDocument(seed);
    const shape = Object.values(copy.shapes).find((shape) => shape.type === 'rectangle')!;
    if (shape.type !== 'rectangle') {
        throw new Error('Expected a rectangle');
    }
    shape.fill = '#275de6';
    shape.bindings = {};
    expect(seed.shapes[shape.id]).not.toEqual(shape);
    expect(unboundPaletteColors([shape], seed)).toContain(
        `${shape.id}.fill duplicates accent without a binding`
    );
    shape.bindings = { fill: 'accent', stroke: 'accent' };
    expect(unboundPaletteColors([shape], seed)).toEqual([]);
    copy.frames.extra = {
        id: 'extra',
        kind: 'screen',
        name: 'Extra',
        position: { x: 0, y: 0 },
        size: { width: 480, height: 640 },
        visible: true,
        locked: false
    };
    expect(seed.frames).toEqual({});
});

it('detects extra screen text without rejecting repetitions already present in the reference', () => {
    const reference = screenshotReferences()[0];
    const text = Object.values(reference.target.shapes).find(
        (shape) => shape.type === 'text' && shape.parentFrameId
    )!;
    const duplicate = { ...text, id: 'duplicate' };
    expect(repeatedScreenText([text, duplicate], [text])).toEqual([
        text.type === 'text' ? text.value.trim() : ''
    ]);
    expect(repeatedScreenText([text, duplicate], [text, duplicate])).toEqual([]);
    expect(repeatedScreenText([{ ...text, parentFrameId: undefined }], [text])).toEqual([]);
});
