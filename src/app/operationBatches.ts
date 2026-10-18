import { json } from 'overmind';
import type { Component, Document, Group, Shape, ShapeInput, Variable } from './types';
import type {
    AddShape,
    Operation,
    OperationsCheck,
    UpdateShape,
    UpdateVariable
} from './operations';
import { createGroup, createShape, instanceName, shapeNamer } from './factories';
import { orderAbove } from './drawOrder';
import { containersHolding, shapeLayer } from './membership';
import { deleteShape } from './deleteShape';
import { applyProperty } from './properties';
import {
    accepts,
    escapeTemplate,
    applyVariableChanges,
    bindableProperty,
    bindingHolds,
    removeVariable,
    replaceTemplateIds,
    unbindEditedProperties,
    writeText
} from './variables';
import { variableNamed, resolveVariable, variableProblems } from './variableResolver';
import { componentSource, instanceBox } from './componentSource';
import { hydrateComponent, readEntity } from './services/documentStorage';
import { shapeGeometryKey } from './utils';

type Referable = 'variables' | 'components' | 'shapes';

/** The records an operation may change or delete. */
type Changeable = 'variables' | 'shapes' | 'groups';

/** The fields of a shape an update may change: those a model may give a shape it adds. */
const CHANGEABLE_FIELDS = new Set([
    'name',
    'description',
    'rotation',
    'opacity',
    'fill',
    'stroke',
    'bindings',
    'position',
    'size',
    'cornerRadius',
    'radius',
    'start',
    'end',
    'points',
    'value',
    'template',
    'fontSize',
    'fontColor',
    'overrides'
]);

/** The fields an update writes into a shape: undefined ones are removed. */
interface ShapeUpdate {
    id: string;
    fields: Record<string, unknown>;
}

export interface Staged {
    variables: Variable[];
    components: Component[];
    shapes: Shape[];
    groups: Group[];
    updatedVariables: Variable[];
    deletedVariables: string[];
    updatedShapes: ShapeUpdate[];
    deletedShapes: string[];
    deletedGroups: string[];
}

/** What a batch adds, changes and deletes, with the IDs of what it adds by key. */
export type StagedBatch = Staged & { ids: Record<string, string> };

const declaredKey = (operation: Operation): [string, Referable] | undefined => {
    switch (operation.op) {
        case 'addVariable':
            return [operation.key, 'variables'];
        case 'addComponent':
            return [operation.component.id, 'components'];
        case 'addShape':
            return [operation.key, 'shapes'];
        default:
            return undefined;
    }
};

/** The records the document has that an operation changes or deletes. */
const changedRecords = (operation: Operation): [Changeable, string[]] | undefined => {
    switch (operation.op) {
        case 'updateVariable':
        case 'deleteVariable':
            return ['variables', [operation.variable]];
        case 'updateShape':
            return ['shapes', [operation.shape]];
        case 'deleteShapes':
            return ['shapes', operation.shapes];
        case 'deleteGroup':
            return ['groups', [operation.group]];
        default:
            return undefined;
    }
};

const isDeletion = (operation: Operation) =>
    operation.op === 'deleteVariable' ||
    operation.op === 'deleteShapes' ||
    operation.op === 'deleteGroup';

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Why an operation of a batch is invalid, with the operation's place in the batch. */
const problem = (index: number, error: unknown) =>
    Object.assign(new Error(`Operation ${index + 1}: ${errorMessage(error)}`), {
        operation: index
    });

/**
 * What a batch would add to `document`, change and delete, each record read back
 * as saved documents are, with its references resolved. Throws, naming the
 * operation, at the first that is invalid.
 */
