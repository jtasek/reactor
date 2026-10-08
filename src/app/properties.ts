import type { Document, Shape } from './types';
import { limitCornerRadius, translateShape } from './geometry';
import {
    DEFAULT_TEXT_FONT_SIZE,
    getShapeBounds,
    isClosedShape,
    isHexColor,
    isStrokedShape,
    isShapeLocked,
    isShapeLockedExternally
} from './utils';

export type PropertyValue = string | number | boolean;

/**
 * A property the inspector shows, listed under the section named by
 * `group`. `read` returns undefined when the property does not apply to a shape;
 * without `write` it is read-only. `editable` says whether it may change on a
 * shape now; by default only while the shape is not locked. `accepts` says which
 * values `write` takes; it leaves the shape as it is for others.
 */
export type ShapeProperty = {
    key: string;
    label: string;
    group: string;
    editable?: (shape: Shape, document: Document) => boolean;
} & (
    | {
          kind: 'text';
          read: (shape: Shape, document: Document) => string | undefined;
          write?: (shape: Shape, value: string) => void;
          accepts?: (value: string) => boolean;
      }
    | {
          kind: 'number';
          read: (shape: Shape, document: Document) => number | undefined;
          write?: (shape: Shape, value: number) => void;
          accepts?: (value: number) => boolean;
          /** The values a slider beside the field offers, when it has one. */
          range?: { min: number; max: number; step: number };
      }
    | {
          kind: 'boolean';
          read: (shape: Shape, document: Document) => boolean | undefined;
          write?: (shape: Shape, value: boolean) => void;
      }
    | {
          /** A `#rrggbb` color, or none as the empty string. */
          kind: 'color';
          read: (shape: Shape, document: Document) => string | undefined;
          write?: (shape: Shape, value: string) => void;
      }
);

/** The opacity of an opaque shape, as the inspector shows it, in percent. */
const OPAQUE_PERCENT = 100;

const notBlank = (value: string) => value.trim() !== '';

// Metadata may change on a locked shape, but not in a locked document.
const unlessDocumentLocked = (_shape: Shape, document: Document) => !document.locked;

/** A color of section `group`, for the shapes `applies` to; the empty string takes it off. */
const colorProperty = (
    key: 'fill' | 'stroke' | 'fontColor',
    label: string,
    group: string,
    applies: (shape: Shape) => boolean
): ShapeProperty => ({
    key,
    label,
    group,
    kind: 'color',
    read: (shape) => (applies(shape) ? (shape[key] ?? '') : undefined),
    write: (shape, value) => {
        if (value === '') {
            delete shape[key];

            return;
        }

        if (isHexColor(value)) {
            shape[key] = value;
        }
    }
});

