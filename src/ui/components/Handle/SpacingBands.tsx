import React, { type FC } from 'react';
import { SIDES, type Side, type SpacingBox, hasSpace, sidesOf } from 'src/app/boxModel';
import { useCameraScale } from 'src/app/hooks';
import type { Sides } from 'src/app/types';
import styles from './styles.css';

/** Sizes on screen, in pixels, whatever the zoom. */
const GRIP_LENGTH = 18;
const GRIP_THICKNESS = 6;
/** A band thinner than this on screen shows no grip or value: the resize handles sit there. */
const LEAST_GRIPPED = 8;
const LEAST_LABELLED = 14;

type Rect = { x: number; y: number; width: number; height: number };
type Owner = { shapeId: string } | { frameId: string };

/**
 * The strip `sides[side]` wide along `side`: outside the box for margin, inside for
 * padding, where the left and right strips run between the top and bottom ones, so no
 * corner is tinted twice.
 */
function band(box: Rect, side: Side, sides: Sides, outside: boolean): Rect {
    const { x, y, width, height } = box;
    const amount = sides[side];
    const top = outside ? 0 : sides.top;
    const across = { y: y + top, height: Math.max(0, height - top - (outside ? 0 : sides.bottom)) };

    switch (side) {
        case 'top':
            return { x, y: outside ? y - amount : y, width, height: amount };
        case 'bottom':
            return { x, y: outside ? y + height : y + height - amount, width, height: amount };
        case 'left':
            return { x: outside ? x - amount : x, width: amount, ...across };
        case 'right':
            return { x: outside ? x + width : x + width - amount, width: amount, ...across };
    }
}

/** Where a side's grip sits: the edge of its band away from the box's own edge. */
function gripCenter(strip: Rect, side: Side, outside: boolean) {
    const far = outside === (side === 'top' || side === 'left');
    const vertical = side === 'left' || side === 'right';

    return vertical
        ? { x: far ? strip.x : strip.x + strip.width, y: strip.y + strip.height / 2 }
        : { x: strip.x + strip.width / 2, y: far ? strip.y : strip.y + strip.height };
}

const Bands: FC<{
    box: Rect;
    kind: SpacingBox;
    sides: Sides;
    owner: Owner;
    editable: boolean;
    scale: number;
}> = ({ box, kind, sides, owner, editable, scale }) => {
    const outside = kind === 'margin';
    // Margin bands run past the corners only along the box, so their tints never overlap.
    const strips = SIDES.filter((side) => sides[side] > 0).map((side) => ({
        side,
        strip: band(box, side, sides, outside)
    }));
    const ownerData =
        'shapeId' in owner
            ? { 'data-shape-id': owner.shapeId }
            : { 'data-frame-id': owner.frameId };

    return (
        <g
            className={styles[kind === 'margin' ? 'marginBands' : 'paddingBands']}
            data-spacing-bands={kind}
        >
            {strips.map(({ side, strip }) => (
                <rect key={side} className={styles.spacingBand} {...strip} />
            ))}
            {strips.map(({ side, strip }) => {
                const shown = sides[side] * scale;
                const vertical = side === 'left' || side === 'right';
                const grip = gripCenter(strip, side, outside);
                const length = GRIP_LENGTH / scale;
                const thickness = GRIP_THICKNESS / scale;

                return (
                    <React.Fragment key={side}>
                        {shown >= LEAST_LABELLED && (
                            <text
                                className={styles.spacingValue}
                                transform={`translate(${strip.x + strip.width / 2} ${strip.y + strip.height / 2}) scale(${1 / scale})`}
                            >
                                {Math.round(sides[side] * 100) / 100}
                            </text>
                        )}
                        {editable && shown >= LEAST_GRIPPED && (
                            <rect
                                className={`${styles.spacingGrip} ${vertical ? styles.gripAcross : styles.gripDown}`}
                                x={grip.x - (vertical ? thickness : length) / 2}
                                y={grip.y - (vertical ? length : thickness) / 2}
                                width={vertical ? thickness : length}
                                height={vertical ? length : thickness}
                                rx={thickness / 2}
                                aria-label={`${kind === 'margin' ? 'Margin' : 'Padding'} ${side}`}
                                data-handle
                                data-type="spacing"
                                data-box={kind}
                                data-side={side}
                                {...ownerData}
                                onPointerDown={(event) => event.preventDefault()}
                            />
                        )}
                    </React.Fragment>
                );
            })}
        </g>
    );
};

/**
 * A selected shape's or frame's margin, striped outside its box, and a stack
 * frame's padding, tinted inside it, with the width of each side. Dragging a
 * band's grip changes that side.
 */
export const SpacingBands: FC<{
    box: Rect;
    owner: Owner;
    margin?: Sides;
    padding?: Sides;
    editable: boolean;
}> = ({ box, owner, margin, padding, editable }) => {
    const scale = useCameraScale();

    if (!hasSpace(margin) && !hasSpace(padding)) {
        return null;
    }

    return (
        <g className={styles.spacingBands} pointerEvents="none">
            {hasSpace(padding) && (
                <Bands
                    box={box}
                    kind="padding"
                    sides={sidesOf(padding)}
                    owner={owner}
                    editable={editable}
                    scale={scale}
                />
            )}
            {hasSpace(margin) && (
                <Bands
                    box={box}
                    kind="margin"
                    sides={sidesOf(margin)}
                    owner={owner}
                    editable={editable}
                    scale={scale}
                />
            )}
        </g>
    );
};
