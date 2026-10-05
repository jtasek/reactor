import React, { FC } from 'react';
import { Guide } from './Guide';
import { useGuideDrag } from './useGuideDrag';
import { useCamera, useControls, useGuides } from 'src/app/hooks';
import { RULER_SIZE_PX } from 'src/app/rulers';
import { Camera } from 'src/app/types';

interface Props {
    /** A fixed camera, as the minimap's, shows the guides without letting them be dragged. */
    camera?: Camera;
}

export const Guides: FC<Props> = ({ camera }) => {
    const guides = useGuides();
    const view = useCamera();
    const { rulers } = useControls();
    const { drag, begin } = useGuideDrag();
    const { position, scale } = camera ?? view;
    const rulerEdge = rulers.visible ? RULER_SIZE_PX : 0;

    return (
        <g id="guides">
            {Object.values(guides)
                .filter((guide) => guide.visible)
                .map((guide) => {
                    const dragged = drag?.guideId === guide.id ? drag : null;
                    const at = dragged
                        ? dragged.at
                        : guide.orientation === 'horizontal'
                          ? guide.position.y * scale + position.y
                          : guide.position.x * scale + position.x;

                    return (
                        <Guide
                            key={guide.id}
                            orientation={guide.orientation}
                            at={at}
                            leaving={dragged !== null && at < rulerEdge}
                            onPointerDown={
                                camera || guide.locked
                                    ? undefined
                                    : (event) => begin(event, guide.orientation, guide.id)
                            }
                        />
                    );
                })}
        </g>
    );
};
