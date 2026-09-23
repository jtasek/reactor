import type { Shape } from './types';
import { translateShape } from './geometry';
import { DEFAULT_TEXT_FONT_SIZE, getShapeBounds } from './utils';

export type PropertyValue = string | number | boolean;

/**
 * A property the property panel shows. `read` returns undefined when the
 * property does not apply to a shape; without `write` it is read-only. Only
 * properties marked `whileLocked` (metadata such as the name) change on locked
 * shapes.
 */
export type ShapeProperty = { key: string; label: string; whileLocked?: boolean } & (
    | {
          kind: 'text';
          read: (shape: Shape) => string | undefined;
          write?: (shape: Shape, value: string) => void;
      }
    | {
          kind: 'number';
          read: (shape: Shape) => number | undefined;
          write?: (shape: Shape, value: number) => void;
      }
    | {
          kind: 'boolean';
          read: (shape: Shape) => boolean | undefined;
          write?: (shape: Shape, value: boolean) => void;
      }
);

/** The properties the panel offers, in display order. */
export const SHAPE_PROPERTIES: ShapeProperty[] = [
    {
        key: 'name',
        label: 'Name',
        kind: 'text',
        whileLocked: true,
        read: (shape) => shape.name,
        write: (shape, value) => {
            if (value.trim()) {
                shape.name = value.trim();
            }
        }
    },
    {
        key: 'x',
        label: 'X',
        kind: 'number',
        read: (shape) => getShapeBounds(shape).topLeft.x,
        write: (shape, value) =>
            translateShape(shape, { x: value - getShapeBounds(shape).topLeft.x, y: 0 })
    },
    {
        key: 'y',
        label: 'Y',
        kind: 'number',
        read: (shape) => getShapeBounds(shape).topLeft.y,
        write: (shape, value) =>
            translateShape(shape, { x: 0, y: value - getShapeBounds(shape).topLeft.y })
    },
    { key: 'width', label: 'Width', kind: 'number', read: (shape) => getShapeBounds(shape).width },
    {
        key: 'height',
        label: 'Height',
        kind: 'number',
        read: (shape) => getShapeBounds(shape).height
    },
    {
        key: 'rotation',
        label: 'Rotation',
        kind: 'number',
        read: (shape) => shape.rotation ?? 0,
        write: (shape, value) => {
            shape.rotation = value;
        }
    },
    {
        key: 'text',
        label: 'Text',
        kind: 'text',
        read: (shape) => (shape.type === 'text' ? shape.value : undefined),
        write: (shape, value) => {
            if (shape.type === 'text') {
                shape.value = value;
            }
        }
    },
    {
        key: 'fontSize',
        label: 'Font size',
        kind: 'number',
        read: (shape) =>
            shape.type === 'text' ? (shape.fontSize ?? DEFAULT_TEXT_FONT_SIZE) : undefined,
        write: (shape, value) => {
            if (shape.type === 'text' && value > 0) {
                shape.fontSize = value;
            }
        }
    },
    {
        key: 'visible',
        label: 'Visible',
        kind: 'boolean',
        whileLocked: true,
        read: (shape) => shape.visible,
        write: (shape, value) => {
            shape.visible = value;
        }
    },
    {
        key: 'locked',
        label: 'Locked',
        kind: 'boolean',
        whileLocked: true,
        read: (shape) => shape.locked,
        write: (shape, value) => {
            shape.locked = value;
        }
    }
];

/** A property shared by every selected shape: its common value, or `mixed`. */
export type PropertyRow = { property: ShapeProperty; value?: PropertyValue; mixed: boolean };

// Numbers are compared as the panel shows them, so float noise does not read as mixed.
const shown = (value: PropertyValue | undefined) =>
    typeof value === 'number' ? Math.round(value * 100) / 100 : value;

/** The properties that apply to every one of `shapes`, with their shared value. */
export function sharedProperties(shapes: Shape[]): PropertyRow[] {
    if (shapes.length === 0) {
        return [];
    }

    return SHAPE_PROPERTIES.flatMap((property) => {
        const values = shapes.map((shape) => shown(property.read(shape)));

        if (values.some((value) => value === undefined)) {
            return [];
        }

        const mixed = values.some((value) => value !== values[0]);

        return [{ property, value: mixed ? undefined : values[0], mixed }];
    });
}

/** Writes `value` to `shape` when the property is editable and `value` has its type. */
export function applyProperty(property: ShapeProperty, shape: Shape, value: PropertyValue) {
    switch (property.kind) {
        case 'text':
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
