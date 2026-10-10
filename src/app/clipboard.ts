import type {
    Component,
    Document,
    Group,
    InstanceShape,
    Shape,
    ShapeInput,
    Variable
} from './types';
import { shapeGeometry, shapeStyle } from './utils';
import { librarySnapshot } from './componentLibrary';
import {
    hydrateComponent,
    readCopiedGroup,
    readCopiedShape,
    readEntity
} from './services/documentStorage';
import {
    bindableProperty,
    bindingHolds,
    renderTemplate,
    templateVariablesIds,
    templateWithIds,
    variableValue
} from './variables';

/** What a paste did: added shapes, found none in the text, or waited for the editor. */
export type PasteResult = 'pasted' | 'noShapes' | 'notNow';

/** A copied group: its name, rotation and the positions of its shapes among the copied ones. */
export type CopiedGroup = ReturnType<typeof readCopiedGroup>;

/** What clipboard text holds: shapes, the groups they form and the variables they follow. */
export interface Copied {
    shapes: ShapeInput[];
    groups: CopiedGroup[];
    variables: Variable[];
    components?: Component[];
}

/** Marks clipboard text as shapes copied from the editor. */
const CLIPBOARD_FORMAT = 'reactor/shapes';

/** The bindings of `shape` to `variables` that hold. */
const holdingBindings = (shape: Shape, variables: Record<string, Variable>) =>
    Object.entries(shape.bindings ?? {}).filter(([key, variableId]) => {
        const property = bindableProperty(key);
        const variable = variables[variableId];

        return (
            property &&
            variable &&
            bindingHolds(property, shape, variableValue(variable, variables))
        );
    });

/** A text's template while it makes the text. */
const holdingTemplate = (shape: Shape, variables: Record<string, Variable>) =>
    shape.type === 'text' &&
    shape.template !== undefined &&
    renderTemplate(shape.template, variables) === shape.value
        ? shape.template
        : undefined;

/** Store template references by id so a paste can remap renamed variables. */
const copiedOverrides = (shape: InstanceShape, variables: Record<string, Variable>) =>
    Object.fromEntries(
        Object.entries(shape.overrides).map(([id, value]) => [
            id,
            typeof value === 'string' ? templateWithIds(value, variables) : value
        ])
    );

/**
 * Copied shapes as clipboard text: what each draws, its name, description,
 * rotation, the properties that follow one of `variables` and a text's template,
 * the `groups` whose shapes are all among them, and the variables these hold,
 * with those their text values hold.
 */
export function writeClipboard(
    shapes: Shape[],
    groups: Group[] = [],
    variables: Record<string, Variable> = {},
    document?: Document
): string {
    const components = new Map<string, Component>();

    for (const shape of shapes) {
        if (shape.type !== 'instance' || !document || components.has(shape.componentId)) {
            continue;
        }
        const sources = librarySnapshot(document, shape.componentId, { components: {} });
        sources?.forEach((source) => {
            for (const member of Object.values(source.sourceShapes ?? {})) {
                if (member.type === 'instance') {
                    member.overrides = copiedOverrides(member, variables);
                }
            }
            components.set(source.id, source);
        });
    }
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
    const templates = shapes.map((shape) => holdingTemplate(shape, variables));
    const held = new Set<string>();
    const dependencyShapes = [
        ...shapes,
        ...[...components.values()].flatMap((component) =>
            Object.values(component.sourceShapes ?? {})
        )
    ];
    const holdVariable = (variableId: string) => {
        const variable = variables[variableId];

        if (!variable) {
            return;
        }
        held.add(variableId);
        if (variable.type === 'text') {
            templateVariablesIds(variable.values.default, variables, held);
        }
    };

    for (const shape of dependencyShapes) {
        holdingBindings(shape, variables).forEach(([, id]) => holdVariable(id));
        const template = holdingTemplate(shape, variables);

        if (template !== undefined) {
            templateVariablesIds(template, variables, held);
        }
        if (shape.type !== 'instance') {
            continue;
        }
        for (const override of Object.values(shape.overrides)) {
            if (typeof override === 'object') {
                holdVariable(override.variableId);
            }
            if (typeof override === 'string') {
                templateVariablesIds(templateWithIds(override, variables), variables, held);
            }
        }
    }

    return JSON.stringify({
        format: CLIPBOARD_FORMAT,
        ...(components.size > 0 ? { components: [...components.values()] } : {}),
        shapes: shapes.map((shape, index) => ({
            ...shapeGeometry(shape),
            ...(shape.type === 'instance' ? { overrides: copiedOverrides(shape, variables) } : {}),
            ...shapeStyle(shape),
            name: shape.name,
            rotation: shape.rotation,
            ...(shape.description === undefined ? {} : { description: shape.description }),
            ...(bindings[index].length > 0
                ? { bindings: Object.fromEntries(bindings[index]) }
                : {}),
            ...(templates[index] === undefined ? {} : { template: templates[index] })
        })),
        ...(copiedGroups.length > 0 ? { groups: copiedGroups } : {}),
        ...(held.size > 0 ? { variables: [...held].map((id) => variables[id]) } : {})
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

        const componentsData = 'components' in data ? data.components : [];

        if (!Array.isArray(componentsData)) {
            return nothing;
        }
        const components = componentsData.map((component) =>
            hydrateComponent(readEntity('components', component))
        );
        const componentIds = new Set(components.map((component) => component.id));

        if (
            components.some((component) =>
                component.shapesIds.some((id) => {
                    const shape = component.sourceShapes?.[id];

                    return (
                        !shape ||
                        (shape.type === 'instance' && !componentIds.has(shape.componentId))
                    );
                })
            )
        ) {
            return nothing;
        }

        const taken = new Set<number>();

        return {
            shapes,
            groups: groupsData.map((group) => readCopiedGroup(group, shapes.length, taken)),
            variables,
            ...(components.length > 0 ? { components } : {})
        };
    } catch {
        return nothing;
    }
}
