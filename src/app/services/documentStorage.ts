import { extractScreenViews } from '../screenViewMigration';
import { frameParents } from '../frameState';
import { readPackageIdentity } from '../packageIdentity';
import { readDimension, legacyTheme } from '../variableModes';
import type {
    Application,
    Camera,
    Document,
    Shape,
    Point,
    Size,
    Group,
    Component,
    Link,
    Guide,
    Variable,
    VariableDimension,
    Frame
} from '../types';
import { createDocument, createInteractions } from '../factories';
import { orderAbove, resolveDrawOrderTies, validDrawOrder } from '../drawOrder';
import { isClosedShape, isHexColor, isStrokedShape } from '../utils';
import { buildVariable, isVariableType } from '../variables';
import { repairComponents } from '../componentRepair';

export const PERSISTENCE_KEY = 'reactor';
export const SCHEMA_VERSION = 23;
export const MIN_FRAME_SIZE = 1;
export const RUNTIME_FIELDS = new Set([
    'selectedFrameId',
    'frameStates',
    'frameLayout',
    'contextualGeometry',
    'active',
    'bounds',
    'projectedSource',
    'layoutSize',
    'textLayout',
    'filter',
    'history',
    'key',
    'selected',
    'sourceOnlyShapesIds',
    'componentMembersIds',
    'shownLayerId',
    'surfaceSelected'
]);
export const COLLECTIONS = [
    'shapes',
    'frames',
    'groups',
    'layers',
    'components',
    'links',
    'guides',
    'variables',
    'dimensions'
] as const;

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
type ComponentData = Omit<Component, 'selected' | 'sourceShapes'> & {
    sourceShapes?: Record<string, ShapeData | Shape>;
};
type LinkData = Omit<Link, 'selected'>;
type GuideData = Omit<Guide, 'selected'>;

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
    | 'tagTones'
> & {
    created: string;
    modified: string;
    deleted?: string;
};

/** The durable form of each kind of entity a document holds. */
export interface SavedEntities {
    frames: Frame;
    shapes: ShapeData;
    groups: MemberData;
    layers: MemberData;
    components: ComponentData;
    links: LinkData;
    guides: GuideData;
    variables: Variable;
    dimensions: VariableDimension;
}

type DocumentData = DocumentFields &
    Pick<Document, 'camera'> & { [C in Collection]: Record<string, SavedEntities[C]> };

/** Whether an entity exists, for dropping references to ones that do not. */
export type Exists = (
    collection: 'shapes' | 'components' | 'variables' | 'frames',
    id: string
) => boolean;
export interface PersistedState {
    version: number;
    currentDocumentId: string;
    documents: Record<string, DocumentData>;
}

export function record(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Expected an object');
    }

    return Object.fromEntries(Object.entries(value));
}

export function text(value: unknown): string {
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

export function number(value: unknown, minimum = -Infinity): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum) {
        throw new Error('Invalid number');
    }

    return value;
}

function color(value: unknown): string {
    const result = text(value);

    if (!isHexColor(result)) {
        throw new Error('Invalid color');
    }

    return result;
}

/** A number from 0 to 1. */
function fraction(value: unknown): number {
    const result = number(value, 0);

    if (result > 1) {
        throw new Error('Invalid fraction');
    }

    return result;
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

/** Picked tag tones by name, checked where they are shown; none when absent. */
function tones(value: unknown): Record<string, string> {
    if (value === undefined) {
        return {};
    }

    return Object.fromEntries(
        Object.entries(record(value)).filter(
            (entry): entry is [string, string] => typeof entry[1] === 'string'
        )
    );
}

export function list<T>(value: unknown, read: (item: unknown) => T): T[] {
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
        ...(m.parentId === undefined ? {} : { parentId: id(m.parentId) }),
        ...(m.rotation === undefined ? {} : { rotation: number(m.rotation) })
    };
}

