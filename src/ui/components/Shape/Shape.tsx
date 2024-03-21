import React, { FC } from 'react';
import { useShape } from 'src/app/hooks';
import { getComponentByType } from 'src/tools/components';
import { Selectable } from '../Selectable/Selectable';
import { Resizable } from '../Selectable/Resizable';

interface Props {
    shapeId: string;
}

export const Shape: FC<Props> = ({ shapeId }) => {
    const shape = useShape(shapeId);
    const Component = getComponentByType(shape.type);

    if (!Component) {
        console.error(`Component ${shape.type} not found`);
        return null;
    }

    return (
        <>
            <Component {...shape} />
            <Selectable key={`selectable-${shape.type}-${shape.id}`} shape={shape} />
            <Resizable key={`resizable-${shape.type}-${shape.id}`} shape={shape} />
        </>
    );
};
