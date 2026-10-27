import { projectStackSizes } from './stackSizing';
import { rectToBox } from './utils';
import type { Size, Document, Frame, Point, Shape, StackRules } from './types';
import { frameParents, projectFrameStates } from './frameState';
import { drawnBox } from './membership';
import { translateShape } from './geometry';
import { componentSource, instanceBox } from './componentSource';

const ZERO: Point = { x: 0, y: 0 };
export interface FrameLayout {
    modeProblems?: Record<string, string>;
    shapes: Record<string, Point>;
    frames: Record<string, Point>;
    managedShapes: Set<string>;
    managedFrames: Set<string>;
    problems: Record<string, string>;
    frameSizes: Record<string, Size>;
    shapeSizes: Record<string, Size>;
    /** Each stack's shown slots in layout order. */
    slots: Record<string, StackSlot[]>;
}

export interface StackSlot {
    id: string;
    kind: 'frame' | 'shape';
    members: string[];
    order: number;
}

interface Item {
    id: string;
    kind: 'frame' | 'shape';
    members: string[];
    order: number;
    x: number;
    y: number;
    width: number;
    height: number;
}

/** Authored fallback geometry with local size and position projections only. */
export function projectFrameLayout(
    document: Pick<
        Document,
        'frames' | 'shapes' | 'groups' | 'layers' | 'components' | 'variables' | 'shapesIds'
    >
): FrameLayout {
    const result: FrameLayout = {
        shapes: {},
        frames: {},
        managedShapes: new Set<string>(),
        managedFrames: new Set<string>(),
        problems: {},
        frameSizes: {},
        shapeSizes: {},
        slots: {}
    };
    const stacks = Object.values(document.frames).filter((frame) => frame.stack);

    if (stacks.length === 0 && !Object.values(document.frames).some((frame) => frame.sizing)) {
        return result;
    }

    const parents = frameParents(document.frames);
    const states = projectFrameStates(document.frames);
    const children = new Map<string, string[]>();
    const items = new Map<string, Item[]>();
    const grouped = new Set<string>();
    const shapeChildren = new Map<string, string[]>();
    Object.values(document.shapes).forEach((shape) => {
        if (shape.parentFrameId !== undefined) {
            const members = shapeChildren.get(shape.parentFrameId) ?? [];
            members.push(shape.id);
            shapeChildren.set(shape.parentFrameId, members);
        }
    });
    const containers = [
        ...Object.values(document.groups),
        ...Object.values(document.layers),
        ...Object.values(document.components)
    ];
    const hidden = new Set([
        ...containers
            .filter((container) => !container.visible)
            .flatMap((container) => container.shapesIds),
        ...Object.values(document.components)
            .filter((component) => component.sourceOnly && !component.library)
            .flatMap((component) => component.shapesIds)
    ]);
    const shown = (shape: Shape) =>
        shape.visible && !hidden.has(shape.id) && !states[shape.parentFrameId ?? '']?.hiddenBy;
    const append = (parent: string | undefined, item: Item) => {
        if (parent !== undefined && Object.hasOwn(document.frames, parent)) {
            const members = items.get(parent) ?? [];
            members.push(item);
            items.set(parent, members);
        }
    };
    const box = (shape: Shape) => {
        if (shape.type === 'instance' && !shape.bounds) {
            const source = componentSource(document, shape.componentId);

            if (source) {
                return drawnBox({ ...shape, bounds: instanceBox(shape, source) });
            }
        }

        return drawnBox(shape);
    };

    for (const group of Object.values(document.groups)) {
        const members = group.shapesIds.map((id) => document.shapes[id]).filter(Boolean);
        const parentIds = new Set(members.map((shape) => shape.parentFrameId));

        if (parentIds.size > 1) {
            members.forEach((shape) => {
                if (shape.parentFrameId && document.frames[shape.parentFrameId]?.stack) {
                    result.problems[shape.parentFrameId] =
                        'Put every member of each group in the same frame to lay out this stack.';
                }
            });

            continue;
        }

        members.forEach((shape) => grouped.add(shape.id));
        if (!document.frames[members[0]?.parentFrameId ?? '']?.stack) {
            continue;
        }
        const boxes = members.filter(shown).map(box);

        if (boxes.length === 0) {
            continue;
        }

        const x = Math.min(...boxes.map((bounds) => bounds.topLeft.x));
        const y = Math.min(...boxes.map((bounds) => bounds.topLeft.y));
        append(members[0]?.parentFrameId, {
            id: group.id,
            kind: 'shape',
            members: members.map((shape) => shape.id),
            order: Math.min(
                ...members.map((shape) => shape.layoutOrder ?? Number.MAX_SAFE_INTEGER)
            ),
            x,
            y,
            width: Math.max(...boxes.map((bounds) => bounds.bottomRight.x)) - x,
            height: Math.max(...boxes.map((bounds) => bounds.bottomRight.y)) - y
        });
    }

    for (const shape of Object.values(document.shapes)) {
        if (
            !document.frames[shape.parentFrameId ?? '']?.stack ||
            grouped.has(shape.id) ||
            !shown(shape)
        ) {
            continue;
        }

        const bounds = box(shape);
        append(shape.parentFrameId, {
            id: shape.id,
            kind: 'shape',
            members: [shape.id],
            order: shape.layoutOrder ?? Number.MAX_SAFE_INTEGER,
            x: bounds.topLeft.x,
            y: bounds.topLeft.y,
            width: bounds.width,
            height: bounds.height
        });
    }

    for (const frame of Object.values(document.frames)) {
        const parent = parents.get(frame.id);

        if (parent !== undefined) {
            const members = children.get(parent) ?? [];
            members.push(frame.id);
            children.set(parent, members);
        }
        if (document.frames[parent ?? '']?.stack && !states[frame.id]?.hiddenBy) {
            append(parent, {
                id: frame.id,
                kind: 'frame',
                members: [],
                order: frame.layoutOrder ?? Number.MAX_SAFE_INTEGER,
                x: frame.position.x,
                y: frame.position.y,
                ...frame.size
            });
        }
    }

    items.forEach((members) =>
        members.sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : Number(a.id > b.id)))
    );
    const freeStacks = new Set(Object.keys(result.problems));
    const sizes = projectStackSizes(document, items, parents, freeStacks);
    result.frameSizes = sizes.frames;
    result.shapeSizes = sizes.shapes;
    Object.entries(sizes.problems).forEach(([id, problem]) => {
        result.problems[id] = [result.problems[id], problem].filter(Boolean).join(' ');
    });
    items.forEach((members) =>
        members.forEach((item) => {
            Object.assign(item, (item.kind === 'frame' ? sizes.frames : sizes.shapes)[item.id]);
        })
    );

    const pending = Object.keys(document.frames).filter((id) => parents.get(id) === undefined);

    for (let index = 0; index < pending.length; index++) {
        const id = pending[index];
        const frame = {
            ...document.frames[id],
            size: sizes.frames[id] ?? document.frames[id].size
        };
        const offset = result.frames[id] ?? ZERO;
        const rules = freeStacks.has(id) ? undefined : frame.stack;
        const members = items.get(id) ?? [];
        let cursor = rules?.padding ?? 0;

        if (frame.stack) {
            result.slots[id] = members.map(({ id, kind, members, order }) => ({
                id,
                kind,
                members,
                order
            }));
        }

        for (const item of members) {
            const delta = rules ? stackOffset(frame, offset, rules, item, cursor) : offset;

            if (rules) {
                cursor += (rules.direction === 'row' ? item.width : item.height) + rules.gap;
                const main = rules.direction === 'row' ? frame.size.width : frame.size.height;
                const cross = rules.direction === 'row' ? frame.size.height : frame.size.width;
                const itemCross = rules.direction === 'row' ? item.height : item.width;

                if (
                    cursor - rules.gap + rules.padding > main ||
                    itemCross + 2 * rules.padding > cross
                ) {
                    result.problems[id] ??=
                        'Contents overflow this stack. Increase its size or reduce gap, padding or minimum sizes.';
                }
            }
            if (item.kind === 'frame') {
                result.frames[item.id] = delta;
                if (rules) {
                    result.managedFrames.add(item.id);
                }
            } else {
                item.members.forEach((member) => {
                    result.shapes[member] = delta;
                    if (rules) {
                        result.managedShapes.add(member);
                    }
                });
            }
        }

        // Hidden descendants still follow their parent, without occupying a stack slot.
        for (const child of children.get(id) ?? []) {
            result.frames[child] ??= offset;
            pending.push(child);
        }
        (shapeChildren.get(id) ?? []).forEach((child) => {
            result.shapes[child] ??= offset;
        });
    }

    return result;
}

