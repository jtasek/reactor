import type { BorderStyle } from './types';

/** Matches the canvas's `.shape` stroke width, which outlines have always had. */
export const DEFAULT_BORDER_WIDTH = 2;

/** The SVG dash pattern of a border's style, scaled by its width; none for solid. */
export function borderDash(style: BorderStyle | undefined, width: number): string | undefined {
    switch (style) {
        case 'dashed':
            return `${3 * width} ${2 * width}`;
        case 'dotted':
            return `${width} ${width}`;
        default:
            return undefined;
    }
}

/** The CSS properties that draw a shape's border on the canvas: see `.shape`. */
export function borderStyleVariables(shape: { borderWidth?: number; borderStyle?: BorderStyle }) {
    const width = shape.borderWidth ?? DEFAULT_BORDER_WIDTH;

    return {
        '--shape-stroke-width': width,
        '--shape-stroke-dash': borderDash(shape.borderStyle, width) ?? 'none'
    };
}
