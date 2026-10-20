import { getShapeBounds, assertNever } from './utils';
import { byDrawingOrder } from './drawOrder';
import { json } from 'overmind';
import type { Document, Frame, Shape } from './types';
import { frameLayout, renderedFrame, renderedShape } from './frameLayout';
import { frameContents } from './frameMembership';
import { translateShape } from './geometry';
import { unbindMovedProperties } from './variables';

/** Only an explicit detach, free-layout change or boundary deletion authors the visible positions. */
export function releaseStackPositions(
    document: Document,
    updates: Frame[],
    shapes: { id: string; fields: Record<string, unknown> }[],
    deleted: string[]
) {
    const layout = frameLayout(document);
    const frames = new Map<string, Frame>();
    const artwork = new Map<string, Shape>();
    const targetOffset = (parent: string | undefined) =>
        layout.frames[parent ?? ''] ?? { x: 0, y: 0 };
    const captureShape = (id: string, parent: string | undefined) => {
        const shape = json(renderedShape(document, id, layout));
        const offset = targetOffset(parent);
        translateShape(shape, { x: -offset.x, y: -offset.y });
        artwork.set(id, shape);
    };
    const captureFrame = (id: string, parent: string | undefined) => {
        const members = frameContents(document, id);
        const offset = targetOffset(parent);
        [id, ...members.frames].forEach((child) => {
            const frame = renderedFrame(document, child, layout);
            frames.set(child, {
                ...frame,
                position: { x: frame.position.x - offset.x, y: frame.position.y - offset.y }
            });
        });
        members.shapes.forEach((child) => captureShape(child, parent));
    };
    const releaseChildren = (id: string, parent: string | undefined) => {
        Object.values(document.frames)
            .filter((frame) => frame.parentFrameId === id)
            .forEach((frame) => captureFrame(frame.id, parent));
        Object.values(document.shapes)
            .filter((shape) => shape.parentFrameId === id)
            .forEach((shape) => captureShape(shape.id, parent));
    };

    deleted.forEach((id) => releaseChildren(id, undefined));
    updates.forEach((frame) => {
        const previous = document.frames[frame.id];

        if (!previous) {
            return;
        }
        if (frame.parentFrameId !== previous.parentFrameId) {
            captureFrame(frame.id, frame.parentFrameId);
        }
        if (previous.stack && !frame.stack) {
            releaseChildren(frame.id, frame.id);
        }
    });
    shapes.forEach(({ id, fields }) => {
        if (
            'parentFrameId' in fields &&
            fields.parentFrameId !== document.shapes[id]?.parentFrameId
        ) {
            captureShape(
                id,
                typeof fields.parentFrameId === 'string' ? fields.parentFrameId : undefined
            );
        }
    });

    artwork.forEach((shape, id) => applyPlacement(document.shapes[id], shape));
    frames.forEach((frame, id) => {
        const update = updates.find((item) => item.id === id);
        const original = document.frames[id];

        if (
            update &&
            update.position.x === original.position.x &&
            update.position.y === original.position.y
        ) {
            update.position = frame.position;
        }
        original.position = frame.position;
    });
}

function applyPlacement(original: Shape, shape: Shape) {
    const from = getShapeBounds(original);
    const to = getShapeBounds(shape);
    unbindMovedProperties(shape, {
        x: to.topLeft.x - from.topLeft.x,
        y: to.topLeft.y - from.topLeft.y
    });
    // Geometry only: preserve flags, templates, identity and memberships.
    switch (shape.type) {
        case 'line':
            Object.assign(original, {
                start: shape.start,
                end: shape.end,
                bounds: shape.bounds,
                bindings: shape.bindings
            });
            break;
        case 'pen':
            Object.assign(original, {
                points: shape.points,
                bounds: shape.bounds,
                bindings: shape.bindings
            });
            break;
        case 'rectangle':
        case 'image':
        case 'circle':
        case 'ellipse':
        case 'text':
        case 'instance':
            Object.assign(original, {
                position: shape.position,
                bounds: shape.bounds,
                bindings: shape.bindings
            });
            break;
        default:
            assertNever(shape);
    }
}

/** Grouping preserves visible member offsets before their slots become one. */
export function materializeGroupPlacement(
    document: Document,
    ids: string[],
    parent: string | undefined
) {
    if (ids.length === 0) {
        return;
    }
    const layout = frameLayout(document);
    const offset = layout.frames[parent ?? ''] ?? { x: 0, y: 0 };
    if (
        offset.x === 0 &&
        offset.y === 0 &&
        ids.every((id) => !layout.shapes[id]?.x && !layout.shapes[id]?.y)
    ) {
        return;
    }
    const copies = ids.map((id) => {
        const copy = json(renderedShape(document, id, layout));
        translateShape(copy, { x: -offset.x, y: -offset.y });

        return copy;
    });
    copies.forEach((copy) => applyPlacement(document.shapes[copy.id], copy));
}

/** Layout order is authored independently of draw order; new members append deterministically. */
export function initializeStackOrder(document: Document, ids: Iterable<string>) {
    for (const id of new Set(ids)) {
        if (!document.frames[id]?.stack) {
            continue;
        }

        const shapes = Object.values(document.shapes)
            .filter((shape) => shape.parentFrameId === id)
            .sort(byDrawingOrder);
        const frames = Object.values(document.frames)
            .filter((frame) => frame.parentFrameId === id)
            .sort((a, b) => (a.id < b.id ? -1 : Number(a.id > b.id)));
        const members = [...shapes, ...frames];
        let next = Math.max(-1, ...members.map((item) => item.layoutOrder ?? -1)) + 1;

        for (const member of members) {
            if (member.layoutOrder !== undefined) {
                continue;
            }
            const group =
                'type' in member
                    ? Object.values(document.groups).find((item) =>
                          item.shapesIds.includes(member.id)
                      )
                    : undefined;
            const order =
                group?.shapesIds
                    .map((child) => document.shapes[child]?.layoutOrder)
                    .find((value) => value !== undefined) ?? next++;
            member.layoutOrder = order;
        }
    }
}
