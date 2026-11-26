import type { Term } from './fuzzy';

/** A shape as the chat's context describes it: its saved fields, read loosely. */
export type ShapeFields = Record<string, unknown>;

/** The fields an `updateShape` operation changes. */
export type Changes = Record<string, unknown>;

export interface Box {
    left: number;
    top: number;
    width: number;
    height: number;
}

/** How much a relative request changes a property when it names no amount. */
export const STEPS = {
    move: 20,
    size: 20,
    cornerRadius: 4,
    fontSize: 2,
    fontWeight: 100,
    opacity: 0.1,
    rotation: 15,
    /** How far a copy lands from its original. */
    copy: 20
};

/** Text is not measured here; its box is estimated from its font size. */
const TEXT = { fontSize: 16, glyphWidth: 0.55, lineHeight: 1.2 };

const number = (value: unknown, fallback = 0) => (typeof value === 'number' ? value : fallback);
const fields = (value: unknown): ShapeFields =>
    value && typeof value === 'object' ? (value as ShapeFields) : {};
const xy = (value: unknown) => ({ x: number(fields(value).x), y: number(fields(value).y) });
const round = (value: number) => Math.round(value * 100) / 100;

/** The box a shape covers, as far as its fields tell; nothing for shapes without a place. */
export function box(shape: ShapeFields): Box | undefined {
    const position = xy(shape.position);

    switch (shape.type) {
        case 'ellipse': {
            const radius = xy(shape.radius);

            return {
                left: position.x - radius.x,
                top: position.y - radius.y,
                width: radius.x * 2,
                height: radius.y * 2
            };
        }
        case 'line': {
            const start = xy(shape.start);
            const end = xy(shape.end);

            return {
                left: Math.min(start.x, end.x),
                top: Math.min(start.y, end.y),
                width: Math.abs(end.x - start.x),
                height: Math.abs(end.y - start.y)
            };
        }
        case 'text': {
            const size = number(shape.fontSize, TEXT.fontSize);
            const lines = String(shape.value ?? '').split('\n');
            const longest = Math.max(...lines.map((line) => line.length));

            // Its position is the left end of the first baseline.
            return {
                left: position.x,
                top: position.y - size,
                width: number(shape.wrapWidth) || longest * size * TEXT.glyphWidth,
                height: lines.length * size * TEXT.lineHeight
            };
        }
        default: {
            if (!shape.position) {
                return undefined;
            }
            const size = fields(shape.size);

            return {
                left: position.x,
                top: position.y,
                width: number(size.width),
                height: number(size.height)
            };
        }
    }
}

/** The change that moves a shape by `dx` and `dy`; nothing for shapes that cannot be moved here. */
export function translate(shape: ShapeFields, dx: number, dy: number): Changes | undefined {
    if (shape.type === 'line') {
        const start = xy(shape.start);
        const end = xy(shape.end);

        return {
            start: { x: round(start.x + dx), y: round(start.y + dy) },
            end: { x: round(end.x + dx), y: round(end.y + dy) }
        };
    }
    if (!shape.position) {
        return undefined;
    }
    const position = xy(shape.position);

    return { position: { x: round(position.x + dx), y: round(position.y + dy) } };
}

export type PropertyId =
    | 'name'
    | 'value'
    | 'fill'
    | 'fontColor'
    | 'stroke'
    | 'fontSize'
    | 'fontWeight'
    | 'opacity'
    | 'rotation'
    | 'cornerRadius'
    | 'width'
    | 'height'
    | 'x'
    | 'y';

/**
 * A property the local model can read and change on the shapes it applies to.
 * `read` gives nothing where it does not apply; `write` gives the fields to change.
 */
export interface Property extends Term<PropertyId> {
    label: string;
    kind: 'text' | 'color' | 'number';
    /** What a relative request adds or takes away by default. */
    step?: number;
    read: (shape: ShapeFields) => string | number | undefined;
    write: (shape: ShapeFields, value: string | number) => Changes | undefined;
    /** How a value reads in an answer. */
    show?: (value: string | number) => string;
}

const sized = new Set(['rectangle', 'image', 'instance']);
const stroked = new Set(['rectangle', 'ellipse', 'path', 'line']);
const positive = (value: string | number) => (typeof value === 'number' && value > 0 ? value : 0);

const color = (
    id: 'fill' | 'fontColor' | 'stroke',
    label: string,
    phrases: string[],
    applies: (shape: ShapeFields) => boolean
): Property => ({
    id,
    label,
    phrases,
    kind: 'color',
    read: (shape) => (applies(shape) ? String(shape[id] ?? 'none') : undefined),
    write: (shape, value) => (applies(shape) ? { [id]: value } : undefined)
});

const dimension = (axis: 'width' | 'height', phrases: string[]): Property => ({
    id: axis,
    label: axis,
    phrases,
    kind: 'number',
    step: STEPS.size,
    read: (shape) =>
        sized.has(String(shape.type)) || shape.type === 'ellipse'
            ? round(box(shape)?.[axis] ?? 0)
            : undefined,
    write: (shape, value) => {
        const length = positive(value);

        if (!length) {
            return undefined;
        }
        if (shape.type === 'ellipse') {
            return {
                radius: { ...xy(shape.radius), [axis === 'width' ? 'x' : 'y']: length / 2 }
            };
        }

        return sized.has(String(shape.type)) && shape.size
            ? { size: { ...fields(shape.size), [axis]: length } }
            : undefined;
    }
});

