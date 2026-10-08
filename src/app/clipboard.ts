import type { Group, Shape, ShapeInput, Variable } from './types';
import { shapeGeometry, shapeStyle } from './utils';
import { readCopiedGroup, readCopiedShape, readEntity } from './services/documentStorage';
import { bindableProperty, bindingHolds } from './variables';

/** What a paste did: added shapes, found none in the text, or waited for the editor. */
export type PasteResult = 'pasted' | 'noShapes' | 'notNow';

/** A copied group: its name, rotation and the positions of its shapes among the copied ones. */
export type CopiedGroup = ReturnType<typeof readCopiedGroup>;

/** What clipboard text holds: shapes, the groups they form and the variables they follow. */
export interface Copied {
    shapes: ShapeInput[];
    groups: CopiedGroup[];
    variables: Variable[];
}

/** Marks clipboard text as shapes copied from the editor. */
const CLIPBOARD_FORMAT = 'reactor/shapes';

/** The bindings of `shape` to `variables` that hold. */
const holdingBindings = (shape: Shape, variables: Record<string, Variable>) =>
    Object.entries(shape.bindings ?? {}).filter(([key, variableId]) => {
        const property = bindableProperty(key);
        const variable = variables[variableId];

        return property && variable && bindingHolds(property, shape, variable);
    });

/**
 * Copied shapes as clipboard text: what each draws, its name, description,
 * rotation and the properties that follow one of `variables`, the `groups` whose
 * shapes are all among them, and the variables followed.
 */
export function writeClipboard(
    shapes: Shape[],
    groups: Group[] = [],
    variables: Record<string, Variable> = {}
): string {
    const positions = new Map(shapes.map((shape, index) => [shape.id, index]));
    const copiedGroups = groups
        .filter(
            (group) =>
                group.shapesIds.length >= 2 && group.shapesIds.every((id) => positions.has(id))
        )
        .map((group) => ({
            name: group.name,
            rotation: group.rotation ?? 0,
            members: group.shapesIds.map((id) => positions.get(id))
        }));

    const bindings = shapes.map((shape) => holdingBindings(shape, variables));
    const followed = [...new Set(bindings.flat().map(([, variableId]) => variableId))];

    return JSON.stringify({
        format: CLIPBOARD_FORMAT,
        shapes: shapes.map((shape, index) => ({
            ...shapeGeometry(shape),
            ...shapeStyle(shape),
            name: shape.name,
            rotation: shape.rotation,
            ...(shape.description === undefined ? {} : { description: shape.description }),
            ...(bindings[index].length > 0 ? { bindings: Object.fromEntries(bindings[index]) } : {})
        })),
        ...(copiedGroups.length > 0 ? { groups: copiedGroups } : {}),
        ...(followed.length > 0 ? { variables: followed.map((id) => variables[id]) } : {})
    });
}

/**
 * The shapes, groups and variables clipboard text holds; none when it holds
 * anything else or any of it is invalid, as a binding to a variable it lacks.
 */
export function readClipboard(text: string): Copied {
    const nothing = { shapes: [], groups: [], variables: [] };

    try {
        const data: unknown = JSON.parse(text);

        if (
            typeof data !== 'object' ||
            data === null ||
            !('format' in data) ||
            data.format !== CLIPBOARD_FORMAT ||
            !('shapes' in data) ||
            !Array.isArray(data.shapes)
        ) {
            return nothing;
        }

        const shapes = data.shapes.map(readCopiedShape);
        const groupsData = 'groups' in data ? data.groups : [];

        if (!Array.isArray(groupsData)) {
            return nothing;
        }

        const variablesData = 'variables' in data ? data.variables : [];

        if (!Array.isArray(variablesData)) {
            return nothing;
        }

        const variables = variablesData.map((variable) => readEntity('variables', variable));
        const copiedIds = new Set(variables.map((variable) => variable.id));

        if (
            shapes.some((shape) =>
                Object.values(shape.bindings ?? {}).some((variableId) => !copiedIds.has(variableId))
            )
        ) {
            return nothing;
        }

        const taken = new Set<number>();

        return {
            shapes,
            groups: groupsData.map((group) => readCopiedGroup(group, shapes.length, taken)),
            variables
        };
    } catch {
        return nothing;
    }
}
