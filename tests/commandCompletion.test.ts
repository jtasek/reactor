import { completeParameters } from 'src/ui/components/CommandLine/completion';

const properties = [
    { key: 'fill', label: 'Fill', kind: 'color' },
    { key: 'width', label: 'Width', kind: 'number' },
    { key: 'text', label: 'Text', kind: 'text' }
];
const variables = [
    { id: 'brand-id', name: 'Brand Primary', type: 'color' },
    { id: 'size-id', name: 'Brand Size', type: 'number' }
];
const complete = (input: string) => completeParameters(input, properties, variables);

it('completes properties without replacing previous parameters or duplicating aliases', () => {
    expect(complete('fi')[0].input).toBe('fill=');
    expect(complete('w=120 fi')[0].input).toBe('w=120 fill=');
    expect(complete('w=120 ')).not.toContainEqual(expect.objectContaining({ name: 'width' }));
    expect(completeParameters('fi', [], variables)).toEqual([]);
});

it('completes binding properties and compatible variable names to stable quoted IDs', () => {
    expect(complete('bind prop')[0].input).toBe('bind property=');
    expect(complete('bind property=fi')[0].input).toBe('bind property=fill');
    expect(complete('bind property=fill variable="Brand P')[0].input).toBe(
        'bind property=fill variable="brand-id"'
    );
    expect(complete('bind property=w variable=Brand')).toHaveLength(1);
    expect(complete('bind property=w variable=Brand')[0].name).toBe('Brand Size');
    expect(complete('unbind variable=')).toEqual([]);
});

it('does not complete literal values or text inside quotes', () => {
    expect(complete('text="some fi')).toEqual([]);
    expect(complete('fill=#ff')).toEqual([]);
    expect(complete('text="emoji 😀 and spaces" fi')[0].input).toBe(
        'text="emoji 😀 and spaces" fill='
    );
    expect(complete('text="escaped \\" quote" fi')[0].input).toBe('text="escaped \\" quote" fill=');
});

it('preserves creation syntax and caps variable results', () => {
    expect(complete('rectangle')).toEqual([]);
    expect(complete('rectangle wi')[0].input).toBe('rectangle width=');
    expect(complete('rectangle w=20 h')).toContainEqual(
        expect.objectContaining({ input: 'rectangle w=20 height=' })
    );
    expect(
        completeParameters(
            'bind property=fill variable=',
            properties,
            Array.from({ length: 20 }, (_, i) => ({
                id: `id-${i}`,
                name: `Color ${i}`,
                type: 'color'
            }))
        )
    ).toHaveLength(8);
});

it('offers literal view dimensions and circle radius independently of bindable properties', () => {
    expect(completeParameters('wi', [], [], ['width', 'height'])[0].input).toBe('width=');
    expect(completeParameters('ra', [], [], ['radius'])[0].input).toBe('radius=');
    expect(complete('move x=10 y')[0].input).toBe('move x=10 y=');
});

it('matches JSON-escaped variable names without rewriting preceding arguments', () => {
    const input = 'bind property=fill variable="Brand \\"Main\\"';
    const result = completeParameters(input, properties, [
        { id: 'quoted-brand', name: 'Brand "Main"', type: 'color' }
    ]);
    expect(result[0]?.input).toBe('bind property=fill variable="quoted-brand"');
});

it('suggests only parameters that creation accepts', () => {
    expect(complete('rectangle w=20 ')).not.toContainEqual(
        expect.objectContaining({ name: 'radius' })
    );
    expect(complete('circle ra')[0].input).toBe('circle radius=');
});

it('suggests only variables the selection can bind and only bound properties to unbind', () => {
    const known = [
        { id: 'ok', name: 'Size OK', type: 'number', bindsTo: ['width'] },
        { id: 'negative', name: 'Size negative', type: 'number', bindsTo: [] }
    ];
    expect(
        completeParameters('bind property=width variable=Size', properties, known).map(
            ({ name }) => name
        )
    ).toEqual(['Size OK']);
    const bound = properties.map((property) => ({
        ...property,
        bound: property.key === 'fill'
    }));
    expect(completeParameters('unbind property=', bound, []).map(({ name }) => name)).toEqual([
        'Fill'
    ]);
    expect(completeParameters('bind property=', bound, [])).toHaveLength(3);
});
