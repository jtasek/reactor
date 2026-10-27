import type { Box, Orientation, Point, Side } from './types';
import { assertNever, isShapeLocked, isShapeVisible } from './utils';
import { drawnExtent } from './membership';
import { hasLayoutOffset } from './frameLayout';
import { screenOwners } from './screenViews';
import { editableScreenView, placedScreenDocument } from './screenViewEditing';
import { isReadOnly } from './documentAccess';
import type { Context } from './index';
import { componentSourceDelta } from './componentViewTransform';

/** Where Align puts the items: on a side of their box, or on its center across or down. */
export type AlignTo = Side | 'center' | 'middle';

/** How Space puts the items apart: equal gaps between them, or equal distances between centers. */
export type Spacing = 'between' | 'centers';

/** Aligning takes two items at least, and spacing three. */
export const ALIGN_MINIMUM = 2;
export const SPACE_MINIMUM = 3;

/** Commands calculate in the displayed axes, then translate shared master geometry. */
export function sourceOffsets(state: Context['state'], offsets: Point[]) {
    const address = state.events.pointer.screenView;
    const component = address ? editableScreenView(state, address)?.component : undefined;

    return offsets.map((offset) => componentSourceDelta(offset, component));
}

/** Resolve boxes locally; only their translation deltas are written to shared source shapes. */
export function placedItems(state: Context['state'], sourceItems: string[][]) {
    const document = state.currentDocument;
    const address = state.events.pointer.screenView;
    const placed = address ? editableScreenView(state, address) : null;

    if (isReadOnly(state) || document.locked || (address && !placed)) {
        return [];
    }

    const geometry = placed ? placedScreenDocument(document, placed.projection.shapes) : document;
    const shown = new Set(placed?.projection.shapes.map((shape) => shape.id));

    if (placed && document.selectedShapesIds.some((id) => !shown.has(id))) {
        return [];
    }

    // A selected local component moves whole, on the Canvas as in a view.
    const components = document.selectedComponentsIds.map((id) => document.components[id]);
    const contained = new Set(components.flatMap((component) => component.shapesIds));
    const items = [
        ...components.map((component) => component.shapesIds),
        ...sourceItems.filter((ids) => !ids.some((id) => contained.has(id)))
    ];
    const owners = placed ? screenOwners(document.frames) : null;
    const focus = placed?.component
        ? document.components[document.editingComponentId ?? '']
        : undefined;
    const inView = (id: string) =>
        shown.has(id) ||
        Boolean(focus?.shapesIds.includes(id)) ||
        owners?.get(document.shapes[id]?.parentFrameId ?? '') === placed?.screen.id;

    return items.flatMap((shapeIds) => {
        if (
            hasLayoutOffset(document, shapeIds) ||
            shapeIds.some(
                (id) =>
                    isShapeLocked(document, id) ||
                    (placed && (!inView(id) || placed.projection.layoutOffsets.has(id)))
            )
        ) {
            return [];
        }

        const box = drawnExtent(
            geometry,
            shapeIds.filter((id) => geometry.shapes[id] && isShapeVisible(document, id))
        );

        return box ? [{ shapeIds, box }] : [];
    });
}

const across = (x: number): Point => ({ x, y: 0 });
const down = (y: number): Point => ({ x: 0, y });

/** How far each box moves to line up with the others on `to`. */
export function alignOffsets(boxes: Box[], to: AlignTo): Point[] {
    const left = Math.min(...boxes.map((box) => box.topLeft.x));
    const right = Math.max(...boxes.map((box) => box.bottomRight.x));
    const top = Math.min(...boxes.map((box) => box.topLeft.y));
    const bottom = Math.max(...boxes.map((box) => box.bottomRight.y));

    return boxes.map((box) => {
        switch (to) {
            case 'left':
                return across(left - box.topLeft.x);
            case 'right':
                return across(right - box.bottomRight.x);
            case 'center':
                return across((left + right) / 2 - (box.topLeft.x + box.width / 2));
            case 'top':
                return down(top - box.topLeft.y);
            case 'bottom':
                return down(bottom - box.bottomRight.y);
            case 'middle':
                return down((top + bottom) / 2 - (box.topLeft.y + box.height / 2));
            default:
                return assertNever(to);
        }
    });
}

/**
 * How far each box moves along `axis` so the boxes are spaced as `spacing` says.
 * The first and the last along the axis stay where they are.
 */
export function spaceOffsets(boxes: Box[], axis: Orientation, spacing: Spacing): Point[] {
    const start = (box: Box) => (axis === 'horizontal' ? box.topLeft.x : box.topLeft.y);
    const size = (box: Box) => (axis === 'horizontal' ? box.width : box.height);
    const center = (box: Box) => start(box) + size(box) / 2;
    const placeBy = spacing === 'between' ? start : center;
    const order = boxes
        .map((_, index) => index)
        .sort((a, b) => placeBy(boxes[a]) - placeBy(boxes[b]));
    const first = boxes[order[0]];
    const last = boxes[order[order.length - 1]];
    const inner = order.slice(1, -1);
    const shifts = boxes.map(() => 0);

    if (spacing === 'between') {
        const filled = inner.reduce((sum, index) => sum + size(boxes[index]), 0);
        const gap = (start(last) - start(first) - size(first) - filled) / (order.length - 1);
        let next = start(first) + size(first) + gap;

        for (const index of inner) {
            shifts[index] = next - start(boxes[index]);
            next += size(boxes[index]) + gap;
        }
    } else {
        const step = (center(last) - center(first)) / (order.length - 1);

        inner.forEach((index, position) => {
            shifts[index] = center(first) + step * (position + 1) - center(boxes[index]);
        });
    }

    return shifts.map((shift) => (axis === 'horizontal' ? across(shift) : down(shift)));
}
