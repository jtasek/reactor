import { variantLibrary } from './variantLibrary';
import { responsiveDocument } from './responsiveModes';
import { createDocument } from 'src/app/factories';
import type { InstanceShape } from 'src/app/types';

export function responsiveVariantsDocument(id = 'responsive-variants') {
    const { source, target } = variantLibrary();
    const responsive = responsiveDocument();
    const button = {
        ...target.shapes.button,
        variantMode: 'auto',
        variantId: undefined,
        parentFrameId: 'content',
        position: { x: 120, y: 120 }
    } as InstanceShape;
    const family = {
        ...source.components.family,
        responsiveVariants: {
            source: 'screen' as const,
            rules: [{ minWidth: 600, variantId: 'wide' }]
        }
    };

    return createDocument({
        id,
        name: 'Responsive variants',
        frames: responsive.frames,
        variables: responsive.variables,
        dimensions: responsive.dimensions,
        components: { family, wide: source.components.wide },
        shapes: {
            'base-text': source.shapes['base-text'],
            'wide-text': source.shapes['wide-text'],
            button
        },
        shapesIds: ['base-text', 'wide-text', 'button']
    });
}
