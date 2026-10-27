import { initialScreenView } from './screenViewMigration';
import {
    acceptsFrameNumber,
    FRAME_NUMBER_KEYS,
    frameNumber,
    writeFrameNumber,
    updateFrameVariables
} from './frameVariables';
import { isScreenDefinition } from './screenViews';
import { frameLayout, hasLayoutOffset } from './frameLayout';
import {
    initializeStackOrder,
    releaseStackPositions,
    materializeGroupPlacement
} from './stackEdits';
import { frameParents, projectFrameStates } from './frameState';
import { deleteFrame, validFrameParent, frameContents, frameMoveProblem } from './frameMembership';
import { legacyTheme, readDimension } from './variableModes';
import { json } from 'overmind';
import type {
    Frame,
    Component,
    Document,
    Group,
    Point,
    Shape,
    ShapeInput,
    Variable,
    VariableDimension
} from './types';
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
    unbindMovedProperties,
    writeText
} from './variables';
import { resolveVariable, variableProblems, variableDefinition } from './variableResolver';
import { componentSource, instanceBox } from './componentSource';
import { hydrateComponent, readEntity } from './services/documentStorage';
import { shapeGeometryKey, shapeGeometry } from './utils';
import { translateShape } from './geometry';

type Referable = 'variables' | 'components' | 'shapes' | 'frames';

/** The records an operation may change or delete. */
type Changeable = 'variables' | 'shapes' | 'groups' | 'frames';

