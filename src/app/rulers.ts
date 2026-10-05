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
