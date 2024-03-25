import React, { FC } from 'react';
import { Label } from '../Label';
import { Resizable } from '../Selectable/Resizable';
import { Selectable } from '../Selectable/Selectable';
import { getComponentByType } from 'src/tools/components';
import { useShape } from 'src/app/hooks';

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
            <Label key={`label-${shape.type}-${shape.id}`} shape={shape} />
        </>
    );
};
