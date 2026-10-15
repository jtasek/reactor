import { json } from 'overmind';
import type {
    ActionWithParamAndResult,
    Component,
    Document,
    Group,
    Shape,
    ShapeInput,
    Variable
} from '../types';
import type {
    AddGroup,
    AddShape,
    Batch,
    BatchResult,
    Operation,
    OperationsCheck
} from '../operations';
import { createGroup, createShape, instanceName, shapeNamer } from '../factories';
import { orderAbove } from '../drawOrder';
import { shapeLayer } from '../membership';
import { applyProperty } from '../properties';
import { untracked } from '../untracked';
import {
    bindableProperty,
    replaceTemplateIds,
    variableNamed,
    variableValue,
    writeText
} from '../variables';
import { componentSource, instanceBox } from '../componentSource';
import { hydrateComponent, readEntity } from '../services/documentStorage';

type Referable = 'variables' | 'components' | 'shapes';

interface Staged {
    variables: Variable[];
    components: Component[];
    shapes: Shape[];
    groups: Group[];
}

const declaredKey = (operation: Exclude<Operation, AddGroup>): [string, Referable] => {
    switch (operation.op) {
        case 'addVariable':
            return [operation.key, 'variables'];
        case 'addComponent':
            return [operation.component.id, 'components'];
        case 'addShape':
            return [operation.key, 'shapes'];
    }
};

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Why an operation of a batch is invalid, with the operation's place in the batch. */
const problem = (index: number, error: unknown) =>
    Object.assign(new Error(`Operation ${index + 1}: ${errorMessage(error)}`), {
        operation: index
    });

/**
 * The records a batch would add to `document`, each read back as saved documents
 * are, with its references resolved. Throws, naming the operation, at the first
 * that is invalid.
 */
function stageOperations(
    document: Document,
    operations: Operation[],
    newId: () => string
): Staged & { ids: Record<string, string> } {
    if (operations.length === 0) {
        throw new Error('The batch has no operations.');
    }

    const declared = new Map<string, { index: number; collection: Referable }>();
    const ids = new Map<string, string>();

    operations.forEach((operation, index) => {
        if (operation.op === 'addGroup') {
            return;
        }
        const [key, collection] = declaredKey(operation);

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

    const variables: Record<string, Variable> = { ...document.variables };
    const components: Record<string, Component> = { ...document.components };
    const staged: Staged = { variables: [], components: [], shapes: [], groups: [] };

    /** Writes into `shape` the variables it follows and its template, and resolves its references. */
    const linkShape = (shape: Shape, input: ShapeInput, index: number) => {
        delete shape.bindings;
        Object.entries(input.bindings ?? {}).forEach(([key, ref]) => {
            const property = bindableProperty(key);
            const variable = variables[reference(ref, 'variables', index)];

            if (!property || variable.type !== property.kind) {
                throw new Error(`${key} cannot follow the ${variable.type} variable ${ref}.`);
            }
            applyProperty(property, shape, variableValue(variable, variables));
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

    operations.forEach((operation, index) => {
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
                values: { default: value }
            });

            variables[variable.id] = variable;
            staged.variables.push(variable);
        } catch (error) {
            throw problem(index, error);
        }
    });

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
            Object.values(document.groups).flatMap((group) => group.shapesIds)
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

    return { ...staged, ids: Object.fromEntries(ids) };
}

/**
 * Applies a batch of operations to a document, all or nothing, as one undo step
 * recorded as made by `batch.by`. Added shapes go on top, unselected.
 */
export const applyOperations: ActionWithParamAndResult<Batch, BatchResult> = (
    { state, effects },
    batch
) => {
    const document = state.documents[batch.documentId];

    if (!document) {
        return { applied: false, problem: `There is no document ${batch.documentId}.` };
    }

    let staged: ReturnType<typeof stageOperations>;

    try {
        staged = stageOperations(untracked(document), batch.operations, effects.newId);
    } catch (error) {
        return { applied: false, problem: errorMessage(error) };
    }

    effects.collaboration.startBatch(batch.documentId, batch.by);
    staged.variables.forEach((variable) => {
        document.variables[variable.id] = variable;
    });
    staged.components.forEach((component) => {
        document.components[component.id] = component;
    });
    staged.shapes.forEach((shape) => {
        document.shapes[shape.id] = shape;
        document.shapesIds.push(shape.id);
    });
    staged.groups.forEach((group) => {
        document.groups[group.id] = group;
    });
    staged.shapes.forEach(({ id }) => {
        const shape = document.shapes[id];

        if (shape.type !== 'instance') {
            return;
        }
        const source = componentSource(document, shape.componentId);

        if (source) {
            shape.bounds = instanceBox(shape, source);
        }
    });

    effects.collaboration.flush();

    return { applied: true, ids: staged.ids };
};

/** Whether a batch would apply to its document, without applying it; else the first problem. */
export const checkOperations: ActionWithParamAndResult<Omit<Batch, 'by'>, OperationsCheck> = (
    { state },
    { documentId, operations }
) => {
    const document = state.documents[documentId];
    let checked = 0;

    if (!document) {
        return { valid: false, problem: `There is no document ${documentId}.` };
    }

    try {
        stageOperations(untracked(document), operations, () => `checked-${checked++}`);
    } catch (error) {
        const operation: unknown = Reflect.get(Object(error), 'operation');

        return {
            valid: false,
            problem: errorMessage(error),
            ...(typeof operation === 'number' ? { operation } : {})
        };
    }

    return { valid: true };
};
