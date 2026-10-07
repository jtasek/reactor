import React, { FC } from 'react';
import { usePointerPosition } from 'src/app/hooks';
import { Cursor } from './Cursor';

export const ConnectedCursor: FC = () => {
    const position = usePointerPosition();

    return <Cursor position={position} />;
};
