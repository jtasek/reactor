import type {
    Component,
    Document,
    Group,
    InstanceShape,
    Point,
    Shape,
    ShapeInput,
    Variable
} from './types';
import type { AddComponent, AddGroup, AddShape, AddVariable, Operation } from './operations';
import { getShapeBounds, shapeGeometry, shapeGeometryKey, shapeStyle } from './utils';
import { librarySnapshot } from './componentLibrary';
import { componentSource, instanceBox } from './componentSource';
import { copyName, createShape, instanceName, numberedName, shapeNamer } from './factories';
import { CLONE_OFFSET, translateShape } from './geometry';
import { applyProperty } from './properties';
import {
    hydrateComponent,
    readCopiedGroup,
    readCopiedShape,
    readEntity
} from './services/documentStorage';
import {
    bindableProperty,
    bindingHolds,
    replaceTemplateIds,
    templateVariablesIds,
    variableDependencies,
    templateWithIds,
    writeText
} from './variables';
import { resolveTemplate, variableNamed, resolveVariable } from './variableResolver';

/**
 * Drops each alias whose source is missing, of another type or leads back round, as
 * copies merging at once can leave them, so the variable pastes with its fallback.
 */
function dropBrokenAliases(variables: Variable[]) {
    const byId = new Map(variables.map((variable) => [variable.id, variable]));

    for (const variable of variables) {
        const seen = new Set([variable.id]);
        let current = variable;

        while (current.alias !== undefined) {
            const source = byId.get(current.alias);

            if (!source || source.type !== current.type || seen.has(source.id)) {
                delete current.alias;
                break;
            }
            seen.add(source.id);
            current = source;
        }
    }
}

/** What a paste did: added shapes, found none in the text, waited for the editor, or was refused. */
export type PasteResult = 'pasted' | 'noShapes' | 'notNow' | { problem: string };

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
            bindingHolds(property, shape, resolveVariable(variable, variables))
        );
    });

/** A text's template while it makes the text. */
const holdingTemplate = (shape: Shape, variables: Record<string, Variable>) =>
    shape.type === 'text' &&
    shape.template !== undefined &&
    resolveTemplate(shape.template, variables) === shape.value
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
        variableDependencies(variable, variables, held);
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
        dropBrokenAliases(variables);
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

/**
 * The variables `copied` holds as the document gets them: one of the same name and
 * type is used, else the copied one is added, renamed as `Brand 2` when its name is
 * taken. Answers the operations adding them and each copied variable's reference.
 */
function pasteVariables(copied: Variable[], document: Document) {
    const taken = new Set(Object.values(document.variables).map((variable) => variable.name));
    const references = new Map<string, string>();
    const added: AddVariable[] = [];

    copied.forEach((variable, index) => {
        const same = variableNamed(document.variables, variable.name);

        if (same?.type === variable.type) {
            references.set(variable.id, same.id);

            return;
        }

        const name = taken.has(variable.name) ? numberedName(variable.name, taken) : variable.name;
        const key = `variable:${index}`;

        taken.add(name);
        references.set(variable.id, key);
        added.push({
            op: 'addVariable',
            key,
            name,
            type: variable.type,
            value: variable.values.default,
            ...(variable.type === 'color' && variable.values.dark !== undefined
                ? { darkValue: variable.values.dark }
                : {}),
            ...(variable.alias === undefined ? {} : { alias: variable.alias })
        });
    });

    const remapTemplate = (template: string) =>
        replaceTemplateIds(template, (id) => references.get(id));
    const remapped = added.map((input) => {
        const operation = {
            ...input,
            ...(input.alias === undefined ? {} : { alias: references.get(input.alias) })
        };
        return operation.type === 'text' && typeof operation.value === 'string'
            ? { ...operation, value: remapTemplate(operation.value) }
            : operation;
    });
    const operations: AddVariable[] = [];
    const pending = new Map(remapped.map((operation) => [operation.key, operation]));
    const visit = (operation: AddVariable) => {
        if (!pending.delete(operation.key)) return;
        const source = operation.alias === undefined ? undefined : pending.get(operation.alias);
        if (source) visit(source);
        operations.push(operation);
    };
    remapped.forEach(visit);

    const values = { ...document.variables };

    operations.forEach((operation) => {
        values[operation.key] = readEntity('variables', {
            id: operation.key,
            name: operation.name,
            type: operation.type,
            values: {
                default: operation.value,
                ...(operation.darkValue === undefined ? {} : { dark: operation.darkValue })
            },
            ...(operation.alias === undefined ? {} : { alias: operation.alias })
        });
    });

    return { operations, references, remapTemplate, values };
}

/**
 * Operations that paste `copied` into `document`: its shapes above all others,
 * centered on `target`, or where they were copied without one. Where the first
 * has a shape drawn exactly like it, as when pasting twice, they are offset like
 * clones until it has not. A component the document has already is not added
 * again, and a reference to a variable neither copied nor in the document is left out.
 */
