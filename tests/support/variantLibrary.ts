import { createComponent, createDocument, createShape } from 'src/app/factories';
import { librarySnapshot } from 'src/app/componentLibrary';

/** A published family, a nested use and three consumers of its snapshots. */
export function variantLibrary() {
    const base = {
        ...createShape({
            type: 'text',
            name: 'Base text',
            value: 'Default',
            fontSize: 16,
            order: 'a0',
            position: { x: 0, y: 0 }
        }),
        id: 'base-text'
    };
    const wide = {
        ...createShape({
            type: 'text',
            name: 'Wide text',
            value: 'Wide',
            fontSize: 32,
            order: 'a1',
            position: { x: 0, y: 0 }
        }),
        id: 'wide-text'
    };
    const nested = {
        ...createShape({
            type: 'instance',
            name: 'Nested button',
            componentId: 'family',
            variantId: 'wide',
            overrides: { label: 'Nested' },
            order: 'a2',
            position: { x: 0, y: 0 }
        }),
        id: 'nested'
    };
    const family = createComponent({
        id: 'family',
        name: 'Button',
        sourceOnly: true,
        shapesIds: [base.id],
        variantIds: ['wide'],
        props: [{ id: 'label', key: 'text', label: 'Label', shapeId: base.id }],
        interaction: { role: 'button', props: { label: 'label' } }
    });
    const alternate = createComponent({
        id: 'wide',
        name: 'Button Wide',
        sourceOnly: true,
        shapesIds: [wide.id],
        props: [{ id: 'label', key: 'text', label: 'Label', shapeId: wide.id }],
        interaction: { role: 'button', props: { label: 'label' } }
    });
    const outer = createComponent({
        id: 'outer',
        name: 'Container',
        sourceOnly: true,
        shapesIds: [nested.id]
    });
    const source = createDocument({
        id: 'library',
        name: 'Library',
        shapes: { [base.id]: base, [wide.id]: wide, [nested.id]: nested },
        components: { family, wide: alternate, outer }
    });
    const snapshots = librarySnapshot(source, 'outer', { components: {} })!;
    const instance = {
        ...createShape({
            type: 'instance',
            name: 'Button instance',
            componentId: 'family',
            variantId: 'wide',
            overrides: { label: 'Continue' },
            interaction: { role: 'button', props: { label: 'label' }, navigateTo: 'home' },
            order: 'a0',
            position: { x: 200, y: 100 }
        }),
        id: 'button'
    };
    const nestedUse = {
        ...createShape({
            type: 'instance',
            name: 'Container instance',
            componentId: 'outer',
            overrides: {},
            order: 'a1',
            position: { x: 200, y: 200 }
        }),
        id: 'nested-use'
    };
    const direct = {
        ...createShape({
            type: 'instance',
            name: 'Standalone wide',
            componentId: 'wide',
            overrides: { label: 'Standalone' },
            order: 'a2',
            position: { x: 200, y: 300 }
        }),
        id: 'direct-wide'
    };
    const target = createDocument({
        id: 'consumer',
        name: 'Website',
        components: Object.fromEntries(snapshots.map((component) => [component.id, component])),
        shapes: { [instance.id]: instance, [nestedUse.id]: nestedUse, [direct.id]: direct }
    });

    return { source, target };
}
