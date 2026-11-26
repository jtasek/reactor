import { frameLayout, renderedShape, hasLayoutOffset } from './frameLayout';
import { frameState } from './frameState';
import type { BorderStyle, Box, Document, Shape } from './types';
import { BORDER_STYLES } from './boxModel';
import { DEFAULT_BORDER_WIDTH } from './border';
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
import { escapeTemplate, templateWithNames } from './variables';

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
          /**
           * For a part of the shape's box: `read` is this of `getShapeBounds`,
           * so a list of shapes measures each once for all four.
           */
          fromBox?: (box: Box) => number;
      }
    | {
          kind: 'boolean';
          read: (shape: Shape, document: Document) => boolean | undefined;
          write?: (shape: Shape, value: boolean) => void;
      }
    | {
          /** One of a few named values, as `options` lists them. */
          kind: 'choice';
          /** `icon` is an SVG path drawn in a 24 × 16 box in place of the label. */
          options: readonly { value: string; label: string; icon?: string }[];
          read: (shape: Shape, document: Document) => string | undefined;
          write?: (shape: Shape, value: string) => void;
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
const stackDimensionEditable = (axis: 'width' | 'height') => (shape: Shape, document: Document) =>
    (shape.sizing?.[axis]?.mode ?? 'fixed') === 'fixed' &&
    (shape.type === 'rectangle' || shape.type === 'image') &&
    (shape.type === 'rectangle' || hasLayoutOffset(document, [shape.id])) &&
    !isShapeLocked(document, shape.id);

function writeStackDimension(shape: Shape, axis: 'width' | 'height', value: number) {
    if (
        (shape.type !== 'rectangle' && shape.type !== 'image') ||
        value <= 0 ||
        !Number.isFinite(value)
    ) {
        return;
    }

    const other = axis === 'width' ? 'height' : 'width';
    const size =
        shape.type === 'image'
            ? {
                  ...shape.size,
                  [axis]: value,
                  [other]: (shape.size[other] * value) / shape.size[axis]
              }
            : { ...shape.size, [axis]: value };
    shape.size = size;
    delete shape.bounds;
}

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

/** A number read from the shape's box, as `fromBox` describes. */
const boxPart = (fromBox: (box: Box) => number) => ({
    fromBox,
    read: (shape: Shape) => fromBox(getShapeBounds(shape))
});

/** The properties the panel offers, in display order, grouped into sections. */
export const SHAPE_PROPERTIES: ShapeProperty[] = [
    {
        key: 'name',
        label: 'Name',
        group: 'Identity',
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
        group: 'Layout',
        kind: 'number',
        ...boxPart((box) => box.topLeft.x),
        write: (shape, value) =>
            translateShape(shape, { x: value - getShapeBounds(shape).topLeft.x, y: 0 })
    },
    {
        key: 'y',
        label: 'Y',
        group: 'Layout',
        kind: 'number',
        ...boxPart((box) => box.topLeft.y),
        write: (shape, value) =>
            translateShape(shape, { x: 0, y: value - getShapeBounds(shape).topLeft.y })
    },
    {
        key: 'width',
        label: 'Width',
        group: 'Layout',
        kind: 'number',
        ...boxPart((box) => box.width),
        editable: stackDimensionEditable('width'),
        write: (shape, value) => writeStackDimension(shape, 'width', value)
    },
    {
        key: 'height',
        label: 'Height',
        group: 'Layout',
        kind: 'number',
        ...boxPart((box) => box.height),
        editable: stackDimensionEditable('height'),
        write: (shape, value) => writeStackDimension(shape, 'height', value)
    },
    {
        key: 'rotation',
        label: 'Rotation',
        group: 'Layout',
        kind: 'number',
        read: (shape) => shape.rotation ?? 0,
        write: (shape, value) => {
            shape.rotation = value;
        }
    },
    {
        key: 'cornerRadius',
        label: 'Radius',
        group: 'Appearance',
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
        key: 'opacity',
        label: 'Opacity (%)',
        group: 'Appearance',
        kind: 'number',
        range: { min: 0, max: OPAQUE_PERCENT, step: 1 },
        read: (shape) => Math.round((shape.opacity ?? 1) * OPAQUE_PERCENT),
        write: (shape, value) => {
            shape.opacity = Math.min(OPAQUE_PERCENT, Math.max(0, value)) / OPAQUE_PERCENT;
        }
    },
    colorProperty('fill', 'Fill', 'Appearance', isClosedShape),
    colorProperty('stroke', 'Stroke', 'Border', isStrokedShape),
    {
        key: 'borderWidth',
        label: 'Thickness',
        group: 'Border',
        kind: 'number',
        read: (shape) =>
            isStrokedShape(shape) ? (shape.borderWidth ?? DEFAULT_BORDER_WIDTH) : undefined,
        accepts: (value) => value >= 0,
        write: (shape, value) => {
            if (!isStrokedShape(shape) || value < 0) {
                return;
            }
            if (value === DEFAULT_BORDER_WIDTH) {
                delete shape.borderWidth;
            } else {
                shape.borderWidth = value;
            }
        }
    },
    {
        key: 'borderStyle',
        label: 'Style',
        group: 'Border',
        kind: 'choice',
        options: [
            { value: 'solid', label: 'Solid', icon: 'M3 8h18' },
            { value: 'dashed', label: 'Dashed', icon: 'M3 8h5M10 8h4M16 8h5' },
            { value: 'dotted', label: 'Dotted', icon: 'M3 8h0M7.5 8h0M12 8h0M16.5 8h0M21 8h0' }
        ],
        read: (shape) => (isStrokedShape(shape) ? (shape.borderStyle ?? 'solid') : undefined),
        write: (shape, value) => {
            if (!isStrokedShape(shape) || !BORDER_STYLES.includes(value as BorderStyle)) {
                return;
            }
            if (value === 'solid') {
                delete shape.borderStyle;
            } else {
                shape.borderStyle = value as BorderStyle;
            }
        }
    },
    {
        key: 'arrow',
        label: 'End',
        group: 'Border',
        kind: 'choice',
        options: [
            { value: 'none', label: 'No arrowhead', icon: 'M3 8h18' },
            { value: 'arrow', label: 'Arrowhead', icon: 'M3 8h17M15 3l6 5-6 5' }
        ],
        read: (shape) => (shape.type === 'line' ? (shape.arrow ? 'arrow' : 'none') : undefined),
        write: (shape, value) => {
            if (shape.type !== 'line') {
                return;
            }
            if (value === 'arrow') {
                shape.arrow = true;
            } else {
                delete shape.arrow;
            }
        }
    },
    {
        key: 'visible',
        label: 'Visible',
        group: 'State',
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
        group: 'State',
        kind: 'boolean',
        // Shows every lock, but only the shape's own lock can be changed here.
        editable: (shape, document) => !isShapeLockedExternally(document, shape.id),
        read: (shape, document) => isShapeLocked(document, shape.id),
        write: (shape, value) => {
            shape.locked = value;
        }
    },
    {
        key: 'text',
        label: 'Text',
        group: 'Text',
        kind: 'text',
        // A template shows with its variables' names, and other text with `${` escaped,
        // so writing back what is shown keeps the text as it is.
        read: (shape, document) => {
            if (shape.type !== 'text') {
                return undefined;
            }

            return shape.template === undefined
                ? escapeTemplate(shape.value)
                : templateWithNames(shape.template, document.variables);
        },
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
    {
        key: 'fontWeight',
        label: 'Font weight',
        group: 'Text',
        kind: 'number',
        read: (shape) => (shape.type === 'text' ? (shape.fontWeight ?? 400) : undefined),
        accepts: (value) => Number.isInteger(value) && value >= 100 && value <= 900,
        write: (shape, value) => {
            if (shape.type === 'text' && Number.isInteger(value) && value >= 100 && value <= 900) {
                shape.fontWeight = value;
            }
        }
    },
    {
        key: 'wrapWidth',
        label: 'Wrap width (0 = auto)',
        group: 'Text',
        kind: 'number',
        read: (shape) => (shape.type === 'text' ? (shape.wrapWidth ?? 0) : undefined),
        accepts: (value) => value >= 0,
        write: (shape, value) => {
            if (shape.type === 'text' && value > 0) {
                shape.wrapWidth = value;
            } else if (shape.type === 'text' && value === 0) {
                delete shape.wrapWidth;
            }
        }
    },
    colorProperty('fontColor', 'Font color', 'Text', (shape) => shape.type === 'text')
];

/** Whether `property` may be changed on `shape` now. */
export function canEdit(property: ShapeProperty, shape: Shape, document: Document): boolean {
    if (!property.write || frameState(document, shape.parentFrameId)?.lockedBy !== undefined) {
        return false;
    }

    if (['x', 'y'].includes(property.key) && frameLayout(document).managedShapes.has(shape.id)) {
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

    // Laid out once per shape, not once per shape and property; and measured
    // once, not once for each of X, Y, Width and Height.
    const drawn = shapes.map((shape) => renderedShape(document, shape.id));
    let boxes: Box[] | undefined;
    const read = (property: ShapeProperty) => {
        if (property.kind === 'number' && property.fromBox) {
            boxes ??= drawn.map((shape) => getShapeBounds(shape));

            return boxes.map(property.fromBox);
        }

        return drawn.map((shape) => property.read(shape, document));
    };

    return SHAPE_PROPERTIES.flatMap((property) => {
        const values = read(property).map(shown);

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
        case 'choice':
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
