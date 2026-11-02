import type { AddFrame, AddShape } from './operations';
import type { Document } from './types';

/** Local allocation data; never sent to a model or stored in the document. */
export const authoringKeys = (document: Document): string[] =>
    [document.frames, document.shapes, document.components, document.variables].flatMap(
        Object.keys
    );

function availableKey(prefix: string, used: ReadonlySet<string>): string {
    for (let suffix = 1; ; suffix++) {
        const candidate = suffix === 1 ? prefix : `${prefix}:${suffix}`;
        if (!used.has(candidate)) {
            return candidate;
        }
    }
}

/**
 * Compose a screen through the same atomic operations used by editor commands.
 * The screen key is public to the batch. Artwork keys are local to this screen;
 * component IDs, property IDs and variable bindings remain persistent references.
 */
export function screenOperations(
    screen: AddFrame,
    artwork: readonly AddShape[],
    reservedKeys: Iterable<string> = []
): Array<AddFrame | AddShape> {
    const used = new Set([...reservedKeys, screen.key]);
    const local = new Set<string>();
    const shapes = artwork.map((item) => {
        if (local.has(item.key)) {
            throw new Error(`Artwork key ${item.key} is repeated within this screen.`);
        }
        local.add(item.key);
        const prefix = `artwork:${JSON.stringify([screen.key, item.key])}`;
        const key = availableKey(prefix, used);
        used.add(key);

        return { ...item, key, shape: { ...item.shape, parentFrameId: screen.key } };
    });

    return [screen, ...shapes];
}