function readResponsiveVariants(value: unknown): NonNullable<Component['responsiveVariants']> {
    const settings = record(value);
    if (settings.source !== 'screen' && settings.source !== 'parent') {
        throw new Error('Invalid responsive variant width source');
    }
    const rules = list(settings.rules, (entry) => {
        const rule = record(entry);

        return { minWidth: number(rule.minWidth, 0), variantId: id(rule.variantId) };
    });
    if (new Set(rules.map((rule) => rule.minWidth)).size !== rules.length) {
        throw new Error('Duplicate responsive variant thresholds');
    }

    return { source: settings.source, rules };
}

function readComponent(value: unknown): ComponentData {
    const c = record(value);

    return {
        ...readMember(value),
        ...(c.responsiveVariants === undefined
            ? {}
            : { responsiveVariants: readResponsiveVariants(c.responsiveVariants) }),
        ...(c.variantIds === undefined ? {} : { variantIds: list(c.variantIds, id) }),
        ...readRoleAndInteractions(c),
        ...(c.sourceOnly === undefined ? {} : { sourceOnly: bool(c.sourceOnly) }),
        ...(c.sourceShapes === undefined
            ? {}
            : { sourceShapes: table(c.sourceShapes, readOrderedShape) }),
        ...(c.library === undefined
            ? {}
            : {
                  library: {
                      documentId: id(record(c.library).documentId),
                      hash: text(record(c.library).hash)
                  }
              }),
        ...(c.props === undefined
            ? {}
            : {
                  props: list(c.props, (entry) => {
                      const prop = record(entry);

                      return {
                          id: id(prop.id),
                          label: text(prop.label),
                          shapeId: id(prop.shapeId),
                          key: id(prop.key)
                      };
                  })
              })
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
        ...(s.parentFrameId === undefined ? {} : { parentFrameId: id(s.parentFrameId) }),
        ...(s.sizing === undefined ? {} : { sizing: readSizing(s.sizing) }),
        ...(s.layoutOrder === undefined ? {} : { layoutOrder: number(s.layoutOrder) }),
        ...(s.parentShapeId === undefined ? {} : { parentShapeId: id(s.parentShapeId) }),
        ...(s.children === undefined ? {} : { children: list(s.children, readChild) }),
        ...(s.bindings === undefined ? {} : { bindings: readBindings(s.bindings) })
    };

    const geometry = readShapeGeometry(value);

    return { ...base, ...geometry, ...readShapeStyle(value, geometry) };
}

/** The variable each property follows, by property key. */
export function readBindings(value: unknown): Record<string, string> {
    return Object.fromEntries(
        Object.entries(record(value)).map(([key, variableId]) => [id(key), id(variableId)])
    );
}

/**
 * Reads how a shape of `shape`'s type is drawn beyond its geometry, leaving out what
 * does not apply to it. Throws when any of it is invalid.
 */
export function readShapeStyle(value: unknown, shape: Pick<Shape, 'type'>) {
    const s = record(value);

    return {
        ...(s.opacity === undefined ? {} : { opacity: fraction(s.opacity) }),
        ...(s.fill === undefined || !isClosedShape(shape) ? {} : { fill: color(s.fill) }),
        ...(s.stroke === undefined || !isStrokedShape(shape) ? {} : { stroke: color(s.stroke) }),
        ...(s.fontColor === undefined || shape.type !== 'text'
            ? {}
            : { fontColor: color(s.fontColor) })
    };
}

/**
 * Reads what a shape draws: its type and geometry, and an image's source or a
 * text's value and size. Throws when any of it is invalid.
 */