function stage(document: Document, operations: Operation[], newId: () => string): StagedBatch {
    if (operations.length === 0) {
        throw new Error('The batch has no operations.');
    }

    const declared = new Map<string, { index: number; collection: Referable }>();
    const ids = new Map<string, string>();
    /** The operation changing each record of the document, by collection and ID. */
    const changed = new Map<string, number>();
    const deleted = new Map<string, number>();
    const record = (collection: Changeable, id: string) => `${collection} ${id}`;
    /** Whether a shape is locked, by itself or what holds it; read on the store's plain values. */
    const shapeLocked = (id: string) =>
        document.locked ||
        document.shapes[id].locked ||
        [
            ...Object.values(document.groups),
            ...Object.values(document.layers),
            ...Object.values(document.components)
        ].some((container) => container.locked && container.shapesIds.includes(id));

    /** Notes the records an operation changes, each the document's, unlocked and changed once. */
    const change = (operation: Operation, index: number) => {
        const [collection, refs] = changedRecords(operation) ?? ['shapes', []];

        if (operation.op === 'deleteShapes' && refs.length === 0) {
            throw problem(index, 'it deletes no shapes.');
        }
        refs.forEach((ref) => {
            const earlier = changed.get(record(collection, ref));

            if (!Object.hasOwn(document[collection], ref)) {
                throw problem(index, `${ref} is not in the document's ${collection}.`);
            }
            if (earlier !== undefined) {
                throw problem(index, `${ref} is changed by operation ${earlier + 1} already.`);
            }
            if (
                (collection === 'shapes' && shapeLocked(ref)) ||
                (collection === 'groups' && document.groups[ref].locked)
            ) {
                throw problem(index, `${ref} is locked.`);
            }
            changed.set(record(collection, ref), index);
            if (isDeletion(operation)) {
                deleted.set(record(collection, ref), index);
            }
        });
    };

    operations.forEach((operation, index) => {
        change(operation, index);

        const declaration = declaredKey(operation);

        if (!declaration) {
            return;
        }
        const [key, collection] = declaration;

        if (declared.has(key) || Object.hasOwn(document[collection], key)) {
            throw problem(index, `the key ${key} is taken.`);
        }
        declared.set(key, { index, collection });
        if (operation.op !== 'addShape') {
            ids.set(key, operation.op === 'addVariable' ? newId() : key);
        }
    });

    const reference = (ref: string, collection: Referable, index: number) => {
        const entry = declared.get(ref);

        if (entry?.collection !== collection) {
            const deletedBy =
                collection === 'components' ? undefined : deleted.get(record(collection, ref));

            if (deletedBy !== undefined) {
                throw new Error(`${ref} is deleted by operation ${deletedBy + 1}.`);
            }
            if (Object.hasOwn(document[collection], ref)) {
                return ref;
            }
            throw new Error(`${ref} is not in the document's ${collection}.`);
        }

        const id = ids.get(ref);

        if (entry.index >= index || id === undefined) {
            throw new Error(`${ref} is not one of the batch's earlier ${collection}.`);
        }

        return id;
    };
    const remapTemplate = (template: string) =>
        replaceTemplateIds(template, (key) =>
            declared.get(key)?.collection === 'variables' ? ids.get(key) : undefined
        );

    let variables: Record<string, Variable> = { ...document.variables };
    const components: Record<string, Component> = { ...document.components };
    const staged: Staged = {
        variables: [],
        components: [],
        shapes: [],
        groups: [],
        updatedVariables: [],
        deletedVariables: [],
        updatedShapes: [],
        deletedShapes: [],
        deletedGroups: []
    };

    /** Writes into `shape` the variables it follows and its template, and resolves its references. */
    const linkShape = (shape: Shape, input: ShapeInput, index: number) => {
        delete shape.bindings;
        Object.entries(input.bindings ?? {}).forEach(([key, ref]) => {
            const property = bindableProperty(key);
            const variable = variables[reference(ref, 'variables', index)];

            if (!property || variable.type !== property.kind) {
                throw new Error(`${key} cannot follow the ${variable.type} variable ${ref}.`);
            }
            applyProperty(property, shape, resolveVariable(variable, variables));
            shape.bindings = { ...shape.bindings, [key]: variable.id };
        });

        if (shape.type === 'text' && input.type === 'text' && input.template !== undefined) {
            delete shape.template;
            writeText(shape, remapTemplate(input.template), variables);
        }
        if (shape.type !== 'instance') {
            return;
        }
        shape.componentId = reference(shape.componentId, 'components', index);
        const props = components[shape.componentId].props ?? [];

        shape.overrides = Object.fromEntries(
            Object.entries(shape.overrides).map(([id, value]) => {
                if (!props.some((prop) => prop.id === id)) {
                    throw new Error(`${id} is not a prop of the component ${shape.componentId}.`);
                }
                if (typeof value === 'object') {
                    return [id, { variableId: reference(value.variableId, 'variables', index) }];
                }

                return [id, typeof value === 'string' ? remapTemplate(value) : value];
            })
        );
    };

    const updateVariable = (
        { variable: id, name, value, alias, darkValue }: UpdateVariable,
        index: number
    ) => {
        const current = variables[id];
        const other = name === undefined ? undefined : variableNamed(variables, name);

        if (
            name === undefined &&
            value === undefined &&
            alias === undefined &&
            darkValue === undefined
        ) {
            throw new Error('it changes nothing.');
        }
        if (other && other.id !== id) {
            throw new Error(`the name ${name} is taken.`);
        }
        if (darkValue !== undefined && current.type !== 'color') {
            throw new Error('Only colors can vary by Theme.');
        }
        const resolved = resolveVariable(current, variables);
        // A value of either theme set without a source stops following, as alias null does.
        const source =
            alias === undefined && value === undefined && darkValue === undefined
                ? current.alias
                : typeof alias === 'string'
                  ? reference(alias, 'variables', index)
                  : undefined;
        const detaches = current.alias !== undefined && source === undefined;
        const fallback =
            alias === undefined && !detaches
                ? current.values.default
                : current.type === 'text'
                  ? escapeTemplate(String(resolved))
                  : resolved;
        const variable = readEntity('variables', {
            id,
            ...(source === undefined ? {} : { alias: source }),
            name: name ?? current.name,
            type: current.type,
            values: {
                ...(current.type === 'color'
                    ? {
                          dark: detaches
                              ? resolveVariable(current, variables, 'dark')
                              : current.values.dark
                      }
                    : {}),
                ...(darkValue === undefined
                    ? {}
                    : { dark: darkValue === null ? undefined : darkValue }),
                default:
                    value === undefined
                        ? fallback
                        : current.type === 'text' && typeof value === 'string'
                          ? remapTemplate(value)
                          : value
            }
        });

        variables[id] = variable;
        staged.updatedVariables.push(variable);
    };

    operations.forEach((operation, index) => {
        if (operation.op === 'updateVariable' || operation.op === 'deleteVariable') {
            try {
                if (operation.op === 'updateVariable') {
                    updateVariable(operation, index);

                    return;
                }
                delete variables[operation.variable];
                staged.deletedVariables.push(operation.variable);

                return;
            } catch (error) {
                throw problem(index, error);
            }
        }
        if (operation.op !== 'addVariable') {
            return;
        }
        try {
            if (variableNamed(variables, operation.name)) {
                throw new Error(`the name ${operation.name} is taken.`);
            }
            const value =
                operation.type === 'text' && typeof operation.value === 'string'
                    ? remapTemplate(operation.value)
                    : operation.value;
            const variable = readEntity('variables', {
                id: ids.get(operation.key),
                name: operation.name,
                type: operation.type,
                values: {
                    default: value,
                    ...(operation.darkValue === undefined ? {} : { dark: operation.darkValue })
                },
                ...(operation.alias === undefined
                    ? {}
                    : { alias: reference(operation.alias, 'variables', index) })
            });

            variables[variable.id] = variable;
            staged.variables.push(variable);
        } catch (error) {
            throw problem(index, error);
        }
    });

    // Check the final graph too: two individually valid updates can form a cycle.
    operations.forEach((operation, index) => {
        if (
            (operation.op !== 'addVariable' && operation.op !== 'updateVariable') ||
            typeof operation.alias !== 'string'
        ) {
            return;
        }
        const id = operation.op === 'addVariable' ? ids.get(operation.key)! : operation.variable;
        const issue = variableProblems(variables[id], variables)[0];
        if (issue) {
            throw problem(index, issue);
        }
    });

    // Project only the shapes being updated; validation must not mutate the document.
    let projected: Pick<Document, 'variables' | 'shapes'> | undefined;

    if (staged.updatedVariables.length > 0 || staged.deletedVariables.length > 0) {
        projected = {
            variables: structuredClone(json(document.variables)),
            shapes: Object.fromEntries(
                operations
                    .filter((operation) => operation.op === 'updateShape')
                    .map(({ shape }) => [shape, structuredClone(json(document.shapes[shape]))])
            )
        };
        writeVariables(
            projected,
            structuredClone({
                variables: staged.variables,
                updatedVariables: staged.updatedVariables,
                deletedVariables: staged.deletedVariables
            })
        );
        variables = projected.variables;
    }

    let namer: { taken: Set<string>; nameShape: (type: Shape['type']) => string } | undefined;
    let grouped: Set<string> | undefined;
    const top = document.shapesIds[document.shapesIds.length - 1];
    let order = top ? document.shapes[top].order : null;

    /** Names a shape added without one, as `addShape` does; only such shapes need the names. */
    const nameShape = (input: ShapeInput) => {
        if (!namer) {
            const shapes = [...Object.values(document.shapes), ...staged.shapes];

            namer = {
                taken: new Set(shapes.map(({ name }) => name)),
                nameShape: shapeNamer(shapes)
            };
        }
        const component = input.type === 'instance' ? components[input.componentId] : undefined;
        const name = component
            ? instanceName(component.name, namer.taken)
            : namer.nameShape(input.type);

        namer.taken.add(name);

        return name;
    };

    const stageShape = ({ key, shape: input }: AddShape, index: number) => {
        const name = input.name ?? nameShape(input);

        order = orderAbove(order);
        const shape = createShape({ ...input, name, order, selected: false });

        linkShape(shape, input, index);
        if (shape.parentShapeId !== undefined) {
            shape.parentShapeId = reference(shape.parentShapeId, 'shapes', index);
        }
        readEntity('shapes', shape);
        namer?.taken.add(name);
        ids.set(key, shape.id);
        staged.shapes.push(shape);
    };

    /**
     * Stages the fields an update leaves different from the shape, keeping the
     * bindings not explicitly replaced that still hold after the batch's variables change.
     */
    const stageShapeUpdate = ({ shape: id, changes }: UpdateShape, index: number) => {
        const fields = Object.keys(changes);
        const fixed = fields.find((field) => !CHANGEABLE_FIELDS.has(field));

        if (fields.length === 0) {
            throw new Error('it changes nothing.');
        }
        if (fixed) {
            throw new Error(`its ${fixed} cannot change.`);
        }
        const current = projected?.shapes[id] ?? document.shapes[id];
        const shape = structuredClone(json(current));
        unbindEditedProperties(shape, fields);
        const bindings = shape.bindings ?? {};
        Object.assign(shape, structuredClone(changes));
        const kept = Object.entries(bindings).filter(([key, variableId]) => {
            const property = bindableProperty(key);
            const variable = variables[variableId];

            if (!property || !variable) {
                return false;
            }
            const value = resolveVariable(variable, variables);

            return !accepts(property, value) || bindingHolds(property, shape, value);
        });

        linkShape(
            shape,
            {
                ...changes,
                type: current.type,
                bindings: { ...Object.fromEntries(kept), ...changes.bindings }
            } as ShapeInput,
            index
        );
        if (shape.type === 'text' && 'value' in changes && changes.template === undefined) {
            delete shape.template;
        }
        const read: Record<string, unknown> = readEntity('shapes', shape);
        const foreign = fields.find(
            (field) => field !== 'bindings' && field !== 'template' && !(field in read)
        );

        if (foreign) {
            throw new Error(`a ${current.type} has no ${foreign}.`);
        }
        const before = new Map(Object.entries(json(current)));
        const written = [...new Set([...Object.keys(read), 'bindings', 'template'])].filter(
            (field) => JSON.stringify(read[field]) !== JSON.stringify(before.get(field))
        );

        staged.updatedShapes.push({
            id,
            fields: Object.fromEntries(written.map((field) => [field, read[field]]))
        });
    };

    const stageComponent = (component: Component, index: number) => {
        const copy = hydrateComponent(readEntity('components', json(component)));
        const sourceShapes = copy.sourceShapes ?? {};

        if (!copy.sourceShapes || copy.shapesIds.some((id) => !Object.hasOwn(sourceShapes, id))) {
            throw new Error('its shapes are not all among its source shapes.');
        }
        if (copy.parentId !== undefined) {
            reference(copy.parentId, 'components', index);
        }
        if (copy.props?.some((prop) => !copy.shapesIds.includes(prop.shapeId))) {
            throw new Error('a prop names a shape outside the component.');
        }
        Object.values(sourceShapes).forEach((shape) => linkShape(shape, { ...shape }, index));
        readEntity('components', copy);
        components[copy.id] = copy;
        staged.components.push(copy);
    };

    const stageGroup = (name: string, rotation: number, refs: string[], index: number) => {
        const shapesIds = [...new Set(refs.map((ref) => reference(ref, 'shapes', index)))];

        if (shapesIds.length < 2) {
            throw new Error('a group needs two shapes.');
        }
        const inGroups = (grouped ??= new Set(
            Object.values(document.groups)
                .filter((group) => !deleted.has(record('groups', group.id)))
                .flatMap((group) => group.shapesIds)
        ));

        if (shapesIds.some((id) => inGroups.has(id))) {
            throw new Error('a shape is in another group already.');
        }
        if (new Set(shapesIds.map((id) => shapeLayer(document, id)?.id)).size > 1) {
            throw new Error('a group needs shapes on the same layer.');
        }
        const group = createGroup({ name, rotation, shapesIds });

        readEntity('groups', group);
        shapesIds.forEach((id) => inGroups.add(id));
        staged.groups.push(group);
    };

    operations.forEach((operation, index) => {
        try {
            switch (operation.op) {
                case 'addVariable':
                case 'updateVariable':
                case 'deleteVariable':
                    return;
                case 'updateShape':
                    return stageShapeUpdate(operation, index);
                case 'deleteShapes':
                    staged.deletedShapes.push(...operation.shapes);
                    return;
                case 'deleteGroup':
                    staged.deletedGroups.push(operation.group);
                    return;
                case 'addComponent':
                    return stageComponent(operation.component, index);
                case 'addShape':
                    return stageShape(operation, index);
                case 'addGroup':
                    return stageGroup(operation.name, operation.rotation, operation.shapes, index);
            }
        } catch (error) {
            throw problem(index, error);
        }
    });

    const gone = new Set(staged.deletedShapes);
    const instantiated = new Set(
        [...Object.values(document.shapes), ...staged.shapes].flatMap((shape) =>
            shape.type === 'instance' && !gone.has(shape.id) ? [shape.componentId] : []
        )
    );

    Object.values(document.components).forEach((component) => {
        if (
            component.shapesIds.length > 0 &&
            component.shapesIds.every((id) => gone.has(id)) &&
            instantiated.has(component.id)
        ) {
            const index = Math.max(
                ...component.shapesIds.map((id) => deleted.get(record('shapes', id))!)
            );

            throw problem(
                index,
                `the component ${component.id} has instances, so it keeps a shape.`
            );
        }
    });

    return { ...staged, ids: Object.fromEntries(ids) };
}

