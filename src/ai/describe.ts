import type { ProposedOperation } from './operations';

const quoted = (text: string) => `“${text}”`;

/** One line saying what a proposed operation adds, for the person reviewing the proposal. */
export function describeOperation(operation: ProposedOperation): string {
    switch (operation.op) {
        case 'addVariable':
            return `Add ${operation.type} variable ${quoted(operation.name)}: ${String(operation.value)}`;
        case 'addShape': {
            const { shape } = operation;
            const named = shape.name ? ` ${quoted(shape.name)}` : '';

            return shape.type === 'text'
                ? `Add text${named}: ${quoted(shape.value)}`
                : `Add ${shape.type}${named}`;
        }
        case 'addGroup':
            return `Group ${operation.shapes.length} shapes as ${quoted(operation.name)}`;
    }
}
