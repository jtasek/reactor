import React, { FC, useLayoutEffect, useRef, useState } from 'react';
import type { SyntheticEvent } from 'react';
import { Guide } from '../Guide/Guide';
import { useGuideDrag } from '../Guide/useGuideDrag';
import { useActions, useCamera } from 'src/app/hooks';
import { RULER_SIZE_PX, RulerMark, rulerMarks } from 'src/app/rulers';

import styles from './styles.css';

/** How far an unlabeled mark reaches into its ruler, as a part of the ruler's size. */
const SHORT_MARK = 0.25;

/** How far a label sits past its mark and in from the ruler's outer edge, in screen pixels. */
const LABEL_INSET_PX = 3;

/** Keeps a ruler's input from the canvas under it. */
const keepToRuler = (event: SyntheticEvent) => event.stopPropagation();

/** The path of a ruler's marks, drawn up from its inner edge as if it were the top one. */
const marksPath = (marks: RulerMark[]) =>
    marks
        .map(({ at, label }) => {
            const length = label === null ? RULER_SIZE_PX * SHORT_MARK : RULER_SIZE_PX;

            return `M${Math.round(at) + 0.5} ${RULER_SIZE_PX}v${-length}`;
        })
        .join('');

/** The canvas's size, which the rulers span. */
function useSurfaceSize(element: React.RefObject<SVGGElement | null>) {
    const [size, setSize] = useState({ width: 0, height: 0 });

    useLayoutEffect(() => {
        const surface = element.current?.ownerSVGElement;

        if (!surface) {
            return;
        }

        const observer = new ResizeObserver(([entry]) => {
            setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
        });

        observer.observe(surface);

        return () => observer.disconnect();
    }, [element]);

    return size;
}

/**
 * Rulers along the canvas's top and left edges, in canvas units. Dragging out of
 * the top ruler places a horizontal guide, and out of the left one a vertical guide.
 */
export const Rulers: FC = () => {
    const element = useRef<SVGGElement>(null);
    const { width, height } = useSurfaceSize(element);
    const { position, scale } = useCamera();
    const { drag, begin } = useGuideDrag();
    const { events } = useActions();
    const top = rulerMarks(position.x, scale, width);
    const left = rulerMarks(position.y, scale, height);

    return (
        <g
            ref={element}
            className={styles.rulers}
            onPointerDown={keepToRuler}
            onPointerMove={keepToRuler}
            onPointerEnter={events.leaveSurface}
            onDoubleClick={keepToRuler}
        >
            {drag && drag.guideId === null && (
                <Guide orientation={drag.orientation} at={drag.at} removing={drag.removing} />
            )}
            <g
                className={`${styles.ruler} ${styles.top}`}
                data-ruler="top"
                onPointerDown={(event) => begin(event, 'horizontal', null)}
            >
                <rect width="100%" height={RULER_SIZE_PX} />
                <path d={marksPath(top)} />
                {top.map(
                    ({ at, label }) =>
                        label !== null && (
                            <text key={label} x={at + LABEL_INSET_PX} y={LABEL_INSET_PX}>
                                {label}
                            </text>
                        )
                )}
            </g>
            <g
                className={`${styles.ruler} ${styles.left}`}
                data-ruler="left"
                onPointerDown={(event) => begin(event, 'vertical', null)}
            >
                <rect width={RULER_SIZE_PX} height="100%" />
                <path d={marksPath(left)} transform="matrix(0 1 1 0 0 0)" />
                {left.map(
                    ({ at, label }) =>
                        label !== null && (
                            <text
                                key={label}
                                transform={`translate(${LABEL_INSET_PX} ${at - LABEL_INSET_PX}) rotate(-90)`}
                            >
                                {label}
                            </text>
                        )
                )}
            </g>
            <rect className={styles.corner} width={RULER_SIZE_PX} height={RULER_SIZE_PX} />
        </g>
    );
};
