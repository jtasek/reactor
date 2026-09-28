import type { Application, Document, Shape, Point, Size, Group, Link, Ruler } from '../types';
import { Orientation } from '../types';
import { createDocument } from '../factories';
import { orderAbove, untie, validDrawOrder } from '../drawOrder';

export const PERSISTENCE_KEY = 'reactor';
export const SCHEMA_VERSION = 4;
export const RUNTIME_FIELDS = new Set(['active', 'bounds', 'filter', 'key', 'selected']);
export const COLLECTIONS = ['shapes', 'groups', 'layers', 'components', 'links', 'rulers'] as const;

export type Collection = (typeof COLLECTIONS)[number];

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** A shape's durable fields: runtime-only state is omitted and dates are ISO strings. */
type ShapeData = DistributiveOmit<
    Shape,
    'created' | 'modified' | 'selected' | 'active' | 'bounds' | 'children' | 'key'
> & {
    created: string;
    modified: string;
    children?: ShapeData[];
};
type MemberData = Omit<Group, 'selected'> & { parentId?: string };
type LinkData = Omit<Link, 'selected'>;
type RulerData = Omit<Ruler, 'selected'>;

/** A document's durable fields, without its entities and its per-device camera. */
export type DocumentFields = Pick<
    Document,
    | 'id'
    | 'author'
    | 'createdBy'
    | 'modifiedBy'
    | 'name'
    | 'description'
    | 'locked'
    | 'grid'
    | 'tags'
> & {
    created: string;
    modified: string;
};

/** The durable form of each kind of entity a document holds. */
export interface SavedEntities {
    shapes: ShapeData;
    groups: MemberData;
    layers: MemberData;
    components: MemberData;
    links: LinkData;
    rulers: RulerData;
}

type DocumentData = DocumentFields &
    Pick<Document, 'camera'> & { [C in Collection]: Record<string, SavedEntities[C]> };

/** Whether an entity exists, for dropping references to ones that do not. */
export type Exists = (collection: 'shapes' | 'components', id: string) => boolean;
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

function readMember(value: unknown): MemberData {
    const m = record(value);

    return {
        ...entity(value),
        shapesIds: list(m.shapesIds, id),
        ...(m.parentId === undefined ? {} : { parentId: id(m.parentId) })
    };
}

function readShape(value: unknown, readChild: (child: unknown) => ShapeData): ShapeData {
    const s = record(value);
    const base = {
        ...entity(value),
        created: date(s.created),
        modified: date(s.modified),
        createdBy: text(s.createdBy),
        modifiedBy: text(s.modifiedBy),
        order: validDrawOrder(s.order) ?? '',
        rotation: s.rotation === undefined ? 0 : number(s.rotation),
        ...(s.description === undefined ? {} : { description: text(s.description) }),
        ...(s.parentShapeId === undefined ? {} : { parentShapeId: id(s.parentShapeId) }),
        ...(s.children === undefined ? {} : { children: list(s.children, readChild) })
    };

    // Lines and pens are placed by their points; earlier versions also stored an
    // unused `position` for them, which is dropped here.
    switch (s.type) {
        case 'rectangle':
            return { ...base, type: s.type, position: point(s.position), size: size(s.size) };
        case 'image':
            return {
                ...base,
                type: s.type,
                position: point(s.position),
                size: size(s.size),
                source: text(s.source)
            };
        case 'circle':
            return {
                ...base,
                type: s.type,
                position: point(s.position),
                radius: number(s.radius, 0)
            };
        case 'ellipse': {
            const radius = point(s.radius);
            number(radius.x, 0);
            number(radius.y, 0);

            return { ...base, type: s.type, position: point(s.position), radius };
        }

        case 'line':
            return { ...base, type: s.type, start: point(s.start), end: point(s.end) };
        case 'pen':
            return { ...base, type: s.type, points: list(s.points, point) };
        case 'text':
            return {
                ...base,
                type: s.type,
                position: point(s.position),
                value: text(s.value ?? s.text),
                ...(s.fontSize === undefined ? {} : { fontSize: positive(s.fontSize) })
            };
        default:
            throw new Error('Unsupported shape type');
    }
}

function readLink(value: unknown): LinkData {
    const l = record(value);

    return {
        ...entity(value),
        type: text(l.type),
        ...(l.source === undefined ? {} : { source: id(l.source) }),
        ...(l.target === undefined ? {} : { target: id(l.target) })
    };
}

