import type { AddGroup, AddShape, AddVariable } from 'src/app/operations';
import { readCopiedShape } from 'src/app/services/documentStorage';
import { isVariableType } from 'src/app/variables';

/** The operations a model may propose. */
export type ProposedOperation = AddVariable | AddShape | AddGroup;

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
                value: operation.value
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
        case 'addGroup': {
            const shapes = operation.shapes;

            if (!Array.isArray(shapes)) {
                throw new Error('Its shapes are not a list.');
            }

            return {
                op: 'addGroup',
                name: text(operation.name, 'Its name'),
                rotation: typeof operation.rotation === 'number' ? operation.rotation : 0,
                shapes: shapes.map((shape) => text(shape, 'A shape'))
            };
        }
        default:
            throw new Error(`${String(operation.op)} is not an operation.`);
    }
}
