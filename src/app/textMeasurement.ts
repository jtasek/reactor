import type { Text } from './types';
import { DEFAULT_TEXT_FONT_SIZE, rectToBox } from './utils';

const MAX_CACHE_ENTRIES = 1000;
const LINE_HEIGHT = 1.2;
const FALLBACK_CHAR_WIDTH = 0.6;
const FALLBACK_ASCENT = 0.8;
const FALLBACK_DESCENT = 0.2;
const measurements = new Map<string, ReturnType<typeof measure>>();
let canvas: CanvasRenderingContext2D | null | undefined;

function metrics(value: string, fontSize: number) {
    if (canvas === undefined) {
        canvas =
            typeof document === 'undefined'
                ? null
                : document.createElement('canvas').getContext('2d');
    }

    if (!canvas) {
        return {
            width: value.length * fontSize * FALLBACK_CHAR_WIDTH,
            left: 0,
            right: value.length * fontSize * FALLBACK_CHAR_WIDTH,
            ascent: fontSize * FALLBACK_ASCENT,
            descent: fontSize * FALLBACK_DESCENT
        };
    }

    canvas.font = `${fontSize}px Roboto, sans-serif`;
    const measured = canvas.measureText(value);

    return {
        width: measured.width,
        left: 0,
        right: measured.width,
        ascent: measured.fontBoundingBoxAscent,
        descent: measured.fontBoundingBoxDescent
    };
}

function wrap(value: string, fontSize: number, width: number): string[] {
    const lines: string[] = [];
    let line = '';

    for (const word of value.trim().replace(/\s+/g, ' ').split(/(\s+)/)) {
        if (line && metrics(line + word, fontSize).width > width) {
            lines.push(line.trimEnd());
            line = '';
        }

        for (const character of word) {
            if (!line && /\s/.test(character)) {
                continue;
            }
            if (line && metrics(line + character, fontSize).width > width) {
                lines.push(line);
                line = '';
            }
            line += character;
        }
    }
    lines.push(line);

    return lines;
}

function measure(value: string, fontSize: number, width?: number) {
    const lines = width
        ? value.split(/\r?\n/).flatMap((line) => wrap(line, fontSize, width))
        : [value.trim().replace(/\s+/g, ' ')];
    const lineHeight = fontSize * LINE_HEIGHT;
    const boxes = lines.map((line, index) => {
        const size = metrics(line, fontSize);

        return {
            left: -size.left,
            right: size.right,
            top: index * lineHeight - size.ascent,
            bottom: index * lineHeight + size.descent
        };
    });
    const left = Math.min(...boxes.map((box) => box.left));
    const top = Math.min(...boxes.map((box) => box.top));
    const right = Math.max(...boxes.map((box) => box.right));
    const bottom = Math.max(...boxes.map((box) => box.bottom));

    return { lines, lineHeight, left, top, width: right - left, height: bottom - top };
}

/** Measures once per resolved context; positions and selections do not invalidate metrics. */
export function measureContextualText(
    shape: Text,
    contextKey: string,
    availableWidth?: number
): Text {
    const fontSize = shape.fontSize ?? DEFAULT_TEXT_FONT_SIZE;
    const width = shape.wrapWidth
        ? Math.max(1, Math.min(shape.wrapWidth, availableWidth ?? shape.wrapWidth))
        : undefined;
    const key = JSON.stringify([contextKey, shape.value, fontSize, width]);
    const measured = measurements.get(key) ?? measure(shape.value, fontSize, width);

    if (measurements.size >= MAX_CACHE_ENTRIES) {
        measurements.clear();
    }
    measurements.set(key, measured);

    return {
        ...shape,
        textLayout: { lines: measured.lines, lineHeight: measured.lineHeight },
        bounds: rectToBox({
            x: shape.position.x + measured.left,
            y: shape.position.y + measured.top,
            width: measured.width,
            height: measured.height
        })
    };
}