function readRuler(value: unknown): RulerData {
    const r = record(value);

    if (r.orientation !== Orientation.Horizontal && r.orientation !== Orientation.Vertical) {
        throw new Error('Invalid orientation');
    }

    return { ...entity(value), orientation: r.orientation, position: point(r.position) };
}

/** Like `readShape`, but a missing or invalid draw order makes the shape invalid. */
function readOrderedShape(value: unknown): ShapeData {
    const shape = readShape(value, readOrderedShape);

    if (!shape.order) {
        throw new Error('Invalid draw order');
    }

    return shape;
}

const entityReaders: { [C in Collection]: (value: unknown) => SavedEntities[C] } = {
    shapes: readOrderedShape,
    groups: readMember,
    layers: readMember,
    components: readMember,
    links: readLink,
    rulers: readRuler
};

/** Reads one entity's durable form, throwing when it is invalid. */
export function readEntity<C extends Collection>(collection: C, value: unknown): SavedEntities[C] {
    return entityReaders[collection](value);
}

const withoutMissingMembers = <T extends MemberData>(member: T, exists: Exists): T => {
    const shapesIds = [...new Set(member.shapesIds)].filter((shapeId) => exists('shapes', shapeId));

    return shapesIds.length === member.shapesIds.length ? member : { ...member, shapesIds };
};

const referenceRepairs: {
    [C in Collection]: (entity: SavedEntities[C], exists: Exists) => SavedEntities[C] | null;
} = {
    shapes: (shape, exists) =>
        shape.parentShapeId === undefined || exists('shapes', shape.parentShapeId)
            ? shape
            : { ...shape, parentShapeId: undefined },
    groups: withoutMissingMembers,
    layers: withoutMissingMembers,
    components: (component, exists) => {
        const members = withoutMissingMembers(component, exists);

        return members.parentId === undefined || exists('components', members.parentId)
            ? members
            : { ...members, parentId: undefined };
    },
    links: (link, exists) =>
        [link.source, link.target].every((end) => end === undefined || exists('shapes', end))
            ? link
            : null,
    rulers: (ruler) => ruler
};

/**
 * Drops an entity's references to shapes and components that do not exist, as
 * deleting them would: memberships and parents go, and a link to a missing shape
 * goes entirely (null). A member listed twice, as two copies adding it at once
 * leave it, is kept once. Returns the same entity when nothing was dropped.
 */
export function withoutDanglingReferences<C extends Collection>(
    collection: C,
    entity: SavedEntities[C],
    exists: Exists
): SavedEntities[C] | null {
    return referenceRepairs[collection](entity, exists);
}

function repairReferences<C extends Collection>(
    collection: C,
    items: Record<string, SavedEntities[C]>,
    exists: Exists,
    onRepair: () => void
): Record<string, SavedEntities[C]> {
    const repaired = Object.entries(items).map(
        ([key, item]) => [key, item, withoutDanglingReferences(collection, item, exists)] as const
    );

    if (repaired.every(([, item, result]) => result === item)) {
        return items;
    }

    onRepair();

    return Object.fromEntries(
        repaired.flatMap(([key, , result]) => (result === null ? [] : [[key, result]]))
    );
}

function readFields(d: Record<string, unknown>): DocumentFields {
    const grid = record(d.grid);

    return {
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
        grid: {
            width: positive(grid.width),
            height: positive(grid.height),
            factor: positive(grid.factor),
            visible: bool(grid.visible)
        }
    };
}

/** Reads a document's durable fields, throwing when they are invalid. */
export function readDocumentFields(value: unknown): DocumentFields {
    return readFields(record(value));
}

function readShapes(value: unknown, onRepair: () => void): Record<string, ShapeData> {
    const unordered: ShapeData[] = [];
    const read = (item: unknown): ShapeData => {
        const shape = readShape(item, read);

        if (!shape.order) {
            unordered.push(shape);
        }

        return shape;
    };
    const shapes = table(value, read);
    const ordered = Object.values(shapes).filter(({ order }) => order);
    const tied = new Set(ordered.map(({ order }) => order)).size < ordered.length;

    if (!tied && unordered.length === 0) {
        return shapes;
    }

    onRepair();

    if (tied) {
        untie(ordered);
    }

    let top = ordered.reduce<string | null>(
        (highest, { order }) => (highest === null || order > highest ? order : highest),
        null
    );

    unordered.forEach((shape) => {
        top = orderAbove(top);
        shape.order = top;
    });

    return shapes;
}

