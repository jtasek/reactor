import React, { FC } from 'react';
import { Guide } from '../Guide';
import { useCamera, useControls, useGuides } from 'src/app/hooks';
import { Camera, Guide as GuideShape } from 'src/app/types';

interface Props {
    camera?: Camera;
}

export const Guides: FC<Props> = ({ camera }) => {
    const { guides: control } = useControls();
    const guides = useGuides();
    const defaultCamera = useCamera();

    if (!control.visible) {
        return null;
    }

    const { position, scale } = camera ?? defaultCamera;

    return (
        <g id="guides">
            {(Object.values(guides) as GuideShape[]).map((guide) => (
                <Guide key={guide.id} guide={guide} position={position} scale={scale} />
            ))}
        </g>
    );
};
