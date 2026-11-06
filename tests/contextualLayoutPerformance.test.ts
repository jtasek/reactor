import { contextualDocument } from 'src/app/contextualLayout';
import * as inheritedModes from 'src/app/inheritedModes';
import * as responsiveVariants from 'src/app/responsiveVariants';
import type { InstanceShape, Text } from 'src/app/types';
import { responsiveDocument } from './support/responsiveModes';
import { responsiveVariantsDocument } from './support/responsiveVariants';

it('resolves sibling text modes once per parent and skips unused variant widths', () => {
    const document = responsiveDocument();
    document.frames.other = {
        ...document.frames.content,
        id: 'other',
        modeOverrides: { media: 'lg' }
    };
    document.shapes = Object.fromEntries(
        Array.from({ length: 100 }, (_, index) => {
            const id = `label-${index}`;

            return [
                id,
                { ...document.shapes.label, id, parentFrameId: index % 2 ? 'other' : 'content' }
            ];
        })
    );
    document.shapesIds = Object.keys(document.shapes);
    const modes = vi.spyOn(inheritedModes, 'resolveModes');
    const widths = vi.spyOn(responsiveVariants, 'variantWidths');
    try {
        const first = contextualDocument(document, { viewId: 'mobile' });
        expect(modes).toHaveBeenCalledTimes(2);
        expect(widths).not.toHaveBeenCalled();
        expect((first.shapes['label-0'] as Text).fontSize).toBe(14);
        expect((first.shapes['label-1'] as Text).fontSize).toBe(20);

        document.frames.content.modeOverrides = { media: 'sm' };
        const second = contextualDocument(document, { viewId: 'mobile' });
        expect(modes).toHaveBeenCalledTimes(4);
        expect((second.shapes['label-0'] as Text).fontSize).toBe(16);
        expect((first.shapes['label-0'] as Text).fontSize).toBe(14);
    } finally {
        modes.mockRestore();
        widths.mockRestore();
    }
});

it('shares sibling variant widths only within a pass and preserves instance values', () => {
    const document = responsiveVariantsDocument();
    document.components.family.responsiveVariants = {
        source: 'parent',
        rules: [{ minWidth: 200, variantId: 'wide' }]
    };
    const ids = Array.from({ length: 40 }, (_, index) => `button-${index}`);
    ids.forEach((id, index) => {
        document.shapes[id] = {
            ...(document.shapes.button as InstanceShape),
            id,
            overrides: { label: `Item ${index}` },
            modeOverrides: index === 0 ? { media: 'lg' } : undefined
        };
    });
    const widths = vi.spyOn(responsiveVariants, 'variantWidths');
    const modes = vi.spyOn(inheritedModes, 'resolveModes');
    try {
        const first = contextualDocument(document, { viewId: 'mobile' }, {}, {}, new Set(ids));
        expect(widths).toHaveBeenCalledTimes(1);
        expect(modes).toHaveBeenCalledTimes(1);
        ids.forEach((id, index) => {
            const source = (first.shapes[id] as InstanceShape).projectedSource!;
            expect(source.variant?.componentId).toBe('wide');
            expect((source.shapes[0] as Text).value).toBe(`Item ${index}`);
            expect(source.context?.modes.media).toBe(index === 0 ? 'lg' : 'xs');
        });

        const second = contextualDocument(
            document,
            { viewId: 'mobile' },
            {},
            { content: { width: 100, height: 240 } },
            new Set(ids)
        );
        expect(widths).toHaveBeenCalledTimes(2);
        ids.forEach((id) => {
            expect((second.shapes[id] as InstanceShape).projectedSource?.variant?.componentId).toBe(
                'family'
            );
            expect((first.shapes[id] as InstanceShape).projectedSource?.variant?.componentId).toBe(
                'wide'
            );
        });
    } finally {
        widths.mockRestore();
        modes.mockRestore();
    }
});