/** The fields of a shape an update may change: those a model may give a shape it adds. */
const CHANGEABLE_FIELDS = new Set([
    'name',
    'parentFrameId',
    'layoutOrder',
    'sizing',
    'interaction',
    'modeOverrides',
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
    frames: Frame[];
    updatedFrames: Frame[];
    deletedFrames: string[];
    dimensions: VariableDimension[];
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
        case 'addFrame':
            return [operation.key, 'frames'];
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
        case 'updateFrame':
        case 'deleteFrame':
            return ['frames', [operation.frame]];
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
    operation.op === 'deleteFrame' ||
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

    const frameStates = projectFrameStates(document.frames);
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
        frameStates[document.shapes[id].parentFrameId ?? '']?.lockedBy !== undefined ||
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
                (collection === 'groups' &&
                    (document.groups[ref].locked ||
                        document.groups[ref].shapesIds.some(
                            (id) =>
                                frameStates[document.shapes[id]?.parentFrameId ?? '']?.lockedBy !==
                                undefined
                        ))) ||
                (collection === 'frames' &&
                    (document.locked || frameStates[ref]?.lockedBy !== undefined))
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
            ids.set(
                key,
                operation.op === 'addVariable' || operation.op === 'addFrame' ? newId() : key
            );
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
    const frameReference = (ref: string, index: number) => {
        const id = reference(ref, 'frames', index);

        if (
            document.frames[id]?.kind === 'view' ||
            staged.frames.some((frame) => frame.id === id && frame.kind === 'view')
        ) {
            throw new Error(`${ref} is a screen view, not a container.`);
        }

        if (frameStates[id]?.lockedBy !== undefined) {
            throw new Error(`${ref} is locked.`);
        }

        return id;
    };
    const remapTemplate = (template: string) =>
        replaceTemplateIds(template, (key) =>
            declared.get(key)?.collection === 'variables' ? ids.get(key) : undefined
        );

    let variables: Record<string, Variable> = { ...document.variables };
    const components: Record<string, Component> = { ...document.components };
    const dimensions = { ...document.dimensions };
    const staged: Staged = {
        frames: [],
        updatedFrames: [],
        deletedFrames: [],
        dimensions: [],
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

    const dimensionIds = new Set<string>();
    operations.forEach((operation, index) => {
        if (operation.op !== 'setDimension') return;
        try {
            const dimension = readDimension(operation.dimension);
            if (dimensionIds.has(dimension.id)) throw new Error('Dimension changed twice.');
            dimensionIds.add(dimension.id);
            const before = dimensions[dimension.id];
            if (
                before &&
                before.defaultModeId !== dimension.defaultModeId &&
                Object.values(variables).some(
                    (variable) =>
                        (variable.type === 'color' || variable.type === 'number') &&
                        variable.dimensionId === dimension.id &&
                        !operations.some(
                            (op) => op.op === 'updateVariable' && op.variable === variable.id
                        )
                )
            )
                throw new Error(
                    'Changing the default requires updating every variable in the dimension. Import separately instead.'
                );
            dimensions[dimension.id] = dimension;
            staged.dimensions.push(dimension);
        } catch (error) {
            throw problem(index, error);
        }
    });

    /** Adds a copied dimension; one this document already has, as edited here, is kept. */
    const addDimension = (input: VariableDimension) => {
        const dimension = readDimension(input);
        const existing = dimensions[dimension.id];
        if (existing) return existing;
        dimensions[dimension.id] = dimension;
        staged.dimensions.push(dimension);
        return dimension;
    };
    const checkModes = (dimensionId: string | undefined, values: Record<string, unknown>) => {
        const modes = Object.keys(values).filter((key) => key !== 'default');
        if (modes.length === 0) return;
        const dimension = dimensionId === undefined ? undefined : dimensions[dimensionId];
        if (!dimension) throw new Error('Mode values need an existing dimension.');
        if (modes.some((key) => !dimension.modes[key])) throw new Error('Unknown mode.');
        if (modes.includes(dimension.defaultModeId))
            throw new Error('The default mode uses the base value.');
    };

    const linkFrameBindings = (frame: Frame, index: number, previous?: Frame) => {
        const bindings = Object.fromEntries(
            Object.entries(frame.bindings ?? {}).map(([key, ref]) => [
                key,
                previous?.bindings?.[key] === ref && !variables[ref]
                    ? ref
                    : reference(ref, 'variables', index)
            ])
        );
        frame.bindings = bindings;

        FRAME_NUMBER_KEYS.forEach((key) => {
            const id = bindings[key];

            if (!id) {
                return;
            }

            const variable = variables[id];
            const value = variable && resolveVariable(variable, variables);

            if (
                variable?.type === 'number' &&
                typeof value === 'number' &&
                acceptsFrameNumber(frame, key, value)
            ) {
                writeFrameNumber(frame, key, value);

                return;
            }

            if (previous?.bindings?.[key] === id) {
                return;
            }

            throw new Error(
                `A ${key} binding needs a compatible number variable and fixed sizing.`
            );
        });
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
        {
            variable: id,
            name,
            value,
            alias,
            darkValue,
            dimensionId,
            modeValues,
            source: packageSource
        }: UpdateVariable,
        index: number
    ) => {
        const current = variables[id];

        if (
            name === undefined &&
            value === undefined &&
            alias === undefined &&
            darkValue === undefined &&
            dimensionId === undefined &&
            modeValues === undefined
        ) {
            throw new Error('it changes nothing.');
        }
        if (
            (darkValue !== undefined && current.type !== 'color') ||
            ((dimensionId !== undefined || modeValues !== undefined) &&
                current.type !== 'color' &&
                current.type !== 'number')
        ) {
            throw new Error('Only colors and numbers can vary by a dimension.');
        }
        const resolved = resolveVariable(current, variables);
        // A value of either theme set without a source stops following, as alias null does.
        const source =
            alias === undefined &&
            value === undefined &&
            darkValue === undefined &&
            dimensionId === undefined &&
            modeValues === undefined
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
        const definition = detaches ? variableDefinition(current, variables) : current;
        const selectedDimension =
            dimensionId === null
                ? undefined
                : (dimensionId ??
                  (definition.type === 'color' || definition.type === 'number'
                      ? definition.dimensionId
                      : undefined) ??
                  (darkValue !== undefined ? 'theme' : undefined));
        if (darkValue !== undefined && !dimensions.theme) addDimension(legacyTheme());
        const values = {
            ...(dimensionId === undefined ? definition.values : {}),
            default:
                value === undefined
                    ? fallback
                    : current.type === 'text' && typeof value === 'string'
                      ? remapTemplate(value)
                      : value
        } as Record<string, unknown>;
        const overrides = {
            ...modeValues,
            ...(darkValue === undefined ? {} : { dark: darkValue })
        };
        if (Object.hasOwn(overrides, 'default'))
            throw new Error('Use value to edit the base value.');
        for (const [modeId, override] of Object.entries(overrides)) {
            if (override === null) delete values[modeId];
            else values[modeId] = override;
        }
        checkModes(selectedDimension, values);
        const variable = readEntity('variables', {
            id,
            source: packageSource ?? current.source,
            name: name ?? current.name,
            type: current.type,
            values,
            ...(selectedDimension === undefined ? {} : { dimensionId: selectedDimension }),
            ...(source === undefined ? {} : { alias: source })
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
            const value =
                operation.type === 'text' && typeof operation.value === 'string'
                    ? remapTemplate(operation.value)
                    : operation.value;
            // A pasted variable takes the modes this document's copy of its dimension has.
            const pasted = operation.dimension && addDimension(operation.dimension);
            if (operation.darkValue !== undefined && !dimensions.theme) addDimension(legacyTheme());
            if (operation.modeValues && Object.hasOwn(operation.modeValues, 'default'))
                throw new Error('Use value to edit the base value.');
            const dimensionId =
                operation.dimensionId ??
                pasted?.id ??
                (operation.darkValue === undefined ? undefined : 'theme');
            const values = {
                ...(pasted
                    ? Object.fromEntries(
                          Object.entries(operation.modeValues ?? {}).filter(
                              ([modeId]) =>
                                  Object.hasOwn(pasted.modes, modeId) &&
                                  modeId !== pasted.defaultModeId
                          )
                      )
                    : operation.modeValues),
                default: value,
                ...(operation.darkValue === undefined ? {} : { dark: operation.darkValue })
            };
            checkModes(dimensionId, values);
            const variable = readEntity('variables', {
                id: ids.get(operation.key),
                source: operation.source,
                name: operation.name,
                type: operation.type,
                dimensionId,
                values,
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

    // Names must be unique in the final batch, not in temporary states while swapping them.
    operations.forEach((operation, index) => {
        if (operation.op === 'setDimension') {
            const dimension = dimensions[operation.dimension.id];
            if (
                Object.values(dimensions).some(
                    (other) => other.id !== dimension.id && other.name === dimension.name
                )
            )
                throw problem(index, `the dimension name ${dimension.name} is taken.`);
        }
        if (operation.op !== 'addVariable' && operation.op !== 'updateVariable') return;
        if (operation.op === 'updateVariable' && operation.name === undefined) return;
        const id = operation.op === 'addVariable' ? ids.get(operation.key)! : operation.variable;
        const variable = variables[id];
        if (
            Object.values(variables).some(
                (other) => other.id !== id && other.name === variable.name
            )
        )
            throw problem(index, `the name ${variable.name} is taken.`);
    });

    if (dimensionIds.size) {
        Object.values(variables).forEach((variable) => {
            if (
                variable.type === 'color' &&
                variable.dimensionId &&
                dimensionIds.has(variable.dimensionId)
            )
                checkModes(variable.dimensionId, variable.values);
        });
    }

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

    // Project explicit updates and frame descendants against the batch's variable changes.
    let projected: Pick<Document, 'variables' | 'shapes'> | undefined;

    if (staged.updatedVariables.length > 0 || staged.deletedVariables.length > 0) {
        projected = {
            variables: structuredClone(json(document.variables)),
            shapes: Object.fromEntries(
                [
                    ...new Set(
                        operations.flatMap((operation) => {
                            if (operation.op === 'updateShape') {
                                return [operation.shape];
                            }

                            if (operation.op === 'updateFrame' && operation.changes.position) {
                                return frameContents(document, operation.frame).shapes;
                            }

                            return [];
                        })
                    )
                ].map((shape) => [shape, structuredClone(json(document.shapes[shape]))])
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
        if (shape.parentFrameId !== undefined) {
            shape.parentFrameId = frameReference(shape.parentFrameId, index);
        }
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
        if ('position' in changes && frameLayout(document).managedShapes.has(id)) {
            throw new Error('Stack placement controls this position.');
        }
        const current = projected?.shapes[id] ?? document.shapes[id];
        if ('interaction' in changes && current.type !== 'instance') {
            throw new Error('Only an instance can declare a role.');
        }
        if ('modeOverrides' in changes && current.type !== 'instance') {
            throw new Error('Only an instance can override color modes.');
        }
        const shape = structuredClone(json(current));
        unbindEditedProperties(shape, fields);
        const bindings = shape.bindings ?? {};
        Object.assign(shape, structuredClone(changes));
        if (shape.type === 'instance' && changes.interaction === null) {
            delete shape.interaction;
        }
        if (changes.parentFrameId === null) {
            delete shape.parentFrameId;
        } else if (changes.parentFrameId !== undefined) {
            shape.parentFrameId = frameReference(changes.parentFrameId, index);
        }
        if (shape.parentFrameId !== current.parentFrameId && changes.layoutOrder === undefined) {
            delete shape.layoutOrder;
        }
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
            (field) =>
                !['bindings', 'template', 'parentFrameId', 'interaction'].includes(field) &&
                !(field in read)
        );

        if (foreign) {
            throw new Error(`a ${current.type} has no ${foreign}.`);
        }
        const before = new Map(Object.entries(json(current)));
        const written = [
            ...new Set([
                ...Object.keys(read),
                'bindings',
                'template',
                'parentFrameId',
                'layoutOrder',
                'interaction'
            ])
        ].filter((field) => JSON.stringify(read[field]) !== JSON.stringify(before.get(field)));

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
        if (
            shapesIds.some(
                (id) =>
                    frameStates[document.shapes[id]?.parentFrameId ?? '']?.lockedBy !== undefined
            )
        ) {
            throw new Error('a shape belongs to a locked frame.');
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
        for (const id of shapesIds.filter(
            (member) =>
                Object.hasOwn(document.shapes, member) && hasLayoutOffset(document, [member])
        )) {
            if (shapeLocked(id) || changed.has(record('shapes', id))) {
                throw new Error(
                    'A group must not also change a locked or already edited layout member.'
                );
            }
            changed.set(record('shapes', id), index);
        }
        const group = createGroup({ name, rotation, shapesIds });

        readEntity('groups', group);
        shapesIds.forEach((id) => inGroups.add(id));
        staged.groups.push(group);
    };

    operations.forEach((operation, index) => {
        try {
            switch (operation.op) {
                case 'addFrame': {
                    if (document.locked) {
                        throw new Error('The document is locked.');
                    }
                    const frame = readEntity('frames', {
                        ...operation.frame,
                        id: ids.get(operation.key)
                    });
                    linkFrameBindings(frame, index);
                    if (frame.parentFrameId !== undefined) {
                        frame.parentFrameId = frameReference(frame.parentFrameId, index);
                    }
                    if (frame.kind === 'view' && frame.screenId) {
                        frame.screenId = reference(frame.screenId, 'frames', index);
                    }
                    staged.frames.push(frame);
                    return;
                }
                case 'updateFrame': {
                    const allowed = new Set([
                        'kind',
                        'name',
                        'position',
                        'size',
                        'parentFrameId',
                        'layoutOrder',
                        'sizing',
                        'modeOverrides',
                        'bindings',
                        'stack'
                    ]);
                    if (Object.keys(operation.changes).some((key) => !allowed.has(key))) {
                        throw new Error('Unsupported frame field.');
                    }
                    const parent = operation.changes.parentFrameId;
                    const frame = readEntity('frames', {
                        ...json(document.frames[operation.frame]),
                        ...operation.changes,
                        ...(parent === null ? { parentFrameId: undefined } : {}),
                        ...(operation.changes.stack === null ? { stack: undefined } : {})
                    });
                    const previous = document.frames[operation.frame];

                    if (operation.changes.bindings !== undefined) {
                        linkFrameBindings(frame, index, previous);
                    } else {
                        FRAME_NUMBER_KEYS.forEach((key) => {
                            if (
                                frameNumber(previous, key) !== frameNumber(frame, key) ||
                                !acceptsFrameNumber(frame, key, frameNumber(frame, key) ?? NaN)
                            ) {
                                delete frame.bindings![key];
                            }
                        });
                        updateFrameVariables({ [frame.id]: frame }, variables, document.variables);
                    }
                    if (parent !== undefined && parent !== null) {
                        frame.parentFrameId = frameReference(parent, index);
                    }
                    if (
                        frame.parentFrameId !== document.frames[frame.id].parentFrameId &&
                        operation.changes.layoutOrder === undefined
                    ) {
                        delete frame.layoutOrder;
                    }
                    staged.updatedFrames.push(frame);
                    return;
                }
                case 'deleteFrame':
                    staged.deletedFrames.push(operation.frame);
                    return;
                case 'setDimension':
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

    const parentOfShape = (id: string) => {
        const added = staged.shapes.find((shape) => shape.id === id);
        const update = staged.updatedShapes.find((shape) => shape.id === id);

        if (update && 'parentFrameId' in update.fields) {
            return update.fields.parentFrameId;
        }

        return (added ?? document.shapes[id])?.parentFrameId;
    };
    [...Object.values(document.groups), ...staged.groups].forEach((group) => {
        const parentChange = staged.updatedShapes.find(
            (shape) => group.shapesIds.includes(shape.id) && 'parentFrameId' in shape.fields
        );

        if (
            staged.deletedGroups.includes(group.id) ||
            (!parentChange && !staged.groups.includes(group))
        ) {
            return;
        }

        if (
            new Set(
                group.shapesIds
                    .filter((id) => !staged.deletedShapes.includes(id))
                    .map(parentOfShape)
            ).size > 1
        ) {
            const index = parentChange
                ? changed.get(record('shapes', parentChange.id))!
                : operations.findIndex((op) => op.op === 'addGroup');
            throw problem(
                index,
                'A group must stay in one frame. Reparent all of its shapes together.'
            );
        }
    });

    /** Moves a frame's subtree by `delta`. A batch must not also edit those records. */
    const moveContents = (frameId: string, delta: Point, index: number) => {
        const contents = frameContents(document, frameId);
        const conflict =
            contents.frames.some((id) => changed.has(record('frames', id))) ||
            contents.shapes.some((id) => changed.has(record('shapes', id)));
        const movementProblem = frameMoveProblem(document, frameId);

        if (conflict || movementProblem) {
            throw problem(
                index,
                movementProblem ??
                    'Moving a frame cannot also edit its descendants in the same batch.'
            );
        }

        contents.frames.forEach((id) => {
            changed.set(record('frames', id), index);
            const child = json(document.frames[id]);
            try {
                staged.updatedFrames.push(
                    readEntity('frames', {
                        ...child,
                        position: { x: child.position.x + delta.x, y: child.position.y + delta.y }
                    })
                );
            } catch (error) {
                throw problem(index, error);
            }
        });
        contents.shapes.forEach((id) => {
            changed.set(record('shapes', id), index);
            const child = structuredClone(json(projected?.shapes[id] ?? document.shapes[id]));
            translateShape(child, delta);
            try {
                readEntity('shapes', child);
            } catch (error) {
                throw problem(index, error);
            }
            unbindMovedProperties(child, delta);
            staged.updatedShapes.push({
                id,
                fields: { ...shapeGeometry(child), bindings: child.bindings }
            });
        });
    };

    // A free frame moves its subtree once. A batch must not also edit those records.
    [...staged.updatedFrames].forEach((frame) => {
        const original = document.frames[frame.id];
        const delta = {
            x: frame.position.x - original.position.x,
            y: frame.position.y - original.position.y
        };

        if (delta.x === 0 && delta.y === 0) {
            return;
        }

        moveContents(frame.id, delta, changed.get(record('frames', frame.id))!);
    });

    // A frame that becomes a root screen turns into a definition drawn through views.
    const framesAfter = {
        ...document.frames,
        ...Object.fromEntries(
            [...staged.frames, ...staged.updatedFrames].map((frame) => [frame.id, frame])
        )
    };
    const parentsAfter = frameParents(framesAfter);
    const parentsBefore = frameParents(document.frames);

    for (const frame of [...staged.frames, ...staged.updatedFrames]) {
        if (
            framesAfter[frame.id] !== frame ||
            !isScreenDefinition(framesAfter, frame.id, parentsAfter) ||
            isScreenDefinition(document.frames, frame.id, parentsBefore)
        ) {
            continue;
        }

        frame.definitionOnly = true;
        const explicitView = [
            ...Object.values(document.frames),
            ...staged.frames,
            ...staged.updatedFrames
        ].some((view) => view.kind === 'view' && view.screenId === frame.id);

        if (!explicitView) {
            staged.frames.push(initialScreenView(frame, newId()));
        }
    }

    const frames = {
        ...document.frames,
        ...Object.fromEntries(
            [...staged.frames, ...staged.updatedFrames].map((frame) => [frame.id, frame])
        )
    };
    operations.forEach((operation, index) => {
        const id =
            operation.op === 'addFrame'
                ? ids.get(operation.key)
                : operation.op === 'updateFrame' && 'parentFrameId' in operation.changes
                  ? operation.frame
                  : undefined;

        if (id !== undefined && !validFrameParent(frames, id, frames[id].parentFrameId)) {
            throw problem(index, 'A frame parent would create a cycle or is missing.');
        }

        if (
            id !== undefined &&
            frames[id].kind === 'view' &&
            frames[frames[id].screenId ?? '']?.kind !== 'screen'
        ) {
            throw problem(index, 'A screen view must reference a screen in this document.');
        }
    });

    for (const screenId of [...staged.deletedFrames]) {
        if (document.frames[screenId]?.kind !== 'screen') {
            continue;
        }

        // A definition's artwork is only seen through its views, so it stays where the first one is.
        const screen = document.frames[screenId];
        const firstView = Object.values(document.frames).find(
            (view) => view.kind === 'view' && view.screenId === screenId
        );
        const contents = frameContents(document, screenId);
        const delta = firstView && {
            x: firstView.position.x - screen.position.x,
            y: firstView.position.y - screen.position.y
        };

        if (
            delta &&
            (delta.x !== 0 || delta.y !== 0) &&
            isScreenDefinition(document.frames, screenId) &&
            !contents.frames.some((id) => staged.deletedFrames.includes(id)) &&
            !contents.shapes.some((id) => staged.deletedShapes.includes(id))
        ) {
            moveContents(screenId, delta, deleted.get(record('frames', screenId)) ?? 0);
        }

        for (const view of Object.values(document.frames)) {
            if (
                view.kind !== 'view' ||
                view.screenId !== screenId ||
                staged.deletedFrames.includes(view.id)
            ) {
                continue;
            }

            const index = deleted.get(record('frames', screenId)) ?? 0;

            if (
                changed.has(record('frames', view.id)) ||
                frameStates[view.id]?.lockedBy !== undefined
            ) {
                throw problem(index, `the screen view ${view.id} is locked or changed separately.`);
            }

            staged.deletedFrames.push(view.id);
        }
    }

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
    staged.groups.forEach((group) => {
        const existing = group.shapesIds.filter((id) => Object.hasOwn(document.shapes, id));
        materializeGroupPlacement(document, existing, document.shapes[existing[0]]?.parentFrameId);
    });
    releaseStackPositions(
        document,
        staged.updatedFrames,
        staged.updatedShapes,
        staged.deletedFrames
    );

    [...staged.frames, ...staged.updatedFrames].forEach((frame) => {
        document.frames[frame.id] = frame;
    });
    staged.dimensions.forEach((dimension) => {
        document.dimensions[dimension.id] = dimension;
    });
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

    staged.deletedFrames.forEach((id) => deleteFrame(document, id));
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
    initializeStackOrder(document, [
        ...staged.frames.map((frame) => frame.id),
        ...staged.updatedFrames.map((frame) => frame.id),
        ...staged.shapes.map((shape) => shape.parentFrameId ?? ''),
        ...staged.updatedShapes.map((shape) => document.shapes[shape.id]?.parentFrameId ?? '')
    ]);
}