/** The properties the panel offers, in display order, grouped into sections. */
export const SHAPE_PROPERTIES: ShapeProperty[] = [
    {
        key: 'name',
        label: 'Name',
        group: 'Shape',
        kind: 'text',
        editable: unlessDocumentLocked,
        read: (shape) => shape.name,
        accepts: notBlank,
        write: (shape, value) => {
            if (notBlank(value)) {
                shape.name = value.trim();
            }
        }
    },
    {
        key: 'x',
        label: 'X',
        group: 'Shape',
        kind: 'number',
        read: (shape) => getShapeBounds(shape).topLeft.x,
        write: (shape, value) =>
            translateShape(shape, { x: value - getShapeBounds(shape).topLeft.x, y: 0 })
    },
    {
        key: 'y',
        label: 'Y',
        group: 'Shape',
        kind: 'number',
        read: (shape) => getShapeBounds(shape).topLeft.y,
        write: (shape, value) =>
            translateShape(shape, { x: 0, y: value - getShapeBounds(shape).topLeft.y })
    },
    {
        key: 'width',
        label: 'Width',
        group: 'Shape',
        kind: 'number',
        read: (shape) => getShapeBounds(shape).width
    },
    {
        key: 'height',
        label: 'Height',
        group: 'Shape',
        kind: 'number',
        read: (shape) => getShapeBounds(shape).height
    },
    {
        key: 'cornerRadius',
        label: 'Radius',
        group: 'Shape',
        kind: 'number',
        read: (shape) =>
            shape.type === 'rectangle'
                ? limitCornerRadius(shape.size, shape.cornerRadius ?? 0)
                : undefined,
        write: (shape, value) => {
            if (shape.type === 'rectangle') {
                shape.cornerRadius = limitCornerRadius(shape.size, value);
            }
        }
    },
    {
        key: 'rotation',
        label: 'Rotation',
        group: 'Shape',
        kind: 'number',
        read: (shape) => shape.rotation ?? 0,
        write: (shape, value) => {
            shape.rotation = value;
        }
    },
    {
        key: 'visible',
        label: 'Visible',
        group: 'Shape',
        kind: 'boolean',
        editable: unlessDocumentLocked,
        read: (shape) => shape.visible,
        write: (shape, value) => {
            shape.visible = value;
        }
    },
    {
        key: 'locked',
        label: 'Locked',
        group: 'Shape',
        kind: 'boolean',
        // Shows every lock, but only the shape's own lock can be changed here.
        editable: (shape, document) => !isShapeLockedExternally(document, shape.id),
        read: (shape, document) => isShapeLocked(document, shape.id),
        write: (shape, value) => {
            shape.locked = value;
        }
    },
    {
        key: 'opacity',
        label: 'Opacity (%)',
        group: 'Style',
        kind: 'number',
        range: { min: 0, max: OPAQUE_PERCENT, step: 1 },
        read: (shape) => Math.round((shape.opacity ?? 1) * OPAQUE_PERCENT),
        write: (shape, value) => {
            shape.opacity = Math.min(OPAQUE_PERCENT, Math.max(0, value)) / OPAQUE_PERCENT;
        }
    },
    colorProperty('fill', 'Fill', 'Style', isClosedShape),
    colorProperty('stroke', 'Stroke', 'Style', isStrokedShape),
    {
        key: 'text',
        label: 'Text',
        group: 'Text',
        kind: 'text',
        read: (shape) => (shape.type === 'text' ? shape.value : undefined),
        // Like the text tool, never leave an invisible text shape.
        accepts: notBlank,
        write: (shape, value) => {
            if (shape.type === 'text' && notBlank(value)) {
                shape.value = value;
            }
        }
    },
    {
        key: 'fontSize',
        label: 'Font size',
        group: 'Text',
        kind: 'number',
        read: (shape) =>
            shape.type === 'text' ? (shape.fontSize ?? DEFAULT_TEXT_FONT_SIZE) : undefined,
        accepts: (value) => value > 0,
        write: (shape, value) => {
            if (shape.type === 'text' && value > 0) {
                shape.fontSize = value;
            }
        }
    },
    colorProperty('fontColor', 'Font color', 'Text', (shape) => shape.type === 'text')
];

/** Whether `property` may be changed on `shape` now. */
export function canEdit(property: ShapeProperty, shape: Shape, document: Document): boolean {
    if (!property.write) {
        return false;
    }

    return property.editable
        ? property.editable(shape, document)
        : !isShapeLocked(document, shape.id);
}

/**
 * A property shared by every selected shape: its common value, or `mixed`. It is
 * `readOnly` when it cannot be changed on any of them.
 */
export type PropertyRow = {
    property: ShapeProperty;
    value?: PropertyValue;
    mixed: boolean;
    readOnly: boolean;
};

// Numbers are compared as the panel shows them, so float noise does not read as mixed.
const shown = (value: PropertyValue | undefined) =>
    typeof value === 'number' ? Math.round(value * 100) / 100 : value;

/** The properties that apply to every one of `shapes`, with their shared value. */
export function sharedProperties(shapes: Shape[], document: Document): PropertyRow[] {
    if (shapes.length === 0) {
        return [];
    }

    return SHAPE_PROPERTIES.flatMap((property) => {
        const values = shapes.map((shape) => shown(property.read(shape, document)));

        if (values.some((value) => value === undefined)) {
            return [];
        }

        const mixed = values.some((value) => value !== values[0]);
        const readOnly = !shapes.some((shape) => canEdit(property, shape, document));

        return [{ property, value: mixed ? undefined : values[0], mixed, readOnly }];
    });
}

/** Writes `value` to `shape` when `value` has the property's type. */
export function applyProperty(property: ShapeProperty, shape: Shape, value: PropertyValue) {
    switch (property.kind) {
        case 'text':
        case 'color':
            if (typeof value === 'string') {
                property.write?.(shape, value);
            }
            break;
        case 'number':
            if (typeof value === 'number' && Number.isFinite(value)) {
                property.write?.(shape, value);
            }
            break;
        case 'boolean':
            if (typeof value === 'boolean') {
                property.write?.(shape, value);
            }
            break;
    }
}

/** The rows under each panel section, in the order the sections first appear. */
export function groupRows(rows: PropertyRow[]): { group: string; rows: PropertyRow[] }[] {
    const groups = new Map<string, PropertyRow[]>();

    for (const row of rows) {
        groups.set(row.property.group, [...(groups.get(row.property.group) ?? []), row]);
    }

    return Array.from(groups, ([group, grouped]) => ({ group, rows: grouped }));
}
