import { createComponent, createDocument, createShape } from 'src/app/factories';
import { componentFingerprint, librarySnapshot } from 'src/app/componentLibrary';
import { detachedMembers } from 'src/app/componentDetach';
import { componentSource } from 'src/app/componentSource';
import { acceptsComponentValue } from 'src/app/componentProps';
import { SHAPE_PROPERTIES } from 'src/app/properties';
import { getShapeBounds } from 'src/app/utils';

function library() {
    const rectangle = createShape({
        type: 'rectangle',
        name: 'Rectangle',
        order: 'a0',
        position: { x: 10, y: 20 },
        size: { width: 30, height: 40 }
    });
    const leaf = createComponent({ shapesIds: [rectangle.id] });
    const instances = [0, 1].map((index) =>
        createShape({
            type: 'instance',
            name: `Instance ${index}`,
            order: `a${index + 1}`,
            componentId: leaf.id,
            position: { x: index * 100, y: 0 },
            overrides: {}
        })
    );
    const parent = createComponent({ shapesIds: instances.map((shape) => shape.id) });
    const document = createDocument({
        shapes: Object.fromEntries([rectangle, ...instances].map((shape) => [shape.id, shape])),
        components: { [leaf.id]: leaf, [parent.id]: parent }
    });

    return { document, rectangle, leaf, parent, instances };
}

it('copies shared library dependencies once, independently of the source', () => {
    const { document, rectangle, leaf, parent } = library();
    const destination = createDocument();
    const before = JSON.stringify(document);
    const copies = librarySnapshot(document, parent.id, destination);

    expect(copies?.map((component) => component.id)).toEqual([leaf.id, parent.id]);
    expect(JSON.stringify(document)).toBe(before);
    expect(destination.components).toEqual({});
    const hash = componentFingerprint(document, parent.id);
    rectangle.fill = '#ff0000';
    expect(componentFingerprint(document, parent.id)).not.toBe(hash);
    expect(copies?.[0].sourceShapes?.[rectangle.id].fill).toBeUndefined();
});

it('rejects cyclic libraries and conflicting dependencies without changing the destination', () => {
    const { document, leaf, parent, instances } = library();
    const destination = createDocument({ components: { [leaf.id]: leaf } });
    const before = JSON.stringify(destination);
    expect(librarySnapshot(document, parent.id, destination)).toBeNull();
    expect(JSON.stringify(destination)).toBe(before);

    leaf.shapesIds = [instances[0].id];
    expect(librarySnapshot(document, parent.id, createDocument())).toBeNull();
    expect(componentFingerprint(document, parent.id)).toBeNull();
});

it('calculates rotated detached geometry and overrides without modifying source members', () => {
    const { document, rectangle, leaf } = library();
    const companion = createShape({
        type: 'rectangle',
        name: 'Companion',
        order: 'a4',
        position: { x: 70, y: 20 },
        size: { width: 30, height: 40 }
    });
    document.shapes[companion.id] = companion;
    document.shapesIds.push(companion.id);
    leaf.shapesIds.push(companion.id);
    leaf.props = [{ id: 'color', shapeId: rectangle.id, key: 'fill', label: 'Color' }];
    const instance = createShape({
        type: 'instance',
        name: 'Rotated',
        order: 'a3',
        componentId: leaf.id,
        position: { x: 200, y: 300 },
        rotation: 90,
        overrides: { color: '#ff0000' }
    });
    const source = componentSource(document, leaf.id);

    if (!source || instance.type !== 'instance') {
        throw new Error('Expected a component instance');
    }
    const before = JSON.stringify({ document, instance });
    const [copy, second] = detachedMembers(document, instance, source);
    expect(copy).toMatchObject({
        position: { x: 230, y: 270 },
        rotation: 90,
        fill: '#ff0000'
    });
    expect(second).toMatchObject({ position: { x: 230, y: 330 }, rotation: 90 });
    expect(getShapeBounds(copy)).toMatchObject({ width: 30, height: 40 });
    expect(JSON.stringify({ document, instance })).toBe(before);
});

it.each([
    ['opacity', 50, true],
    ['opacity', Number.NaN, false],
    ['opacity', Infinity, false],
    ['opacity', '50', false],
    ['visible', false, true],
    ['visible', 0, false],
    ['fill', '', true],
    ['fill', '#abcdef', true],
    ['fill', 'red', false],
    ['text', 'Hello', true],
    ['text', true, false]
] as const)('validates %s value %s as %s', (key, value, accepted) => {
    const property = SHAPE_PROPERTIES.find((item) => item.key === key);

    if (!property) {
        throw new Error(`Missing property ${key}`);
    }
    expect(acceptsComponentValue(property, value)).toBe(accepted);
});
