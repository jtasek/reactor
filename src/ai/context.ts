import type { Document, Shape } from 'src/app/types';
import { readEntity } from 'src/app/services/documentStorage';
import { inDrawingOrder } from 'src/app/drawOrder';
import { TEMPLATE_PART, templateVariable } from 'src/app/variableResolver';

/** A transport-size budget, not a provider-specific token count. */
export const MAX_CONTEXT_BYTES = 32 * 1024;
const MAX_CONTEXT_RECORDS = 300;

/** What a shape keeps for the editor alone, or names elsewhere, as its ID. */
const EDITOR_FIELDS = new Set([
    'id',
    'created',
    'modified',
    'createdBy',
    'modifiedBy',
    'order',
    'children'
]);

export class ContextTooLarge extends Error {
    constructor() {
        super(
            'This context is too large. Select fewer items or shorten their text, then try again.'
        );
    }
}

const shapeContext = (shape: Shape) =>
    Object.fromEntries(
        Object.entries(readEntity('shapes', shape)).filter(([field]) => !EDITOR_FIELDS.has(field))
    );

type ShapeContext = ReturnType<typeof shapeContext>;
interface ComponentContext {
    name: string;
    props: Array<{ id: string; label: string }>;
    shapes: Record<string, ShapeContext>;
}

/**
 * The selection, its groups and dependencies, in drawing order. With no
 * selection, a small document and its design system remain available. Nothing
 * is silently truncated: oversized context is refused before sending it.
 */
export function documentContext(document: Document) {
    const selection = [...document.selectedShapesIds];
    const selected = new Set(selection);
    const whole = selection.length === 0;
    const shapeIds = new Set(whole ? document.shapesIds : selection);
    const groups = new Map<string, { name: string; shapes: string[] }>();
    const variables = new Map<
        string,
        {
            name: string;
            type: string;
            value: unknown;
            alias?: string;
            dimensionId?: string;
            modeValues?: Record<string, string>;
        }
    >();
    const components = new Map<string, ComponentContext>();
    let records = 0;

    const reserve = () => {
        if (++records > MAX_CONTEXT_RECORDS) {
            throw new ContextTooLarge();
        }
    };

    const followTemplate = (text: string) => {
        for (const [, inside, name] of text.matchAll(TEMPLATE_PART)) {
            const variable =
                inside === undefined
                    ? undefined
                    : templateVariable(document.variables, inside, name);

            if (variable) {
                addVariable(variable.id);
            }
        }
    };
    const addVariable = (id: string): void => {
        const variable = document.variables[id];

        if (!Object.hasOwn(document.variables, id) || variables.has(id)) {
            return;
        }
        reserve();
        variables.set(id, {
            name: variable.name,
            type: variable.type,
            value: variable.values.default,
            ...(variable.type !== 'boolean' && variable.dimensionId
                ? {
                      dimensionId: variable.dimensionId,
                      modeValues: Object.fromEntries(
                          Object.entries(variable.values).filter(([key]) => key !== 'default')
                      )
                  }
                : {}),
            ...(variable.alias === undefined ? {} : { alias: variable.alias })
        });
        if (variable.alias !== undefined) addVariable(variable.alias);
        if (variable.type === 'text') {
            Object.values(variable.values).forEach(followTemplate);
        }
    };
    const followShape = (shape: Shape) => {
        Object.values(shape.bindings ?? {}).forEach(addVariable);
        if (shape.type === 'text' && shape.template !== undefined) {
            followTemplate(shape.template);
        }
        if (shape.type === 'instance') {
            addComponent(shape.componentId);
            Object.values(shape.overrides).forEach((override) => {
                if (typeof override === 'object') {
                    addVariable(override.variableId);
                } else if (typeof override === 'string') {
                    followTemplate(override);
                }
            });
        }
    };
    const addComponent = (id: string): void => {
        const component = document.components[id];

        if (!Object.hasOwn(document.components, id) || components.has(id)) {
            return;
        }
        reserve();
        const source: ComponentContext = {
            name: component.name,
            props: (component.props ?? []).map(({ id, label }) => ({ id, label })),
            shapes: {}
        };
        const members = new Set(component.shapesIds);
        const ordered = component.sourceShapes
            ? inDrawingOrder(component.sourceShapes)
            : document.shapesIds;

        components.set(id, source);
        source.shapes = Object.fromEntries(
            ordered
                .filter((shapeId) => members.has(shapeId))
                .flatMap((shapeId) => {
                    const shape = component.sourceShapes?.[shapeId] ?? document.shapes[shapeId];

                    if (!shape) {
                        return [];
                    }
                    reserve();
                    followShape(shape);

                    return [[shapeId, shapeContext(shape)]];
                })
        );
    };

    Object.values(document.groups).forEach(({ id, name, shapesIds }) => {
        if (whole || shapesIds.some((id) => selected.has(id))) {
            reserve();
            const members = shapesIds.filter((id) => Object.hasOwn(document.shapes, id));

            groups.set(id, { name, shapes: [...members] });
            members.forEach((id) => shapeIds.add(id));
        }
    });
    const shapes = Object.fromEntries(
        document.shapesIds
            .filter((id) => shapeIds.has(id))
            .map((id) => {
                reserve();
                const shape = document.shapes[id];

                followShape(shape);

                return [id, shapeContext(shape)];
            })
    );

    if (whole) {
        Object.keys(document.variables).forEach(addVariable);
        Object.keys(document.components).forEach(addComponent);
    }
    const context = {
        selection,
        shapes,
        groups: Object.fromEntries(groups),
        variables: Object.fromEntries(variables),
        dimensions: Object.fromEntries(
            Object.entries(document.dimensions).filter(
                ([id]) =>
                    whole || [...variables.values()].some((variable) => variable.dimensionId === id)
            )
        ),
        components: Object.fromEntries(components)
    };

    if (new TextEncoder().encode(JSON.stringify(context)).byteLength > MAX_CONTEXT_BYTES) {
        throw new ContextTooLarge();
    }

    return context;
}
