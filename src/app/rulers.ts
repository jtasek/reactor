import type { Orientation } from 'src/app/types';

/** How close, in screen pixels, two labels on a ruler may come. */
const LABEL_SPACING_PX = 50;

/** The multiples of each power of ten a ruler labels. */
const STEP_MANTISSAS = [1, 2, 5];

/** A mark on a ruler: where it is in screen pixels, and its canvas unit if it is labeled. */
export type RulerMark = { at: number; label: string | null };

/** The canvas units between a ruler's labels: the smallest 1, 2 or 5 × 10ⁿ far enough apart. */
function labelStep(scale: number) {
    const least = LABEL_SPACING_PX / scale;
    let power = 10 ** Math.floor(Math.log10(least));

    for (;;) {
        const mantissa = STEP_MANTISSAS.find((candidate) => candidate * power >= least);

        if (mantissa !== undefined) {
            return { mantissa, power };
        }

        power *= 10;
    }
}

/**
 * The marks along a ruler `length` screen pixels long, whose canvas unit 0 is at
 * `offset`: a step is split in quarters when it is 2 × 10ⁿ and in fifths otherwise.
 */
export function rulerMarks(offset: number, scale: number, length: number): RulerMark[] {
    const { mantissa, power } = labelStep(scale);
    const step = mantissa * power;
    const divisions = mantissa === 2 ? 4 : 5;
    const decimals = Math.max(0, -Math.floor(Math.log10(step / divisions)));
    const spacing = (step / divisions) * scale;
    const first = Math.ceil(-offset / spacing);
    const last = Math.floor((length - offset) / spacing);
    const marks: RulerMark[] = [];

    for (let index = first; index <= last; index++) {
        const value = (index * step) / divisions;

        marks.push({
            at: offset + index * spacing,
            label: index % divisions === 0 ? String(Number(value.toFixed(decimals))) : null
        });
    }

    return marks;
}

/** How thick the rulers along the canvas's top and left edges are, in screen pixels. */
export const RULER_SIZE_PX = 20;

/**
 * Where a guide dragged to `pointer` screen pixels from its canvas edge goes: the
 * whole canvas unit nearest it (`offset`), and where that unit is on screen (`at`),
 * for the camera's `cameraOffset` along the same axis and `scale`.
 */
export function guidePlace(pointer: number, cameraOffset: number, scale: number) {
    const offset = Math.round((pointer - cameraOffset) / scale);

    return { offset, at: offset * scale + cameraOffset };
}

/**
 * Whether a guide released `at` screen pixels from its canvas edge is removed: over
 * its ruler, `rulerSize` wide, or beyond the canvas's `length`.
 */
export const removesGuide = (at: number, rulerSize: number, length: number) =>
    at < rulerSize || at > length;

/** Where a dragged guide's position is shown, in screen pixels, and how its text lines up there. */
export type GuideLabelPlace = {
    x: number;
    y: number;
    anchor: 'start' | 'end';
    baseline: 'auto' | 'middle' | 'hanging';
};

/** How far from the pointer, in screen pixels, the label starts, clear of the resize cursor. */
const GUIDE_LABEL_GAP_PX = 12;
/** How far from its line, in screen pixels, a horizontal guide's label sits. */
const GUIDE_LABEL_LINE_GAP_PX = 6;
/** Room a label needs on one side before it flips to the other, in screen pixels. */
const GUIDE_LABEL_ROOM_PX = 48;
/** Half a label's height, in screen pixels, to keep it inside the canvas. */
const GUIDE_LABEL_HALF_PX = 10;

/**
 * Where a dragged guide's position goes: beside the pointer, which is `across`
 * screen pixels along the guide, so bars floating over the canvas's edges do not
 * cover it. It stays below and right of the rulers, `rulerSize` thick, and inside
 * the canvas, `bounds`, flipping to the pointer's other side near the right edge.
 */
export function guideLabelPlace(
    orientation: Orientation,
    at: number,
    across: number,
    bounds: { width: number; height: number },
    rulerSize: number
): GuideLabelPlace {
    if (orientation === 'vertical') {
        const end = at + GUIDE_LABEL_GAP_PX + GUIDE_LABEL_ROOM_PX > bounds.width;

        return {
            x: end ? at - GUIDE_LABEL_GAP_PX : at + GUIDE_LABEL_GAP_PX,
            y: Math.min(
                Math.max(across, rulerSize + GUIDE_LABEL_HALF_PX),
                bounds.height - GUIDE_LABEL_HALF_PX
            ),
            anchor: end ? 'end' : 'start',
            baseline: 'middle'
        };
    }

    const along = Math.max(across, rulerSize);
    const end = along + GUIDE_LABEL_GAP_PX + GUIDE_LABEL_ROOM_PX > bounds.width;
    const below = at - GUIDE_LABEL_LINE_GAP_PX - 2 * GUIDE_LABEL_HALF_PX < rulerSize;

    return {
        x: end ? along - GUIDE_LABEL_GAP_PX : along + GUIDE_LABEL_GAP_PX,
        y: below ? at + GUIDE_LABEL_LINE_GAP_PX : at - GUIDE_LABEL_LINE_GAP_PX,
        anchor: end ? 'end' : 'start',
        baseline: below ? 'hanging' : 'auto'
    };
}
