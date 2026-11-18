import type { BorderStyle, Sides, StackRules } from './types';

/**
 * The box model: margin outside a shape or frame, its border, and the padding a
 * stack frame keeps inside. Margin and padding are kept per side.
 */
export const SIDES = ['top', 'right', 'bottom', 'left'] as const;
export type Side = (typeof SIDES)[number];
export type SpacingBox = 'margin' | 'padding';

export const BORDER_STYLES: readonly BorderStyle[] = ['solid', 'dashed', 'dotted'];

export const NO_SIDES: Sides = Object.freeze({ top: 0, right: 0, bottom: 0, left: 0 });

export const allSides = (value: number): Sides => ({
    top: value,
    right: value,
    bottom: value,
    left: value
});

export const sidesOf = (value: Sides | undefined): Sides => value ?? NO_SIDES;

export const hasSpace = (value: Sides | undefined) =>
    Boolean(value && SIDES.some((side) => value[side] !== 0));

/** The padding a stack keeps inside, side by side. */
export const stackPadding = (rules: StackRules): Sides =>
    rules.paddingSides ?? allSides(rules.padding);

/** What `sides` take up along an axis: left and right across, top and bottom down. */
export const spaceAlong = (sides: Sides, axis: 'width' | 'height') =>
    axis === 'width' ? sides.left + sides.right : sides.top + sides.bottom;

/** Where `sides` start along an axis: the left or the top. */
export const spaceBefore = (sides: Sides, axis: 'width' | 'height') =>
    axis === 'width' ? sides.left : sides.top;

/**
 * `sides` with `changes` written over them, or undefined when every side is zero,
 * so a shape without spacing saves none.
 */
export function withSides(sides: Sides | undefined, changes: Partial<Sides>): Sides | undefined {
    const next = { ...sidesOf(sides) };

    for (const side of SIDES) {
        const value = changes[side];

        if (value !== undefined && Number.isFinite(value)) {
            next[side] = Math.max(0, value);
        }
    }

    return hasSpace(next) ? next : undefined;
}

/**
 * Stack rules with their padding changed: equal sides keep the single `padding`
 * a variable can bind, others are kept side by side.
 */
export function withStackPadding(rules: StackRules, changes: Partial<Sides>): StackRules {
    const next = withSides(stackPadding(rules), changes) ?? NO_SIDES;
    const result: StackRules = { ...rules, padding: next.top, paddingSides: next };

    if (SIDES.every((side) => next[side] === next.top)) {
        delete result.paddingSides;
    }

    return result;
}
