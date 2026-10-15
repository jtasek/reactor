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
import type { AddGroup, AddShape, Batch, BatchResult, Operation } from '../operations';
import { createGroup, createShape, instanceName, shapeNamer } from '../factories';
import { orderAbove } from '../drawOrder';
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
    ids: Record<string, string>;
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

const problem = (index: number, error: unknown) =>
    new Error(`Operation ${index + 1}: ${error instanceof Error ? error.message : String(error)}`);

/**
 * The records a batch would add to `document`, each read back as saved documents
 * are, with its references resolved. Throws, naming the operation, at the first
 * that is invalid.
 */
function stageOperations(document: Document, operations: Operation[], newId: () => string): Staged {
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
            throw new Error(`Operation ${index + 1}: the key ${key} is taken.`);
        }
        declared.set(key, { index, collection });
        if (operation.op !== 'addShape') {
            ids.set(key, operation.op === 'addVariable' ? newId() : key);
        }
    });

    const reference = (ref: string, collection: Referable, index: number) => {
        const entry = declared.get(ref);

        if (!entry) {
            if (Object.hasOwn(document[collection], ref)) {
                return ref;
            }
            throw new Error(`${ref} is not in the document's ${collection}.`);
        }

        const id = ids.get(ref);

        if (entry.collection !== collection || entry.index >= index || id === undefined) {
            throw new Error(`${ref} is not one of the batch's earlier ${collection}.`);
        }

        return id;
    };
    const remapTemplate = (template: string) =>
        replaceTemplateIds(template, (key) =>
            declared.get(key)?.collection === 'variables' ? ids.get(key) : undefined
        );

    const variables: Record<string, Variable> = { ...document.variables };
    const staged: Staged = { variables: [], components: [], shapes: [], groups: [], ids: {} };

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
        shape.overrides = Object.fromEntries(
            Object.entries(shape.overrides).map(([id, value]) => {
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

    const shapes = Object.values(document.shapes);
    const taken = new Set(shapes.map((shape) => shape.name));
    const nameShape = shapeNamer(shapes);
    const components: Record<string, Component> = { ...document.components };
    const grouped = new Set(Object.values(document.groups).flatMap((group) => group.shapesIds));
    const top = document.shapesIds[document.shapesIds.length - 1];
    let order = top ? document.shapes[top].order : null;

    const stageShape = ({ key, shape: input }: AddShape, index: number) => {
        const component = input.type === 'instance' ? components[input.componentId] : undefined;
        const name =
            input.name ?? (component ? instanceName(component.name, taken) : nameShape(input.type));

        order = orderAbove(order);
        const shape = createShape({ ...input, name, order, selected: false });

        linkShape(shape, input, index);
        readEntity('shapes', shape);
        taken.add(name);
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
        if (shapesIds.some((id) => grouped.has(id))) {
            throw new Error('a shape is in another group already.');
        }
        const group = createGroup({ name, rotation, shapesIds });

        readEntity('groups', group);
        shapesIds.forEach((id) => grouped.add(id));
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

    staged.ids = Object.fromEntries(ids);

    return staged;
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

    let staged: Staged;

    try {
        staged = stageOperations(untracked(document), batch.operations, effects.newId);
    } catch (error) {
        return { applied: false, problem: error instanceof Error ? error.message : String(error) };
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

    return { applied: true, ids: staged.ids };
};
