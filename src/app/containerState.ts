import type { Component, Document, Group, Layer } from './types';
import { untracked } from './untracked';

/**
 * Which shapes their groups, layers and components hide or lock, worked out once
 * for the whole document. Asking each shape's containers one by one reads every
 * container per shape, so a document of many groups slowed every shape row,
 * hit test and history entry in proportion to the group count.
 */
export interface ContainerStates {
    /** Shapes in a hidden group or a hidden component. */
    hidden: ReadonlySet<string>;
    /** Shapes in a locked group, layer or component. */
    locked: ReadonlySet<string>;
    /** The layers each layered shape is on. */
    layers: ReadonlyMap<string, readonly string[]>;
}

type Container = Group | Layer | Component;

/** The containers of `table`, each read whole: see `projectContainerStates`. */
const containersOf = <T extends Container>(table: Record<string, T> | undefined): T[] =>
    table ? Object.values(table) : [];

/**
 * Builds the states from the containers' flags and member lists. Each member list
 * is read as a whole, so the result depends on the lists and flags, not on each
 * entry, and editing a shape leaves it as it is.
 */
export function projectContainerStates(
    document: Pick<Document, 'groups' | 'layers' | 'components'>
): ContainerStates {
    const hidden = new Set<string>();
    const locked = new Set<string>();
    const layers = new Map<string, string[]>();
    const each = (container: Container, add: (id: string) => void) =>
        untracked(container.shapesIds ?? []).forEach(add);

    for (const container of [
        ...containersOf(document.groups),
        ...containersOf(document.components)
    ]) {
        if (!container.visible) {
            each(container, (id) => hidden.add(id));
        }
        if (container.locked) {
            each(container, (id) => locked.add(id));
        }
    }
    for (const layer of containersOf(document.layers)) {
        if (layer.locked) {
            each(layer, (id) => locked.add(id));
        }
        each(layer, (id) => {
            const on = layers.get(id);

            if (on) {
                on.push(layer.id);
            } else {
                layers.set(id, [layer.id]);
            }
        });
    }

    return { hidden, locked, layers };
}

/**
 * The document's kept states, or none for a plain snapshot, which has not
 * evaluated Overmind's derived fields: callers then ask the containers directly.
 */
export const containerStatesOf = (
    document: Pick<Document, 'containerStates'>
): ContainerStates | undefined => {
    const states = document.containerStates as ContainerStates | undefined;

    return typeof states === 'object' && states !== null && states.hidden instanceof Set
        ? states
        : undefined;
};
