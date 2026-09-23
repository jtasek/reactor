import type { Application, Document, Shape, Point, Size, Group, Link, Ruler } from '../types';
import { Orientation } from '../types';
import { createDocument } from '../factories';

export const PERSISTENCE_KEY = 'reactor';
export const SCHEMA_VERSION = 2;

type ShapeData = Omit<
    Shape,
    'created' | 'modified' | 'selected' | 'active' | 'bounds' | 'children' | 'key'
> & {
    created: string;
    modified: string;
    children?: ShapeData[];
    radius?: number | Point;
    start?: Point;
    end?: Point;
    points?: Point[];
    value?: string;
    fontSize?: number;
    source?: string;
};
type MemberData = Omit<Group, 'selected'>;
type DocumentData = Pick<
    Document,
    | 'id'
    | 'author'
    | 'createdBy'
    | 'modifiedBy'
    | 'name'
    | 'description'
    | 'locked'
    | 'camera'
    | 'grid'
    | 'tags'
> & {
    created: string;
    modified: string;
    shapes: Record<string, ShapeData>;
    groups: Record<string, MemberData>;
    layers: Record<string, MemberData>;
    components: Record<string, MemberData & { parentId?: string }>;
    links: Record<string, Omit<Link, 'selected'>>;
    rulers: Record<string, Omit<Ruler, 'selected'>>;
};
export interface PersistedState {
    version: number;
    currentDocumentId: string;
    documents: Record<string, DocumentData>;
}

function record(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Expected an object');
    }

    return Object.fromEntries(Object.entries(value));
}

function text(value: unknown): string {
    if (typeof value !== 'string') {
        throw new Error('Expected text');
    }

    return value;
}

function id(value: unknown): string {
    const result = text(value);

    if (!result || ['__proto__', 'constructor', 'prototype'].includes(result)) {
        throw new Error('Invalid ID');
    }

    return result;
}

function number(value: unknown, minimum = -Infinity): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum) {
        throw new Error('Invalid number');
    }

    return value;
}

function positive(value: unknown): number {
    const result = number(value, 0);

    if (result === 0) {
        throw new Error('Expected positive number');
    }

    return result;
}

function bool(value: unknown): boolean {
    if (typeof value !== 'boolean') {
        throw new Error('Expected boolean');
    }

    return value;
}

function date(value: unknown): string {
    const result = value instanceof Date ? value : new Date(text(value));

    if (!Number.isFinite(result.getTime())) {
        throw new Error('Invalid date');
    }

    return result.toISOString();
}

function point(value: unknown): Point {
    const p = record(value);

    return { x: number(p.x), y: number(p.y) };
}

function size(value: unknown): Size {
    const s = record(value);

    return { width: number(s.width, 0), height: number(s.height, 0) };
}

function list<T>(value: unknown, read: (item: unknown) => T): T[] {
    if (!Array.isArray(value)) {
        throw new Error('Expected array');
    }

    return value.map(read);
}

function table<T extends { id: string }>(
    value: unknown,
    read: (item: unknown) => T
): Record<string, T> {
    return Object.fromEntries(
        Object.entries(record(value)).map(([key, item]) => {
            const result = read(item);

            if (id(key) !== result.id) {
                throw new Error('Table key does not match ID');
            }

            return [key, result];
        })
    );
}

function entity(value: unknown) {
    const e = record(value);

    return { id: id(e.id), name: text(e.name), locked: bool(e.locked), visible: bool(e.visible) };
}

function member(value: unknown): MemberData & { parentId?: string } {
    const m = record(value);

    return {
        ...entity(value),
        shapesIds: list(m.shapesIds, id),
        ...(m.parentId === undefined ? {} : { parentId: id(m.parentId) })
    };
}

function readShape(value: unknown): ShapeData {
    const s = record(value);
    const base = {
        ...entity(value),
        created: date(s.created),
        modified: date(s.modified),
        createdBy: text(s.createdBy),
        modifiedBy: text(s.modifiedBy),
        position: point(s.position),
        rotation: s.rotation === undefined ? 0 : number(s.rotation),
        ...(s.description === undefined ? {} : { description: text(s.description) }),
        ...(s.parentShapeId === undefined ? {} : { parentShapeId: id(s.parentShapeId) }),
        ...(s.children === undefined ? {} : { children: list(s.children, readShape) })
    };

    switch (s.type) {
        case 'rectangle':
            return { ...base, type: s.type, size: size(s.size) };
        case 'image':
            return { ...base, type: s.type, size: size(s.size), source: text(s.source) };
        case 'circle':
            return { ...base, type: s.type, radius: number(s.radius, 0) };
        case 'ellipse': {
            const radius = point(s.radius);
            number(radius.x, 0);
            number(radius.y, 0);

            return { ...base, type: s.type, radius };
        }

        case 'line':
            return { ...base, type: s.type, start: point(s.start), end: point(s.end) };
        case 'pen':
            return { ...base, type: s.type, points: list(s.points, point) };
        case 'text':
            return {
                ...base,
                type: s.type,
                value: text(s.value ?? s.text),
                ...(s.fontSize === undefined ? {} : { fontSize: positive(s.fontSize) })
            };
        default:
            throw new Error('Unsupported shape type');
    }
}

