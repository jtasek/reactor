import type { Group, Shape, ShapeInput } from './types';
import { shapeGeometry } from './utils';
import { readCopiedGroup, readCopiedShape } from './services/documentStorage';

/** What a paste did: added shapes, found none in the text, or waited for the editor. */
export type PasteResult = 'pasted' | 'noShapes' | 'notNow';

/** A copied group: its name, rotation and the positions of its shapes among the copied ones. */
export type CopiedGroup = ReturnType<typeof readCopiedGroup>;

/** What clipboard text holds: shapes, and the groups they form. */
export interface Copied {
    shapes: ShapeInput[];
    groups: CopiedGroup[];
}

/** Marks clipboard text as shapes copied from the editor. */
const CLIPBOARD_FORMAT = 'reactor/shapes';

/**
 * Copied shapes as clipboard text: what each draws, its name, description and
 * rotation, and the `groups` whose shapes are all among them.
 */
export function writeClipboard(shapes: Shape[], groups: Group[] = []): string {
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

    return JSON.stringify({
        format: CLIPBOARD_FORMAT,
        shapes: shapes.map((shape) => ({
            ...shapeGeometry(shape),
            name: shape.name,
            rotation: shape.rotation,
            ...(shape.description === undefined ? {} : { description: shape.description })
        })),
        ...(copiedGroups.length > 0 ? { groups: copiedGroups } : {})
    });
}

/**
 * The shapes and groups clipboard text holds; none when it holds anything else
 * or any of it is invalid.
 */
export function readClipboard(text: string): Copied {
    const nothing = { shapes: [], groups: [] };

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

        const taken = new Set<number>();

        return {
            shapes,
            groups: groupsData.map((group) => readCopiedGroup(group, shapes.length, taken))
        };
    } catch {
        return nothing;
    }
}