function stackOffset(
    frame: Frame,
    offset: Point,
    rules: StackRules,
    item: Item,
    cursor: number
): Point {
    const row = rules.direction === 'row';
    const available = Math.max(
        0,
        (row ? frame.size.height - item.height : frame.size.width - item.width) - 2 * rules.padding
    );
    const across =
        rules.padding +
        (rules.align === 'center' ? available / 2 : rules.align === 'end' ? available : 0);

    return {
        x: frame.position.x + offset.x + (row ? cursor : across) - item.x,
        y: frame.position.y + offset.y + (row ? across : cursor) - item.y
    };
}

export const frameLayout = (document: Document): FrameLayout =>
    typeof document.frameLayout === 'object' ? document.frameLayout : projectFrameLayout(document);

export function renderedShape(document: Document, id: string, layout?: FrameLayout): Shape {
    const shape = document.shapes[id];
    if (!shape?.parentFrameId) {
        return shape;
    }

    const projection = layout ?? frameLayout(document);
    const delta = projection.shapes[id] ?? ZERO;
    const size = projection.shapeSizes[id];

    if (!size && delta.x === 0 && delta.y === 0) {
        return shape;
    }

    const copy = { ...shape };
    if (size && copy.type === 'rectangle') {
        copy.size = size;
        copy.bounds = rectToBox({ ...copy.position, ...size });
    }
    if (copy.type === 'instance' && !copy.bounds) {
        const source = componentSource(document, copy.componentId);
        if (source) {
            copy.bounds = instanceBox(copy, source);
        }
    }
    translateShape(copy, delta);

    return copy;
}

