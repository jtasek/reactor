import React, { FC, ReactNode } from 'react';

import { Explorer } from './Explorer';
import { useControls } from 'src/app/hooks';

interface Props {
    children?: ReactNode;
}

export const ConnectedExplorer: FC<Props> = ({ children }) => {
    const { explorer } = useControls();

    if (!explorer.visible) {
        return null;
    }

    return <Explorer>{children}</Explorer>;
};
