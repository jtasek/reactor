import type { Document } from 'src/app/types';
import { editedBindings } from 'src/app/variables';
import type { ProposedOperation } from './operations';

const quoted = (text: string) => `“${text}”`;

/** What a shape is called in a proposal: its type and name, or the ID the model gave. */
const shapeLabel = (document: Document, id: string) => {
    const shape = document.shapes[id];

    return shape ? `${shape.type} ${quoted(shape.name)}` : quoted(id);
};

const variableLabel = (document: Document, id: string) => {
    const variable = document.variables[id];

    return variable
        ? `${variable.type} variable ${quoted(variable.name)}`
        : `variable ${quoted(id)}`;
};

/**
 * One line saying what a proposed operation adds, changes or deletes in
 * `document`, for the person reviewing the proposal.
 */
export function describeOperation(operation: ProposedOperation, document: Document): string {
    switch (operation.op) {
        case 'addVariable':
            return `Add ${operation.type} variable ${quoted(operation.name)}: ${operation.alias === undefined ? String(operation.value) : `follow ${variableLabel(document, operation.alias)}`}`;
        case 'addShape': {
            const { shape } = operation;
            const named = shape.name ? ` ${quoted(shape.name)}` : '';

            return shape.type === 'text'
                ? `Add text${named}: ${quoted(shape.value)}`
                : `Add ${shape.type}${named}`;
        }
        case 'addGroup':
            return `Group ${operation.shapes.length} shapes as ${quoted(operation.name)}`;
        case 'updateVariable': {
            const { name, value, alias } = operation;
            const renamed = name === undefined ? '' : ` to ${quoted(name)}`;
            const valued = value === undefined ? '' : `: ${String(value)}`;

            const following =
                typeof alias === 'string'
                    ? `; follow ${variableLabel(document, alias)}`
                    : alias === null ||
                        (value !== undefined &&
                            document.variables[operation.variable]?.alias !== undefined)
                      ? '; stops following its source'
                      : '';
            return `Change ${variableLabel(document, operation.variable)}${renamed}${valued}${following}`;
        }
        case 'deleteVariable':
            return `Delete ${variableLabel(document, operation.variable)}`;
        case 'updateShape': {
            const { changes } = operation;
            const texted =
                'value' in changes && typeof changes.value === 'string'
                    ? [`text ${quoted(changes.value)}`]
                    : [];
            const fields = Object.keys(changes).filter((field) => field !== 'value');
            const changed = `Change ${shapeLabel(document, operation.shape)}: ${[...texted, ...fields].join(', ')}`;
            const shape = document.shapes[operation.shape];
            const unfollowed = shape
                ? editedBindings(shape, Object.keys(changes))
                      .filter((key) => !changes.bindings || !(key in changes.bindings))
                      .map((key) => shape.bindings![key])
                : [];

            return unfollowed.length === 0
                ? changed
                : `${changed}; stops following ${[...new Set(unfollowed)]
                      .map((id) => variableLabel(document, id))
                      .join(', ')}`;
        }
        case 'deleteShapes':
            return operation.shapes.length === 1
                ? `Delete ${shapeLabel(document, operation.shapes[0])}`
                : `Delete ${operation.shapes.length} shapes: ${operation.shapes
                      .map((id) => shapeLabel(document, id))
                      .join(', ')}`;
        case 'deleteGroup': {
            const group = document.groups[operation.group];

            return `Ungroup ${quoted(group ? group.name : operation.group)}`;
        }
    }
}
