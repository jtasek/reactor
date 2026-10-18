import type {
    AddGroup,
    AddShape,
    AddVariable,
    DeleteGroup,
    DeleteShapes,
    DeleteVariable,
    UpdateShape,
    UpdateVariable
} from 'src/app/operations';
import { readCopiedShape } from 'src/app/services/documentStorage';
import { isVariableType } from 'src/app/variables';

/** The operations a model may propose. */
export type ProposedOperation =
    | AddVariable
    | AddShape
    | AddGroup
    | UpdateVariable
    | DeleteVariable
    | UpdateShape
    | DeleteShapes
    | DeleteGroup;

function fields(value: unknown, what: string): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`${what} is not an object.`);
    }

    return value as Record<string, unknown>;
}

function text(value: unknown, what: string) {
    if (typeof value !== 'string' || value.length === 0) {
        throw new Error(`${what} is not text.`);
    }

    return value;
}

function list(value: unknown, what: string, each: string) {
    if (!Array.isArray(value)) {
        throw new Error(`${what} are not a list.`);
    }

    return value.map((item) => text(item, each));
}

/**
 * Reads an operation a model proposed, which nothing has checked yet, as
 * `applyOperations` takes it. Throws saying what is wrong with it.
 */
export function readOperation(value: unknown): ProposedOperation {
    const operation = fields(value, 'The operation');

    switch (operation.op) {
        case 'addVariable': {
            const type = text(operation.type, 'Its type');

            if (!isVariableType(type)) {
                throw new Error(`${type} is not a type of variable.`);
            }

            return {
                op: 'addVariable',
                key: text(operation.key, 'Its key'),
                name: text(operation.name, 'Its name'),
                type,
                value: operation.value,
                ...(operation.dimensionId === undefined
                    ? {}
                    : { dimensionId: text(operation.dimensionId, 'Its dimension') }),
                ...(operation.modeValues === undefined
                    ? {}
                    : {
                          modeValues: Object.fromEntries(
                              Object.entries(fields(operation.modeValues, 'Its mode values')).map(
                                  ([id, value]) => [id, text(value, 'A mode value')]
                              )
                          )
                      }),
                ...(operation.darkValue === undefined
                    ? {}
                    : { darkValue: text(operation.darkValue, 'Its Dark value') }),
                ...(operation.alias === undefined
                    ? {}
                    : { alias: text(operation.alias, 'Its source') })
            };
        }
        case 'addShape': {
            const shape = fields(operation.shape, 'Its shape');

            if (shape.type === 'image') {
                throw new Error('An image cannot be added this way.');
            }

            const input = readCopiedShape({ name: '', ...shape });

            // Named by the store, as a tool names what it draws.
            if (shape.name === undefined) {
                delete input.name;
            }

            return { op: 'addShape', key: text(operation.key, 'Its key'), shape: input };
        }
        case 'addGroup':
            return {
                op: 'addGroup',
                name: text(operation.name, 'Its name'),
                rotation: typeof operation.rotation === 'number' ? operation.rotation : 0,
                shapes: list(operation.shapes, 'Its shapes', 'A shape')
            };
        case 'updateVariable':
            return {
                op: 'updateVariable',
                variable: text(operation.variable, 'Its variable'),
                ...(operation.name === undefined ? {} : { name: text(operation.name, 'Its name') }),
                ...(operation.value === undefined ? {} : { value: operation.value }),
                ...(operation.dimensionId === undefined
                    ? {}
                    : {
                          dimensionId:
                              operation.dimensionId === null
                                  ? null
                                  : text(operation.dimensionId, 'Its dimension')
                      }),
                ...(operation.modeValues === undefined
                    ? {}
                    : {
                          modeValues: Object.fromEntries(
                              Object.entries(fields(operation.modeValues, 'Its mode values')).map(
                                  ([id, value]) => [
                                      id,
                                      value === null ? null : text(value, 'A mode value')
                                  ]
                              )
                          )
                      }),
                ...(operation.darkValue === undefined
                    ? {}
                    : {
                          darkValue:
                              operation.darkValue === null
                                  ? null
                                  : text(operation.darkValue, 'Its Dark value')
                      }),
                ...(operation.alias === undefined
                    ? {}
                    : {
                          alias:
                              operation.alias === null ? null : text(operation.alias, 'Its source')
                      })
            };
        case 'deleteVariable':
            return { op: 'deleteVariable', variable: text(operation.variable, 'Its variable') };
        case 'updateShape': {
            const changes = fields(operation.changes, 'Its changes');

            if (changes.bindings !== undefined) {
                Object.values(fields(changes.bindings, 'Its bindings')).forEach((variable) =>
                    text(variable, 'A variable')
                );
            }

            // Checked against the shape it changes, which the document holds.
            return { op: 'updateShape', shape: text(operation.shape, 'Its shape'), changes };
        }
        case 'deleteShapes':
            return { op: 'deleteShapes', shapes: list(operation.shapes, 'Its shapes', 'A shape') };
        case 'deleteGroup':
            return { op: 'deleteGroup', group: text(operation.group, 'Its group') };
        default:
            throw new Error(`${String(operation.op)} is not an operation.`);
    }
}
