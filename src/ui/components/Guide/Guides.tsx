import React, { FC } from 'react';
import type { MouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { Guide } from './Guide';
import { useGuideDrag } from './useGuideDrag';
import {
    useActions,
    useAppState,
    useActiveToolsIds,
    useCamera,
    useGuides,
    useHoveredGroupsIds
} from 'src/app/hooks';
import { Camera, Guide as GuideType } from 'src/app/types';
import { beyondClickSlip } from 'src/events/gestures';

import styles from './styles.css';

/** Where a guide is on screen: pixels from the canvas's top edge when horizontal, its left edge when vertical. */
const screenOffset = (guide: GuideType, { position, scale }: Camera) =>
    guide.orientation === 'horizontal'
        ? guide.position.y * scale + position.y
        : guide.position.x * scale + position.x;

const keepToGuide = (event: MouseEvent) => event.stopPropagation();

interface Props {
    /** A fixed camera, as the minimap's, instead of the canvas's. */
    camera?: Camera;
}

/** The shown guides' lines, drawn over the shapes; a dragged guide is drawn where it would go. */
export const Guides: FC<Props> = ({ camera }) => {
    const guides = useGuides();
    const view = useCamera();
    const { drag } = useGuideDrag();

    return (
        <g id="guides">
            {Object.values(guides)
                .filter((guide) => guide.visible)
                .map((guide) => {
                    const dragged = !camera && drag?.guideId === guide.id ? drag : null;

                    return (
                        <Guide
                            key={guide.id}
                            orientation={guide.orientation}
                            at={dragged ? dragged.at : screenOffset(guide, camera ?? view)}
                            removing={dragged?.removing}
                            selected={!camera && guide.selected}
                            position={dragged?.offset}
                            marks={dragged?.marks}
                        />
                    );
                })}
        </g>
    );
};

/**
 * Selects a locked guide when its press ends as a click. The press still reaches the
 * canvas, so a drag that starts on a locked guide draws a marquee as before; the
 * selection waits until the canvas has handled the release, which clears guides.
 */
const selectOnClick = (event: ReactPointerEvent<SVGElement>, select: () => void) => {
    const { pointerId } = event;
    const start = { x: event.clientX, y: event.clientY };
    const onEnd = (end: PointerEvent) => {
        if (end.pointerId !== pointerId) {
            return;
        }
        window.removeEventListener('pointerup', onEnd, true);
        window.removeEventListener('pointercancel', onEnd, true);
        if (
            end.type === 'pointerup' &&
            !beyondClickSlip(start, { x: end.clientX, y: end.clientY }, 1)
        ) {
            setTimeout(select);
        }
    };
    window.addEventListener('pointerup', onEnd, true);
    window.addEventListener('pointercancel', onEnd, true);
};

/**
 * What selects shown guides and grabs unlocked guides, under the shapes so a shape on a guide
 * takes the press, as does a group whose box the pointer highlights.
 */
export const GuideGrips: FC = () => {
    const { selectGuide } = useActions();
    const guides = useGuides();
    const camera = useCamera();
    const hoveredGroups = useHoveredGroupsIds();
    const activeTools = useActiveToolsIds();
    const { begin } = useGuideDrag();
    const inputBlocked = useAppState(
        (state) =>
            state.guideDragActive ||
            state.events.pointer.gesture.kind !== 'idle' ||
            state.ui.contextMenu.visible
    );

    return (
        <g className={styles.grips}>
            {Object.values(guides)
                .filter((guide) => guide.visible)
                .map((guide) => {
                    const at = screenOffset(guide, camera);
                    const horizontal = guide.orientation === 'horizontal';

                    return (
                        <line
                            key={guide.id}
                            className={horizontal ? styles.rowGrip : styles.columnGrip}
                            style={{ cursor: guide.locked ? 'default' : undefined }}
                            x1={horizontal ? 0 : at}
                            y1={horizontal ? at : 0}
                            x2={horizontal ? '100%' : at}
                            y2={horizontal ? at : '100%'}
                            onPointerDown={(event) => {
                                if (
                                    inputBlocked ||
                                    hoveredGroups.length > 0 ||
                                    activeTools[0] !== 'select'
                                ) {
                                    return;
                                }
                                if (guide.locked) {
                                    if (event.button === 0) {
                                        selectOnClick(event, () => selectGuide(guide.id));
                                    }

                                    return;
                                }
                                begin(event, guide.orientation, guide.id);
                            }}
                            onDoubleClick={keepToGuide}
                        />
                    );
                })}
        </g>
    );
};