export function readShapeGeometry(value: unknown) {
    const s = record(value);

    // Lines and pens are placed by their points; earlier versions also stored an
    // unused `position` for them, which is dropped here.
    switch (s.type) {
        case 'rectangle':
            return {
                type: s.type,
                position: point(s.position),
                size: size(s.size),
                ...(s.cornerRadius === undefined ? {} : { cornerRadius: number(s.cornerRadius, 0) })
            };
        case 'image':
            return {
                type: s.type,
                position: point(s.position),
                size: size(s.size),
                source: text(s.source)
            };
        case 'circle':
            return {
                type: s.type,
                position: point(s.position),
                radius: number(s.radius, 0)
            };
        case 'ellipse': {
            const radius = point(s.radius);
            number(radius.x, 0);
            number(radius.y, 0);

            return { type: s.type, position: point(s.position), radius };
        }

        case 'line':
            return { type: s.type, start: point(s.start), end: point(s.end) };
        case 'pen':
            return { type: s.type, points: list(s.points, point) };
        case 'text':
            return {
                type: s.type,
                position: point(s.position),
                value: text(s.value ?? s.text),
                ...(s.template === undefined ? {} : { template: text(s.template) }),
                ...(s.fontSize === undefined ? {} : { fontSize: positive(s.fontSize) }),
                ...(s.wrapWidth === undefined ? {} : { wrapWidth: number(s.wrapWidth, 0) })
            };
        case 'instance':
            if (s.variantMode !== undefined && s.variantMode !== 'auto') {
                throw new Error('Invalid variant selection mode');
            }

            return {
                type: s.type,
                ...(s.variantMode === 'auto' ? { variantMode: 'auto' as const } : {}),
                ...(s.variantId === undefined ? {} : { variantId: id(s.variantId) }),
                modeOverrides: readBindings(s.modeOverrides ?? {}),
                ...readRoleAndInteractions(s),
                componentId: id(s.componentId),
                position: point(s.position),
                overrides: Object.fromEntries(
                    Object.entries(record(s.overrides ?? {})).map(([key, value]) => {
                        if (value && typeof value === 'object' && !Array.isArray(value)) {
                            return [id(key), { variableId: id(record(value).variableId) }];
                        }
                        if (
                            typeof value !== 'string' &&
                            typeof value !== 'number' &&
                            typeof value !== 'boolean'
                        ) {
                            throw new Error('Invalid component override');
                        }
                        return [id(key), value];
                    })
                )
            };
        default:
            throw new Error('Unsupported shape type');
    }
}

/**
 * Reads a copied group: its name, rotation and the positions of its shapes among
 * `shapeCount` copied shapes, two or more, each in no other group of `taken`.
 */
function readLink(value: unknown): LinkData {
    const l = record(value);

    return {
        ...entity(value),
        type: text(l.type),
        ...(l.source === undefined ? {} : { source: id(l.source) }),
        ...(l.target === undefined ? {} : { target: id(l.target) })
    };
}

function readVariable(value: unknown): Variable {
    const v = record(value);
    const type = text(v.type);
    const variable = isVariableType(type)
        ? buildVariable(id(v.id), text(v.name), type, record(v.values).default)
        : undefined;

    if (!variable) {
        throw new Error('Invalid variable');
    }

    if (v.source !== undefined) variable.source = readPackageIdentity(v.source);
    const values = record(v.values);
    const overrides = Object.entries(values).filter(([key]) => key !== 'default');
    if (overrides.length || v.dimensionId !== undefined) {
        if (variable.type === 'boolean') {
            throw new Error('Only color, number and text modes are supported');
        }

        if (variable.type === 'color') {
            variable.values = {
                default: variable.values.default,
                ...Object.fromEntries(overrides.map(([key, value]) => [id(key), color(value)]))
            };
        } else if (variable.type === 'number') {
            variable.values = {
                default: variable.values.default,
                ...Object.fromEntries(overrides.map(([key, value]) => [id(key), number(value)]))
            };
        } else {
            variable.values = {
                default: variable.values.default,
                ...Object.fromEntries(overrides.map(([key, value]) => [id(key), text(value)]))
            };
        }
        if (v.dimensionId !== undefined) {
            variable.dimensionId = id(v.dimensionId);
        } else if (variable.type === 'color' && values.dark !== undefined) {
            variable.dimensionId = 'theme';
        }
        // A merge can leave values whose dimension another copy removed: read the base alone.
        else {
            Object.keys(variable.values)
                .filter((key) => key !== 'default')
                .forEach((key) => delete variable.values[key]);
        }
    }
    return v.alias === undefined ? variable : { ...variable, alias: id(v.alias) };
}

