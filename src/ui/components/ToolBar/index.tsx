import React, { FC } from 'react';

import { useControls } from 'src/app/hooks';
import { ToolBar } from './ToolBar';

export const ToolBarContainer: FC = () => {
    const { toolBar } = useControls();

    if (!toolBar.visible) {
        return null;
    }

    return <ToolBar />;
};