/**
 * What a batch of operations would do to `document`, all of it checked, or the
 * first problem, naming the operation. `newId` gives the IDs of what it adds.
 */
export function stageBatch(
    document: Document,
    operations: Operation[],
    newId: () => string
): { valid: true; staged: StagedBatch } | Extract<OperationsCheck, { valid: false }> {
    try {
        return { valid: true, staged: stage(document, operations, newId) };
    } catch (error) {
        const operation: unknown = Reflect.get(Object(error), 'operation');

        return {
            valid: false,
            problem: errorMessage(error),
            ...(typeof operation === 'number' ? { operation } : {})
        };
    }
}

/** Applies the same variable changes to a projection as to the accepted document. */
function writeVariables(
    document: Pick<Document, 'variables' | 'shapes'>,
    staged: Pick<Staged, 'variables' | 'updatedVariables' | 'deletedVariables'>
) {
    const variablesChange =
        staged.updatedVariables.length > 0 || staged.deletedVariables.length > 0;
    const before = variablesChange ? structuredClone(json(document.variables)) : {};

    staged.variables.forEach((variable) => {
        document.variables[variable.id] = variable;
    });
    staged.updatedVariables.forEach((variable) => {
        document.variables[variable.id] = variable;
    });
    staged.deletedVariables.forEach((id) => removeVariable(document, id));
    if (variablesChange) {
        applyVariableChanges(document, before);
    }
}