export function renderedFrame(
    document: Document,
    id: string,
    layout = frameLayout(document)
): Frame {
    const frame = document.frames[id];
    if (!frame) {
        return frame;
    }
    const delta = layout.frames[id] ?? ZERO;

    return {
        ...frame,
        size: layout.frameSizes[id] ?? frame.size,
        position: { x: frame.position.x + delta.x, y: frame.position.y + delta.y }
    };
}

/** A read-only view for thumbnails and export; never use this for mutations. */
export function layoutDocument(document: Document, layout = frameLayout(document)): Document {
    return {
        ...document,
        shapes: Object.fromEntries(
            Object.keys(document.shapes).map((id) => [id, renderedShape(document, id, layout)])
        ),
        frames: Object.fromEntries(
            Object.keys(document.frames).map((id) => [id, renderedFrame(document, id, layout)])
        ),
        frameLayout: {
            shapes: {},
            frames: {},
            managedShapes: new Set(),
            managedFrames: new Set(),
            problems: {},
            frameSizes: {},
            shapeSizes: {},
            slots: {}
        }
    };
}

/** Canvas transforms use authored snapshots. Inspector sizing remains available. */
export function hasLayoutOffset(document: Document, ids: string[]) {
    const layout = frameLayout(document);

    return ids.some(
        (id) =>
            layout.managedShapes.has(id) || Boolean(layout.shapes[id]?.x || layout.shapes[id]?.y)
    );
}

export function frameHasLayoutOffset(document: Document, id: string) {
    const layout = frameLayout(document);
    const delta = layout.frames[id];

    return layout.managedFrames.has(id) || Boolean(delta?.x || delta?.y);
}

/** Hug or Fill, or a constraint that changes it, decides the drawn size, so the canvas cannot resize it. */
export function frameSizedByLayout(document: Document, id: string) {
    const frame = document.frames[id];
    const size = frameLayout(document).frameSizes[id];

    return Boolean(
        frame &&
        (Object.values(frame.sizing ?? {}).some((rule) => rule.mode !== 'fixed') ||
            frame.bindings?.width ||
            frame.bindings?.height ||
            (size && (size.width !== frame.size.width || size.height !== frame.size.height)))
    );
}

const ORDER_STEP = 1;

/** The stack slot holding a frame, or a shape and its group. */
const slotIndex = (slots: StackSlot[], kind: StackSlot['kind'], id: string) =>
    slots.findIndex((slot) =>
        kind === 'frame' ? slot.kind === 'frame' && slot.id === id : slot.members.includes(id)
    );

/** Where an item is in its stack, counting the shown slots from 0. */
export function stackPosition(
    layout: FrameLayout,
    stackId: string,
    kind: StackSlot['kind'],
    id: string
): number | undefined {
    const index = slotIndex(layout.slots[stackId] ?? [], kind, id);

    return index === -1 ? undefined : index;
}

/**
 * The layout order that puts an item at `position` among its stack's shown slots,
 * between its new neighbors, so no other item's order changes and no two tie.
 */
export function orderAtPosition(
    layout: FrameLayout,
    stackId: string,
    kind: StackSlot['kind'],
    id: string,
    position: number
): number | undefined {
    const slots = layout.slots[stackId] ?? [];
    const index = slotIndex(slots, kind, id);

    if (index === -1) {
        return undefined;
    }

    const others = slots.filter((_slot, slot) => slot !== index);
    const at = Math.max(0, Math.min(Math.trunc(position), others.length));
    // Items without an order sort last; they give no number to place beside.
    const order = (slot: StackSlot | undefined) =>
        slot && slot.order !== Number.MAX_SAFE_INTEGER ? slot.order : undefined;
    const before = order(others[at - 1]);
    const after = order(others[at]);

    if (before !== undefined && after !== undefined) {
        return (before + after) / 2;
    }
    if (before !== undefined) {
        return before + ORDER_STEP;
    }
    if (after !== undefined) {
        return after - ORDER_STEP;
    }

    return at;
}
