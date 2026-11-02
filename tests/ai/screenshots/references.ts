import { hydrateDocument } from 'src/app/services/documentStorage';
import { createDocument } from 'src/app/factories';
import type { Document, Shape } from 'src/app/types';
import { buildStarterTemplate } from 'src/templates/build';
import { STARTER_TEMPLATES } from 'src/templates/catalog';
import { colorDistance } from './color';
import { DOCUMENT_ID } from '../../support/collaboration';

const PALETTE = {
    ink: '#20242c',
    muted: '#626b78',
    accent: '#275de5',
    surface: '#ffffff',
    line: '#dce1e9'
};
const ALTERNATE = { ...PALETTE, accent: '#7638ba', ink: '#302039', muted: '#76647b' };
const COLOR_FIELDS = ['fill', 'stroke', 'fontColor'] as const;

interface ExpectedControl {
    label: string;
    role: string;
    placeholder?: string;
}

export function screenshotReferences() {
    const originals = STARTER_TEMPLATES.flatMap(({ id }) => {
        let sequence = 0;
        const template = buildStarterTemplate(id, () => `${id}-${++sequence}`);
        const views = Object.values(template.frames).filter((frame) => frame.kind === 'view');

        return views.map((view, index) => ({ template, view, name: `${id}-${index + 1}` }));
    });

    // Twelve authored screens, twelve palette variants and six copy variants: not 30 independent designs.
    return [
        ...originals.map((source) => ({ ...source, variant: 'original' as const })),
        ...originals.map((source) => ({ ...source, variant: 'palette' as const })),
        ...originals.slice(0, 6).map((source) => ({ ...source, variant: 'copy' as const }))
    ].map(({ template, view, name, variant }) => {
        const palette = variant === 'palette' ? ALTERNATE : PALETTE;
        const shapes = structuredClone(template.shapes);
        Object.values(shapes).forEach((shape) => {
            COLOR_FIELDS.forEach((field) => {
                const key = Object.entries(PALETTE).find(
                    ([, color]) => Reflect.get(shape, field) === color
                )?.[0] as keyof typeof PALETTE | undefined;
                if (key) {
                    Reflect.set(shape, field, palette[key]);
                }
            });
            if (
                variant === 'copy' &&
                shape.type === 'text' &&
                shape.parentFrameId === view.screenId &&
                shape.fontSize === 28
            ) {
                shape.value = `Your ${shape.value.toLowerCase()}`;
            }
        });
        const variables = Object.fromEntries(
            Object.entries(palette).map(([key, value]) => [
                key,
                {
                    id: key,
                    name: key,
                    type: 'color' as const,
                    values: { default: value }
                }
            ])
        );
        const sourceIds = new Set(
            Object.values(template.components).flatMap((component) => component.shapesIds)
        );
        const library = Object.fromEntries(
            Object.entries(shapes).filter(([id]) => sourceIds.has(id))
        );
        // Library artwork is already bound. The AI sees these components and variables, never target artwork.
        Object.values(library).forEach((shape) => {
            COLOR_FIELDS.forEach((field) => {
                const key = Object.entries(palette).find(
                    ([, color]) => Reflect.get(shape, field) === color
                )?.[0];
                if (key) {
                    shape.bindings = { ...shape.bindings, [field]: key };
                }
            });
        });
        const seed = createDocument({
            id: DOCUMENT_ID,
            name: 'Screenshot recreation',
            shapes: library,
            shapesIds: Object.keys(library),
            components: structuredClone(template.components),
            variables
        });
        const target = createDocument({
            ...structuredClone(template),
            id: DOCUMENT_ID,
            shapes,
            variables
        });
        const controls = Object.values(shapes).filter(
            (shape) => shape.parentFrameId === view.screenId && shape.type === 'instance'
        );
        const labels = controls.map((shape) =>
            shape.type === 'instance' ? String(shape.overrides.label) : ''
        );
        const expectedControls: ExpectedControl[] = controls.flatMap((shape) => {
            if (shape.type !== 'instance') {
                return [];
            }
            const role = template.components[shape.componentId].interaction!.role;

            return [
                {
                    label: String(shape.overrides.label),
                    role,
                    ...(role === 'input'
                        ? { placeholder: String(shape.overrides.placeholder) }
                        : {})
                }
            ];
        });

        return {
            name: `${name}-${variant}`,
            variant,
            target,
            seed,
            viewId: view.id,
            size: view.size,
            labels,
            expectedControls
        };
    });
}

/** A hidden input label must not count as a visibly labeled button. */
export function reusedControls(
    document: Document,
    expected: ExpectedControl[],
    componentIds = Object.keys(document.components)
) {
    const actual = Object.values(document.shapes).flatMap((shape) =>
        shape.type === 'instance' && shape.parentFrameId && componentIds.includes(shape.componentId)
            ? [
                  {
                      label: String(shape.overrides.label),
                      role: document.components[shape.componentId]?.interaction?.role,
                      placeholder: String(shape.overrides.placeholder)
                  }
              ]
            : []
    );
    const remaining = [...actual];

    return expected.filter((control) => {
        const index = remaining.findIndex(
            (candidate) =>
                candidate.label === control.label &&
                candidate.role === control.role &&
                (control.placeholder === undefined || control.placeholder === candidate.placeholder)
        );
        if (index < 0) {
            return false;
        }
        remaining.splice(index, 1);

        return true;
    }).length;
}

export function unboundPaletteColors(shapes: Shape[], seed: Document) {
    return shapes.flatMap((shape) =>
        COLOR_FIELDS.flatMap((field) => {
            const value = Reflect.get(shape, field);
            const variable = Object.values(seed.variables).find(
                (candidate) =>
                    typeof value === 'string' &&
                    /^#[0-9a-f]{6}$/i.test(value) &&
                    typeof candidate.values.default === 'string' &&
                    colorDistance(candidate.values.default, value) <= 2
            );
            if (
                !variable ||
                shape.bindings?.[field as keyof NonNullable<Shape['bindings']>] === variable.id
            ) {
                return [];
            }

            return [`${shape.id}.${field} duplicates ${variable.name} without a binding`];
        })
    );
}

/** Exact authored repetitions, independent of wrapping and layout coordinates. */
export function repeatedScreenText(shapes: Shape[], reference: Shape[]) {
    const counts = (items: Shape[]) =>
        items.reduce<Record<string, number>>((result, shape) => {
            if (shape.type === 'text' && shape.parentFrameId) {
                const text = shape.value.trim();
                result[text] = (result[text] ?? 0) + 1;
            }

            return result;
        }, Object.create(null));
    const expected = counts(reference);

    return Object.entries(counts(shapes))
        .filter(([text, count]) => expected[text] !== undefined && count > expected[text])
        .map(([text]) => text);
}

/** Store actions own these records; never lend them the benchmark's baseline objects. */
export function isolatedDocument(document: Document): Document {
    return hydrateDocument(JSON.parse(JSON.stringify(document)));
}
