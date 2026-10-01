import type { Shape, ShapeInput } from './types';
import { shapeGeometry } from './utils';
import { readCopiedShape } from './services/documentStorage';

/** Marks clipboard text as shapes copied from the editor. */
const CLIPBOARD_FORMAT = 'reactor/shapes';

/** Copied shapes as clipboard text: what each draws, its name, description and rotation. */
export function writeClipboard(shapes: Shape[]): string {
    return JSON.stringify({
        format: CLIPBOARD_FORMAT,
        shapes: shapes.map((shape) => ({
            ...shapeGeometry(shape),
            name: shape.name,
            rotation: shape.rotation,
            ...(shape.description === undefined ? {} : { description: shape.description })
        }))
    });
}

/** The shapes clipboard text holds; none when it holds anything else or any is invalid. */
export function readClipboard(text: string): ShapeInput[] {
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
            return [];
        }

        return data.shapes.map(readCopiedShape);
    } catch {
        return [];
    }
}