function readDocument(value: unknown): DocumentData {
    const d = record(value);
    const camera = record(d.camera);
    const grid = record(d.grid);
    const document: DocumentData = {
        id: id(d.id),
        author: text(d.author),
        name: text(d.name),
        locked: bool(d.locked),
        created: date(d.created),
        modified: date(d.modified),
        createdBy: text(d.createdBy),
        modifiedBy: text(d.modifiedBy),
        ...(d.description === undefined ? {} : { description: text(d.description) }),
        tags: list(d.tags, text),
        camera: { scale: positive(camera.scale), position: point(camera.position) },
        grid: {
            width: positive(grid.width),
            height: positive(grid.height),
            factor: positive(grid.factor),
            visible: bool(grid.visible)
        },
        shapes: table(d.shapes, readShape),
        groups: table(d.groups, member),
        layers: table(d.layers, member),
        components: table(d.components, member),
        links: table(d.links, (value) => {
            const l = record(value);

            return {
                ...entity(value),
                type: text(l.type),
                ...(l.source === undefined ? {} : { source: id(l.source) }),
                ...(l.target === undefined ? {} : { target: id(l.target) })
            };
        }),
        rulers: table(d.rulers, (value) => {
            const r = record(value);

            if (
                r.orientation !== Orientation.Horizontal &&
                r.orientation !== Orientation.Vertical
            ) {
                throw new Error('Invalid orientation');
            }

            return { ...entity(value), orientation: r.orientation, position: point(r.position) };
        })
    };
    const hasShape = (shapeId: string) => Object.hasOwn(document.shapes, shapeId);

    for (const members of [document.groups, document.layers, document.components]) {
        for (const item of Object.values(members)) {
            if (!item.shapesIds.every(hasShape)) {
                throw new Error('Dangling shape membership');
            }
        }
    }

    for (const link of Object.values(document.links)) {
        if ((link.source && !hasShape(link.source)) || (link.target && !hasShape(link.target))) {
            throw new Error('Dangling link');
        }
    }

    for (const shape of Object.values(document.shapes)) {
        if (shape.parentShapeId && !hasShape(shape.parentShapeId)) {
            throw new Error('Dangling parent');
        }
    }

    for (const component of Object.values(document.components)) {
        if (component.parentId && !Object.hasOwn(document.components, component.parentId)) {
            throw new Error('Dangling component parent');
        }
    }

    return document;
}

export function serializePersistedState(
    state: Pick<Application, 'currentDocumentId' | 'documents'>
): PersistedState {
    return {
        version: SCHEMA_VERSION,
        currentDocumentId: state.currentDocumentId,
        documents: table(state.documents, readDocument)
    };
}

/** v1 stored derived fields and used an incorrect default document map key. */
export function migratePersistedState(raw: unknown): PersistedState | null {
    try {
        const data = record(raw);

        if (data.version !== 1 && data.version !== SCHEMA_VERSION) {
            return null;
        }

        const entries = Object.entries(record(data.documents));
        const documents: Record<string, DocumentData> = {};
        let currentDocumentId = text(data.currentDocumentId);

        for (const [key, value] of entries) {
            const document = readDocument(value);

            if (data.version === SCHEMA_VERSION && key !== document.id) {
                return null;
            }

            if (Object.hasOwn(documents, document.id)) {
                return null;
            }

            documents[document.id] = document;

            if (key === data.currentDocumentId) {
                currentDocumentId = document.id;
            }
        }

        if (!Object.hasOwn(documents, currentDocumentId)) {
            currentDocumentId = Object.keys(documents)[0];
        }

        if (!currentDocumentId) {
            return null;
        }

        return { version: SCHEMA_VERSION, currentDocumentId, documents };
    } catch {
        return null;
    }
}

function hydrateShape(shape: ShapeData): Shape {
    return {
        ...shape,
        key: `${shape.type}-${shape.id}`,
        created: new Date(shape.created),
        modified: new Date(shape.modified),
        selected: false,
        active: false,
        children: shape.children?.map(hydrateShape)
    };
}

function hydrateMembers<T extends MemberData>(
    items: Record<string, T>
): Record<string, T & { selected: boolean }> {
    return Object.fromEntries(
        Object.entries(items).map(([key, value]) => [
            key,
            { ...value, shapesIds: [...value.shapesIds], selected: false }
        ])
    );
}

export function hydrateDocument(data: DocumentData): Document {
    data = readDocument(data);

    return createDocument({
        ...data,
        created: new Date(data.created),
        modified: new Date(data.modified),
        shapes: Object.fromEntries(
            Object.entries(data.shapes).map(([key, shape]) => [key, hydrateShape(shape)])
        ),
        groups: hydrateMembers(data.groups),
        layers: hydrateMembers(data.layers),
        components: hydrateMembers(data.components),
        links: Object.fromEntries(
            Object.entries(data.links).map(([key, link]) => [key, { ...link, selected: false }])
        ),
        rulers: Object.fromEntries(
            Object.entries(data.rulers).map(([key, ruler]) => [key, { ...ruler, selected: false }])
        )
    });
}

export function restoreDocuments(data: PersistedState): Record<string, Document> {
    return Object.fromEntries(
        Object.entries(data.documents).map(([key, document]) => [key, hydrateDocument(document)])
    );
}

/** IDs inside a document are document-scoped, so cloning preserves internal references. */
export function copyDocument(document: Document, newId: string): Document {
    return hydrateDocument({ ...readDocument(document), id: newId });
}