/**
 * Writes a staged batch into its document. Variables change first, writing into
 * the shapes what they make them, as in the editor; then shapes change, records
 * are added, and then deleted. Added shapes go on top.
 */
export function writeBatch(document: Document, staged: Staged) {
    writeVariables(document, staged);
    staged.components.forEach((component) => {
        document.components[component.id] = component;
    });
    staged.updatedShapes.forEach(({ id, fields }) => {
        const shape = document.shapes[id];
        const geometry = shapeGeometryKey(shape);

        Object.entries(fields).forEach(([field, value]) => {
            if (value === undefined) {
                Reflect.deleteProperty(shape, field);

                return;
            }
            Reflect.set(shape, field, value);
        });
        if (shapeGeometryKey(shape) !== geometry) {
            delete shape.bounds;
        }
    });
    staged.shapes.forEach((shape) => {
        document.shapes[shape.id] = shape;
        document.shapesIds.push(shape.id);
    });
    staged.groups.forEach((group) => {
        document.groups[group.id] = group;
    });
    staged.deletedGroups.forEach((id) => {
        delete document.groups[id];
    });

    const emptied = containersHolding(document.groups, staged.deletedShapes);

    staged.deletedShapes.forEach((id) => deleteShape(document, id));
    emptied
        .filter((group) => group.shapesIds.length === 0)
        .forEach((group) => delete document.groups[group.id]);
    [...staged.shapes, ...staged.updatedShapes].forEach(({ id }) => {
        const shape = document.shapes[id];

        if (shape.type !== 'instance') {
            return;
        }
        const source = componentSource(document, shape.componentId);

        if (source) {
            shape.bounds = instanceBox(shape, source);
        }
    });
}