export function pasteOperations(
    copied: Copied,
    document: Document,
    target: Point | null
): Operation[] {
    const variables = pasteVariables(copied.variables, document);
    const remapShape = (shape: Shape | ShapeInput) => {
        if (shape.bindings) {
            shape.bindings = Object.fromEntries(
                Object.entries(shape.bindings).flatMap(([key, id]) => {
                    const reference = variables.references.get(id);

                    return reference === undefined ? [] : [[key, reference]];
                })
            );
        }
        if (shape.type === 'text' && shape.template !== undefined) {
            shape.template = variables.remapTemplate(shape.template);
        }
        if (shape.type !== 'instance') {
            return;
        }
        const component =
            document.components[shape.componentId] ??
            copied.components?.find(({ id }) => id === shape.componentId);
        const props = component?.props ?? [];

        shape.overrides = Object.fromEntries(
            Object.entries(shape.overrides).flatMap(
                ([id, value]): Array<[string, InstanceShape['overrides'][string]]> => {
                    if (!props.some((prop) => prop.id === id)) {
                        return [];
                    }
                    if (typeof value === 'string') {
                        return [[id, variables.remapTemplate(value)]];
                    }
                    if (typeof value !== 'object') {
                        return [[id, value]];
                    }
                    const reference =
                        variables.references.get(value.variableId) ??
                        (Object.hasOwn(document.variables, value.variableId)
                            ? value.variableId
                            : undefined);

                    return reference === undefined ? [] : [[id, { variableId: reference }]];
                }
            )
        );
    };

    const writeVariables = (shape: Shape) => {
        Object.entries(shape.bindings ?? {}).forEach(([key, id]) => {
            const property = bindableProperty(key);
            const variable = variables.values[id];

            if (property && variable && property.kind === variable.type) {
                applyProperty(property, shape, resolveVariable(variable, variables.values));
            }
        });
        if (shape.type === 'text' && shape.template !== undefined) {
            writeText(shape, shape.template, variables.values);
        }
    };
    const components = (copied.components ?? []).filter(
        (component) => !Object.hasOwn(document.components, component.id)
    );

    components.forEach((component) =>
        Object.values(component.sourceShapes ?? {}).forEach(remapShape)
    );
    const measuredComponents = structuredClone(components);

    measuredComponents.forEach((component) =>
        Object.values(component.sourceShapes ?? {}).forEach(writeVariables)
    );

    const sources = {
        components: {
            ...document.components,
            ...Object.fromEntries(measuredComponents.map((component) => [component.id, component]))
        },
        shapes: document.shapes,
        shapesIds: document.shapesIds,
        variables: variables.values
    };
    const present = Object.values(document.shapes);
    const taken = new Set(present.map((shape) => shape.name));
    const nameShape = shapeNamer(present);
    const pasted = copied.shapes.map((input) => {
        const name =
            input.name === undefined
                ? nameShape(input.type)
                : input.type === 'instance'
                  ? instanceName(input.name, taken)
                  : copyName(input.name, input.type, taken, nameShape);

        taken.add(name);
        remapShape(input);

        const shape = createShape({ ...input, name, order: '' });

        writeVariables(shape);
        const source =
            shape.type === 'instance' ? componentSource(sources, shape.componentId) : null;

        if (shape.type === 'instance' && source) {
            shape.bounds = instanceBox(shape, source);
        }

        return shape;
    });

    if (target) {
        const boxes = pasted.map(getShapeBounds);
        const left = Math.min(...boxes.map((box) => box.topLeft.x));
        const top = Math.min(...boxes.map((box) => box.topLeft.y));
        const right = Math.max(...boxes.map((box) => box.bottomRight.x));
        const bottom = Math.max(...boxes.map((box) => box.bottomRight.y));
        const delta = { x: target.x - (left + right) / 2, y: target.y - (top + bottom) / 2 };

        pasted.forEach((shape) => translateShape(shape, delta));
    }

    const drawn = new Set(
        present.filter((shape) => shape.type === pasted[0].type).map(shapeGeometryKey)
    );
    const coversLiveSource = () =>
        pasted.some((shape) => {
            if (shape.type !== 'instance') {
                return false;
            }
            const component = document.components[shape.componentId];

            if (!component?.shapesIds.some((id) => document.shapes[id])) {
                return false;
            }
            const source = componentSource(document, shape.componentId);

            return (
                source?.box.topLeft.x === shape.position.x &&
                source.box.topLeft.y === shape.position.y
            );
        });

    while (drawn.has(shapeGeometryKey(pasted[0])) || coversLiveSource()) {
        pasted.forEach((shape) => translateShape(shape, CLONE_OFFSET));
    }

    const shapeOperations: AddShape[] = copied.shapes.map((input, index) => ({
        op: 'addShape',
        key: `shape:${index}`,
        shape: { ...input, ...shapeGeometry(pasted[index]), name: pasted[index].name }
    }));
    const groupOperations: AddGroup[] = copied.groups.map(({ name, rotation, members }) => ({
        op: 'addGroup',
        name,
        rotation,
        shapes: members.map((index) => shapeOperations[index].key)
    }));

    return [
        ...variables.operations,
        ...components.map((component): AddComponent => ({ op: 'addComponent', component })),
        ...shapeOperations,
        ...groupOperations
    ];
}