const place = (axis: 'x' | 'y'): Property => ({
    id: axis,
    label: axis.toUpperCase(),
    phrases: [axis],
    kind: 'number',
    step: STEPS.move,
    read: (shape) => {
        const bounds = box(shape);

        return bounds && round(axis === 'x' ? bounds.left : bounds.top);
    },
    write: (shape, value) => {
        const bounds = box(shape);

        if (!bounds || typeof value !== 'number') {
            return undefined;
        }

        return axis === 'x'
            ? translate(shape, value - bounds.left, 0)
            : translate(shape, 0, value - bounds.top);
    }
});

/** The properties the local model knows, the more specific phrases first. */
export const PROPERTIES: Property[] = [
    {
        id: 'name',
        label: 'name',
        phrases: ['name', 'named', 'called'],
        kind: 'text',
        read: (shape) => String(shape.name ?? ''),
        write: (_shape, value) => (String(value).trim() ? { name: String(value) } : undefined)
    },
    {
        id: 'value',
        label: 'text',
        phrases: ['text', 'content', 'caption', 'label', 'wording', 'says', 'saying'],
        kind: 'text',
        read: (shape) => (shape.type === 'text' ? String(shape.value ?? '') : undefined),
        write: (shape, value) =>
            shape.type === 'text' && String(value).trim() ? { value: String(value) } : undefined
    },
    color(
        'fontColor',
        'font color',
        ['font color', 'text color', 'color', 'colour', 'fc'],
        (shape) => shape.type === 'text'
    ),
    color(
        'fill',
        'fill',
        ['fill', 'background', 'color', 'colour', 'bg'],
        (shape) =>
            shape.type === 'rectangle' ||
            shape.type === 'ellipse' ||
            (shape.type === 'path' && shape.closed === true)
    ),
    color('stroke', 'stroke', ['stroke', 'outline', 'border', 'line color'], (shape) =>
        stroked.has(String(shape.type))
    ),
    {
        id: 'fontSize',
        label: 'font size',
        phrases: ['font size', 'text size', 'fontsize', 'fs', 'size'],
        kind: 'number',
        step: STEPS.fontSize,
        read: (shape) =>
            shape.type === 'text' ? number(shape.fontSize, TEXT.fontSize) : undefined,
        write: (shape, value) =>
            shape.type === 'text' && positive(value) ? { fontSize: value } : undefined
    },
    {
        id: 'fontWeight',
        label: 'font weight',
        phrases: ['font weight', 'weight', 'boldness'],
        kind: 'number',
        step: STEPS.fontWeight,
        read: (shape) => (shape.type === 'text' ? number(shape.fontWeight, 400) : undefined),
        write: (shape, value) =>
            shape.type === 'text' && positive(value)
                ? { fontWeight: Math.min(900, Math.max(100, Number(value))) }
                : undefined
    },
    {
        id: 'opacity',
        label: 'opacity',
        phrases: ['opacity', 'alpha', 'transparency'],
        kind: 'number',
        step: STEPS.opacity,
        read: (shape) => number(shape.opacity, 1),
        // Whole numbers are percent, as the Inspector shows opacity.
        write: (_shape, value) =>
            typeof value === 'number'
                ? { opacity: round(Math.min(1, Math.max(0, value > 1 ? value / 100 : value))) }
                : undefined,
        show: (value) => `${Math.round(Number(value) * 100)}%`
    },
    {
        id: 'rotation',
        label: 'rotation',
        phrases: ['rotation', 'angle', 'rotated'],
        kind: 'number',
        step: STEPS.rotation,
        read: (shape) => number(shape.rotation),
        write: (_shape, value) => (typeof value === 'number' ? { rotation: value } : undefined),
        show: (value) => `${value}°`
    },
    {
        id: 'cornerRadius',
        label: 'corner radius',
        phrases: ['corner radius', 'corners', 'rounding', 'roundness', 'radius', 'r'],
        kind: 'number',
        step: STEPS.cornerRadius,
        read: (shape) => (shape.type === 'rectangle' ? number(shape.cornerRadius) : undefined),
        write: (shape, value) =>
            shape.type === 'rectangle' && typeof value === 'number' && value >= 0
                ? { cornerRadius: value }
                : undefined
    },
    dimension('width', ['width', 'wide', 'w']),
    dimension('height', ['height', 'high', 'tall', 'h']),
    place('x'),
    place('y')
];

export const property = (id: PropertyId) => PROPERTIES.find((item) => item.id === id)!;

/** A property's value on a shape, as an answer shows it. */
export function shown(item: Property, shape: ShapeFields): string | undefined {
    const value = item.read(shape);

    return value === undefined ? undefined : (item.show?.(value) ?? String(value));
}