function readGuide(value: unknown): GuideData {
    const r = record(value);

    if (r.orientation !== 'horizontal' && r.orientation !== 'vertical') {
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

function readRoleAndInteractions(value: Record<string, unknown>) {
    const interaction =
        value.interaction === undefined ? undefined : readRoleSettings(value.interaction);

    return {
        ...(interaction ? { interaction } : {}),
        interactions:
            value.interactions === undefined
                ? createInteractions(interaction)
                : readInteractions(value.interactions)
    };
}

export function readInteractions(value: unknown): import('../types').InteractionSettings {
    const { activate, ...rest } = record(value);
    const action = activate == null ? {} : record(activate);
    if (Object.keys(rest).length || (activate != null && action.type !== 'navigate')) {
        throw new Error('Invalid interactions');
    }

    return activate === undefined
        ? {}
        : { activate: activate && { type: 'navigate', screenId: id(action.screenId) } };
}

export function readRoleSettings(value: unknown): import('../types').RoleSettings {
    const settings = record(value);
    if (
        typeof settings.role !== 'string' ||
        !['none', 'text', 'input', 'button', 'list', 'image'].includes(settings.role)
    ) {
        throw new Error('Invalid component role');
    }

    return {
        role: settings.role as import('../types').RoleSettings['role'],
        // Only buttons navigate; a stray link on another role is dropped rather than kept.
        ...(settings.navigateTo === undefined || settings.role !== 'button'
            ? {}
            : { navigateTo: id(settings.navigateTo) }),
        ...(settings.controlId === undefined ? {} : { controlId: id(settings.controlId) }),
        props: Object.fromEntries(
            Object.entries(record(settings.props)).map(([key, value]) => [id(key), id(value)])
        )
    };
}

export function readSizing(value: unknown): import('../types').Sizing {
    return Object.fromEntries(
        Object.entries(record(value)).map(([axis, value]) => {
            const rule = record(value);

            if (
                !['width', 'height'].includes(axis) ||
                !['fixed', 'hug', 'fill'].includes(String(rule.mode)) ||
                Object.keys(rule).some((key) => !['mode', 'min', 'max'].includes(key))
            ) {
                throw new Error('Invalid sizing rule');
            }

            return [
                axis,
                {
                    mode: rule.mode,
                    ...(rule.min === undefined ? {} : { min: number(rule.min, 0) }),
                    ...(rule.max === undefined ? {} : { max: number(rule.max, 0) })
                }
            ];
        })
    );
}

export function readStack(value: unknown): import('../types').StackRules {
    const rules = record(value);

    if (
        !['row', 'column'].includes(String(rules.direction)) ||
        !['start', 'center', 'end'].includes(String(rules.align))
    ) {
        throw new Error('Invalid stack direction or alignment');
    }

    return {
        direction: rules.direction as 'row' | 'column',
        align: rules.align as 'start' | 'center' | 'end',
        gap: number(rules.gap, 0),
        padding: number(rules.padding, 0)
    };
}

function readFrame(value: unknown): Frame {
    const f = record(value);
    const name = text(f.name).trim();
    const bindings = readBindings(f.bindings ?? {});

    if (Object.keys(bindings).some((key) => !['width', 'height', 'gap', 'padding'].includes(key))) {
        throw new Error('Invalid frame variable binding');
    }

    if (!name) {
        throw new Error('Expected a frame name');
    }

    if (f.kind !== undefined && f.kind !== 'frame' && f.kind !== 'screen' && f.kind !== 'view') {
        throw new Error('Expected frame, screen or view identity');
    }

    if (
        (f.screenLayout !== undefined &&
            (f.screenLayout !== true || f.kind === 'screen' || f.kind === 'view')) ||
        ((f.layoutId !== undefined || f.layoutMode !== undefined) && f.kind !== 'view') ||
        (f.layoutMode !== undefined && f.layoutMode !== 'auto') ||
        // Only a screen holds rules; an empty set left on another frame is ignored.
        (f.kind !== 'screen' && Object.keys(readLayoutRules(f.responsiveLayouts)).length > 0)
    ) {
        throw new Error('Invalid screen layout fields');
    }

    if ((f.kind === 'view') !== (f.screenId !== undefined)) {
        throw new Error('A screen view needs a screen reference');
    }

    if (
        f.kind === 'view' &&
        (f.parentFrameId !== undefined ||
            Object.keys(bindings).length > 0 ||
            f.stack !== undefined ||
            f.sizing !== undefined ||
            f.layoutOrder !== undefined)
    ) {
        throw new Error('A screen view cannot hold layout children');
    }

    return {
        ...entity(value),
        name,
        bindings,
        modeOverrides: readBindings(f.modeOverrides ?? {}),
        kind: f.kind ?? 'frame',
        ...(f.kind === 'screen' && f.definitionOnly === true
            ? { definitionOnly: true as const }
            : {}),
        ...(f.screenId === undefined ? {} : { screenId: id(f.screenId) }),
        ...(f.screenLayout === true ? { screenLayout: true as const } : {}),
        ...(f.layoutId === undefined ? {} : { layoutId: id(f.layoutId) }),
        ...(f.layoutMode === 'auto' ? { layoutMode: 'auto' as const } : {}),
        ...(f.kind === 'screen' ? { responsiveLayouts: readLayoutRules(f.responsiveLayouts) } : {}),
        ...(f.parentFrameId === undefined ? {} : { parentFrameId: id(f.parentFrameId) }),
        ...(f.stack === undefined ? {} : { stack: readStack(f.stack) }),
        ...(f.sizing === undefined ? {} : { sizing: readSizing(f.sizing) }),
        ...(f.layoutOrder === undefined ? {} : { layoutOrder: number(f.layoutOrder) }),
        position: point(f.position),
        size: {
            width: number(record(f.size).width, MIN_FRAME_SIZE),
            height: number(record(f.size).height, MIN_FRAME_SIZE)
        }
    };
}

function readLayoutRule(value: unknown) {
    const rule = record(value);

    return { minWidth: number(rule.minWidth, 0), layoutId: id(rule.layoutId) };
}

/** Rules by rule ID. A list, as early v22 saves held, gets IDs from its positions. */
function readLayoutRules(value: unknown): Record<string, import('../types').ResponsiveLayoutRule> {
    if (value === undefined) {
        return {};
    }
    if (Array.isArray(value)) {
        return Object.fromEntries(
            list(value, readLayoutRule).map((rule, index) => [`rule-${index}`, rule])
        );
    }

    return Object.fromEntries(
        Object.entries(record(value)).map(([key, rule]) => [id(key), readLayoutRule(rule)])
    );
}

const entityReaders: { [C in Collection]: (value: unknown) => SavedEntities[C] } = {
    frames: readFrame,
    shapes: readOrderedShape,
    groups: readMember,
    layers: readMember,
    components: readComponent,
    links: readLink,
    guides: readGuide,
    dimensions: readDimension,
    variables: readVariable
};

/** Reads one entity's durable form, throwing when it is invalid. */
export function readEntity<C extends Collection>(collection: C, value: unknown): SavedEntities[C] {
    return entityReaders[collection](value);
}

const withoutMissingMembers = <T extends MemberData>(member: T, exists: Exists): T => {
    const shapesIds = [...new Set(member.shapesIds)].filter((shapeId) => exists('shapes', shapeId));

    return shapesIds.length === member.shapesIds.length ? member : { ...member, shapesIds };
};

const withoutMissingFrame = <T extends { parentFrameId?: string }>(item: T, exists: Exists): T => {
    if (item.parentFrameId === undefined || exists('frames', item.parentFrameId)) {
        return item;
    }

    const copy = { ...item };
    delete copy.parentFrameId;

    return copy;
};

const referenceRepairs: {
    [C in Collection]: (entity: SavedEntities[C], exists: Exists) => SavedEntities[C] | null;
} = {
    shapes: (shape, exists) => {
        const next = withoutMissingFrame(shape, exists);

        return next.parentShapeId === undefined || exists('shapes', next.parentShapeId)
            ? next
            : { ...next, parentShapeId: undefined };
    },
    frames: withoutMissingFrame,
    groups: withoutMissingMembers,
    layers: withoutMissingMembers,
    components: (component, exists) => {
        const members = component.sourceShapes
            ? {
                  ...component,
                  shapesIds: component.shapesIds.filter((id) =>
                      Object.hasOwn(component.sourceShapes ?? {}, id)
                  )
              }
            : withoutMissingMembers(component, exists);
        const props = members.props?.filter((prop) => members.shapesIds.includes(prop.shapeId));

        return members.parentId === undefined || exists('components', members.parentId)
            ? { ...members, props }
            : { ...members, props, parentId: undefined };
    },
    links: (link, exists) =>
        [link.source, link.target].every((end) => end === undefined || exists('shapes', end))
            ? link
            : null,
    guides: (guide) => guide,
    dimensions: (dimension) => dimension,
    variables: (variable, exists) => {
        if (variable.alias === undefined || exists('variables', variable.alias)) {
            return variable;
        }
        const copy = { ...variable };
        delete copy.alias;
        return copy;
    }
};

/**
 * Drops an entity's references to shapes, components and variables that do not exist, as
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
        ...(d.deleted === undefined ? {} : { deleted: date(d.deleted) }),
        ...(d.description === undefined ? {} : { description: text(d.description) }),
        tags: list(d.tags, text),
        tagTones: tones(d.tagTones),
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
        resolveDrawOrderTies(ordered);
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

/** A camera as saved, throwing when it is invalid. */
export function readCamera(value: unknown): Camera {
    const camera = record(value);

    return { scale: positive(camera.scale), position: point(camera.position) };
}

/** What a device shows: the current document, and each document's camera. */
export interface View {
    previewModes?: Record<string, Record<string, string>>;
    /** Legacy local preference, migrated when documents are available. */
    previewTheme?: 'light' | 'dark';
    currentDocumentId?: string;
    cameras: Record<string, Camera>;
}

/** What `read` returns, or undefined when it finds the value invalid. */
export const orUndefined = <T>(read: () => T): T | undefined => {
    try {
        return read();
    } catch {
        return undefined;
    }
};

/** A saved view, leaving out what is invalid in it. */
export function readView(value: unknown): View {
    const view = orUndefined(() => record(value)) ?? {};
    const cameras = Object.entries(orUndefined(() => record(view.cameras)) ?? {}).flatMap(
        ([documentId, camera]) => {
            const entry = orUndefined(() => [id(documentId), readCamera(camera)] as const);

            return entry ? [entry] : [];
        }
    );

    return {
        previewModes:
            view.previewModes === undefined
                ? undefined
                : Object.fromEntries(
                      Object.entries(orUndefined(() => record(view.previewModes)) ?? {}).map(
                          ([documentId, modes]) => [
                              documentId,
                              Object.fromEntries(
                                  Object.entries(orUndefined(() => record(modes)) ?? {}).filter(
                                      (entry): entry is [string, string] =>
                                          typeof entry[1] === 'string'
                                  )
                              )
                          ]
                      )
                  ),
        previewTheme: view.previewTheme === 'dark' ? 'dark' : undefined,
        currentDocumentId: orUndefined(() => id(view.currentDocumentId)),
        cameras: Object.fromEntries(cameras)
    };
}

function readDocument(value: unknown, onRepair = () => {}, legacyScreens = false): DocumentData {
    const d = record(value);
    const shapes = readShapes(d.shapes, onRepair);
    const frames = d.frames === undefined ? {} : table(d.frames, readFrame);
    if (legacyScreens) {
        const parents = frameParents(frames);

        Object.values(frames).forEach((frame) => {
            if (record(record(d.frames)[frame.id]).kind === undefined) {
                frame.kind = parents.get(frame.id) ? 'frame' : 'screen';
            }
        });
    }

    extractScreenViews(frames);

    const components = table(d.components, readComponent);
    const variables = d.variables === undefined ? {} : table(d.variables, readVariable);
    const dimensions =
        d.dimensions === undefined
            ? Object.values(variables).some(
                  (variable) => variable.type === 'color' && variable.dimensionId === 'theme'
              )
                ? { theme: legacyTheme() }
                : {}
            : table(d.dimensions, readDimension);
    const exists: Exists = (collection, entityId) =>
        collection === 'frames'
            ? Object.hasOwn(frames, entityId) && frames[entityId].kind !== 'view'
            : Object.hasOwn({ shapes, components, variables }[collection], entityId);
    const repair = <C extends Collection>(collection: C, items: Record<string, SavedEntities[C]>) =>
        repairReferences(collection, items, exists, onRepair);

    return {
        ...readFields(d),
        camera: readCamera(d.camera),
        shapes: repair('shapes', shapes),
        frames: repair('frames', frames),
        groups: repair('groups', table(d.groups, readMember)),
        layers: repair('layers', table(d.layers, readMember)),
        components: repair('components', components),
        links: repair('links', table(d.links, readLink)),
        guides: table(d.guides, readGuide),
        dimensions,
        variables: repair('variables', variables)
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
        const version = number(data.version, 1);

        if (!Number.isInteger(version) || version > SCHEMA_VERSION) {
            return null;
        }

        const entries = Object.entries(record(data.documents));
        const documents: Record<string, DocumentData> = {};
        let currentDocumentId = text(data.currentDocumentId);

        for (const [key, value] of entries) {
            const read = readDocument(value, onRepair, version < 12);
            const document = version === 1 || version === 2 ? showContainers(read) : read;

            if (version !== 1 && key !== document.id) {
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

export const hydrateComponent = (component: ComponentData): Component => ({
    ...hydrateMember(component),
    sourceShapes: component.sourceShapes
        ? Object.fromEntries(
              Object.entries(component.sourceShapes).map(([id, shape]) => [
                  id,
                  hydrateShape(readOrderedShape(shape))
              ])
          )
        : undefined
});

export const hydrateLink = (link: LinkData): Link => ({ ...link, selected: false });

export const hydrateGuide = (guide: GuideData): Guide => ({ ...guide, selected: false });

const hydrateVariable = (variable: Variable): Variable => structuredClone(variable);

const entityHydrators: {
    [C in Collection]: (entity: SavedEntities[C]) => Document[C][string];
} = {
    frames: (frame) => structuredClone(frame),
    shapes: hydrateShape,
    groups: hydrateMember,
    layers: hydrateMember,
    components: hydrateComponent,
    links: hydrateLink,
    guides: hydrateGuide,
    dimensions: (dimension) => structuredClone(dimension),
    variables: hydrateVariable
};

/** One entity as the store holds it, from its durable form. */
export function hydrateEntity<C extends Collection>(
    collection: C,
    entity: SavedEntities[C]
): Document[C][string] {
    return entityHydrators[collection](entity);
}

export const hydrateDocumentFields = ({ deleted, ...fields }: DocumentFields) => ({
    ...fields,
    created: new Date(fields.created),
    modified: new Date(fields.modified),
    ...(deleted === undefined ? {} : { deleted: new Date(deleted) })
});

function hydrateTable<T, R>(items: Record<string, T>, hydrate: (item: T) => R) {
    return Object.fromEntries(Object.entries(items).map(([key, item]) => [key, hydrate(item)]));
}

export function hydrateDocument(data: DocumentData): Document {
    data = readDocument(data);

    const document = createDocument({
        ...data,
        deleted: undefined,
        ...hydrateDocumentFields(data),
        shapes: hydrateTable(data.shapes, hydrateShape),
        groups: hydrateTable(data.groups, hydrateMember),
        layers: hydrateTable(data.layers, hydrateMember),
        components: hydrateTable(data.components, hydrateComponent),
        links: hydrateTable(data.links, hydrateLink),
        guides: hydrateTable(data.guides, hydrateGuide),
        variables: hydrateTable(data.variables, hydrateVariable)
    });
    repairComponents(document);

    return document;
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
