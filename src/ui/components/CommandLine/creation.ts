import type { AddShape } from 'src/app/operations';
import type { Point } from 'src/app/types';

export const CREATIONS = [
    {
        id: 'create rectangle',
        name: 'Create rectangle',
        description: 'width=160 height=48 fill=#3366ff'
    },
    { id: 'create circle', name: 'Create circle', description: 'radius=24 fill=#3366ff' },
    { id: 'create text', name: 'Create text', description: 'value="Text" fontSize=24' }
];

const PROPERTY_ALIASES = new Map([
    ['w', 'width'],
    ['h', 'height'],
    ['r', 'radius'],
    ['fs', 'fontSize'],
    ['fontsize', 'fontSize'],
    ['font-size', 'fontSize'],
    ['text', 'value']
]);

/** Whether the input names a shape to create, before any parameters. */
export const CREATION_PATTERN = /^(?:create\s+)?(rectangle|circle|text)\b/i;

export const PROPERTY_ALIAS_HELP =
    'Aliases: w=width, h=height, r=radius, fs/font-size=fontSize, text=value.';

/** A deliberately small named-argument syntax; quoted strings use JSON escaping. */
export function creationOperation(
    input: string,
    center: Point,
    target?: { origin: Point; parentFrameId?: string }
): AddShape | undefined {
    const match = CREATION_PATTERN.exec(input.trim());

    if (!match) {
        return undefined;
    }

    const type = match[1].toLowerCase();
    const rest = input.trim().slice(match[0].length);
    const values = readParameters(rest);

    const allowed = [
        'x',
        'y',
        'fill',
        'name',
        ...(type === 'rectangle'
            ? ['width', 'height']
            : type === 'circle'
              ? ['radius']
              : ['value', 'fontSize'])
    ];
    const unknown = Object.keys(values).find((key) => !allowed.includes(key));

    if (unknown) {
        throw new Error(`Unknown parameter ${unknown}. Available: ${allowed.join(', ')}.`);
    }

    const number = (key: string, fallback: number, positive = false) => {
        const value = values[key] === undefined ? fallback : Number(values[key]);

        if (!Number.isFinite(value) || values[key] === '' || (positive && value <= 0)) {
            throw new Error(`${key} must be a ${positive ? 'positive ' : ''}finite number.`);
        }

        return value;
    };

    if (values.fill !== undefined && !/^#[0-9a-f]{6}$/i.test(values.fill)) {
        throw new Error('fill must be a six-digit hex color, such as #3366ff.');
    }

    const origin = target?.origin ?? { x: 0, y: 0 };
    const common = {
        ...(target?.parentFrameId ? { parentFrameId: target.parentFrameId } : {}),
        ...(values.name !== undefined ? { name: values.name } : {}),
        ...(values.fill !== undefined ? { fill: values.fill } : {})
    };
    const position = { x: number('x', center.x) + origin.x, y: number('y', center.y) + origin.y };

    if (type === 'rectangle') {
        const size = { width: number('width', 160, true), height: number('height', 48, true) };

        return {
            op: 'addShape',
            key: 'created',
            shape: {
                ...common,
                type,
                position: {
                    x: number('x', center.x - size.width / 2) + origin.x,
                    y: number('y', center.y - size.height / 2) + origin.y
                },
                size
            }
        };
    }

    if (type === 'circle') {
        return {
            op: 'addShape',
            key: 'created',
            shape: { ...common, type, position, radius: number('radius', 24, true) }
        };
    }

    // Text takes its color from fontColor, so fill colors the text.
    const { fill, ...named } = common;

    return {
        op: 'addShape',
        key: 'created',
        shape: {
            ...named,
            ...(fill !== undefined ? { fontColor: fill } : {}),
            type: 'text',
            position,
            value: values.value ?? 'Text',
            fontSize: number('fontSize', 24, true)
        }
    };
}

export function readParameters(rest: string): Record<string, string> {
    const values: Record<string, string> = {};
    const token = /\s+([a-zA-Z][a-zA-Z-]*)=("(?:[^"\\]|\\.)*"|[^\s"]*)/y;
    let offset = 0;

    while (rest.slice(offset).trim()) {
        token.lastIndex = offset;
        const found = token.exec(rest);

        if (!found) {
            throw new Error(
                'Use name=value parameters. Put text containing spaces in double quotes.'
            );
        }

        const [, spelling, raw] = found;
        const key = PROPERTY_ALIASES.get(spelling.toLowerCase()) ?? spelling.toLowerCase();

        if (Object.hasOwn(values, key)) {
            throw new Error(`Parameter ${key} is repeated.`);
        }

        if (raw === '') {
            throw new Error(`${key} needs a value.`);
        }

        values[key] = raw.startsWith('"') ? quoted(key, raw) : raw;
        offset = token.lastIndex;
    }

    return values;
}

function quoted(key: string, raw: string): string {
    try {
        return JSON.parse(raw) as string;
    } catch {
        throw new Error(
            `${key} has an invalid escape. Use \\" for a quote and \\\\ for a backslash.`
        );
    }
}
