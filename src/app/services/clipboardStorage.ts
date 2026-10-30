/** Clipboard and AI input readers load only with their consumers. */
import type { ShapeInput } from '../types';
import {
    record,
    list,
    number,
    text,
    readBindings,
    readShapeGeometry,
    readShapeStyle
} from './documentStorage';

export function readCopiedGroup(value: unknown, shapeCount: number, taken: Set<number>) {
    const g = record(value);
    const members = list(g.members, (member) => {
        const index = number(member, 0);

        if (!Number.isInteger(index) || index >= shapeCount || taken.has(index)) {
            throw new Error('Invalid group member');
        }

        taken.add(index);

        return index;
    });

    if (members.length < 2) {
        throw new Error('A group needs two shapes');
    }

    return {
        name: text(g.name),
        rotation: g.rotation === undefined ? 0 : number(g.rotation),
        members
    };
}

/** Reads a copied shape: what it draws, its name, description, rotation and bindings. */
export function readCopiedShape(value: unknown): ShapeInput {
    const s = record(value);
    const geometry = readShapeGeometry(value);

    if (geometry.type === 'pen' && geometry.points.length === 0) {
        throw new Error('A pen needs a point');
    }

    return {
        ...geometry,
        ...readShapeStyle(value, geometry),
        name: text(s.name),
        rotation: s.rotation === undefined ? 0 : number(s.rotation),
        ...(s.description === undefined ? {} : { description: text(s.description) }),
        ...(s.bindings === undefined ? {} : { bindings: readBindings(s.bindings) })
    };
}
