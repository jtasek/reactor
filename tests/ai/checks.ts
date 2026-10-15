import type { Document, Group, Shape } from 'src/app/types';

/** The first group whose name matches. */
export const groupNamed = (document: Document, name: RegExp): Group | undefined =>
    Object.values(document.groups).find((group) => name.test(group.name));

/** The shapes of a group of the given type, in drawing order. */
export const findShapes = (document: Document, group: Group | undefined, type: Shape['type']) =>
    document.shapesIds
        .filter((id) => group?.shapesIds.includes(id))
        .map((id) => document.shapes[id])
        .filter((shape) => shape.type === type);