function readDocument(value: unknown, onRepair = () => {}): DocumentData {
    const d = record(value);
    const camera = record(d.camera);
    const shapes = readShapes(d.shapes, onRepair);
    const components = table(d.components, readMember);
    const exists: Exists = (collection, entityId) =>
        Object.hasOwn(collection === 'shapes' ? shapes : components, entityId);
    const repair = <C extends Collection>(collection: C, items: Record<string, SavedEntities[C]>) =>
        repairReferences(collection, items, exists, onRepair);

    return {
        ...readFields(d),
        camera: { scale: positive(camera.scale), position: point(camera.position) },
        shapes: repair('shapes', shapes),
        groups: repair('groups', table(d.groups, readMember)),
        layers: repair('layers', table(d.layers, readMember)),
        components: repair('components', components),
        links: repair('links', table(d.links, readLink)),
        rulers: table(d.rulers, readRuler)
    };
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

/**
 * Before v3, group and layer visibility never hid their shapes, and new groups
 * and layers were created hidden. Showing them keeps those documents looking as
 * they did now that hiding a group or layer hides its shapes.
 */
function showContainers(document: DocumentData): DocumentData {
    const show = <T extends MemberData>(items: Record<string, T>) =>
        Object.fromEntries(
            Object.entries(items).map(([key, item]) => [key, { ...item, visible: true }])
        );

    return { ...document, groups: show(document.groups), layers: show(document.layers) };
}

/**
 * v1 stored derived fields and used an incorrect default document map key; v1
 * and v2 group and layer visibility is migrated by `showContainers`. Shapes saved
 * before v4 have no draw order, so `readShapes` gives them one in saved order.
 * `onRepair` runs when loading changes saved content: shapes that get new orders
 * (all shapes saved before v4, and v4 shapes with missing, invalid or tied
 * orders) and references to missing shapes or components that are dropped.
 */
export function migratePersistedState(raw: unknown, onRepair = () => {}): PersistedState | null {
    try {
        const data = record(raw);

        if (
            data.version !== 1 &&
            data.version !== 2 &&
            data.version !== 3 &&
            data.version !== SCHEMA_VERSION
        ) {
            return null;
        }

        const entries = Object.entries(record(data.documents));
        const documents: Record<string, DocumentData> = {};
        let currentDocumentId = text(data.currentDocumentId);

        for (const [key, value] of entries) {
            const read = readDocument(value, onRepair);
            const document = data.version === 1 || data.version === 2 ? showContainers(read) : read;

            if (data.version !== 1 && key !== document.id) {
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

export function hydrateShape(shape: ShapeData): Shape {
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

export const hydrateMember = (member: MemberData) => ({
    ...member,
    shapesIds: [...member.shapesIds],
    selected: false
});

export const hydrateLink = (link: LinkData): Link => ({ ...link, selected: false });

export const hydrateRuler = (ruler: RulerData): Ruler => ({ ...ruler, selected: false });

const entityHydrators: {
    [C in Collection]: (entity: SavedEntities[C]) => Document[C][string];
} = {
    shapes: hydrateShape,
    groups: hydrateMember,
    layers: hydrateMember,
    components: hydrateMember,
    links: hydrateLink,
    rulers: hydrateRuler
};

/** One entity as the store holds it, from its durable form. */
export function hydrateEntity<C extends Collection>(
    collection: C,
    entity: SavedEntities[C]
): Document[C][string] {
    return entityHydrators[collection](entity);
}

export const hydrateDocumentFields = (fields: DocumentFields) => ({
    ...fields,
    created: new Date(fields.created),
    modified: new Date(fields.modified)
});

function hydrateTable<T, R>(items: Record<string, T>, hydrate: (item: T) => R) {
    return Object.fromEntries(Object.entries(items).map(([key, item]) => [key, hydrate(item)]));
}

export function hydrateDocument(data: DocumentData): Document {
    data = readDocument(data);

    return createDocument({
        ...data,
        ...hydrateDocumentFields(data),
        shapes: hydrateTable(data.shapes, hydrateShape),
        groups: hydrateTable(data.groups, hydrateMember),
        layers: hydrateTable(data.layers, hydrateMember),
        components: hydrateTable(data.components, hydrateMember),
        links: hydrateTable(data.links, hydrateLink),
        rulers: hydrateTable(data.rulers, hydrateRuler)
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
