import React, { FC } from 'react';
import type { MouseEvent } from 'react';
import { Guide } from './Guide';
import { useGuideDrag } from './useGuideDrag';
import { useCamera, useGuides, useHoveredGroupsIds } from 'src/app/hooks';
import { Camera, Guide as GuideType } from 'src/app/types';

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
                    const dragged = drag?.guideId === guide.id ? drag : null;

                    return (
                        <Guide
                            key={guide.id}
                            orientation={guide.orientation}
                            at={dragged ? dragged.at : screenOffset(guide, camera ?? view)}
                            removing={dragged?.removing}
                        />
                    );
                })}
        </g>
    );
};

/**
 * What grabs the shown, unlocked guides, under the shapes so a shape on a guide
 * takes the press, as does a group whose box the pointer highlights.
 */
export const GuideGrips: FC = () => {
    const guides = useGuides();
    const camera = useCamera();
    const hoveredGroups = useHoveredGroupsIds();
    const { begin } = useGuideDrag();

    return (
        <g className={styles.grips}>
            {Object.values(guides)
                .filter((guide) => guide.visible && !guide.locked)
                .map((guide) => {
                    const at = screenOffset(guide, camera);
                    const horizontal = guide.orientation === 'horizontal';

                    return (
                        <line
                            key={guide.id}
                            className={horizontal ? styles.rowGrip : styles.columnGrip}
                            x1={horizontal ? 0 : at}
                            y1={horizontal ? at : 0}
                            x2={horizontal ? '100%' : at}
                            y2={horizontal ? at : '100%'}
                            onPointerDown={(event) => {
                                if (hoveredGroups.length === 0) {
                                    begin(event, guide.orientation, guide.id);
                                }
                            }}
                            onDoubleClick={keepToGuide}
                        />
                    );
                })}
        </g>
    );
};
