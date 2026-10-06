import React, { FC } from 'react';

import { ControlPanel } from './ControlPanel';
import { useActions, useControls } from 'src/app/hooks';

export const ConnectedControlPanel: FC = () => {
    const controls = useControls();
    const actions = useActions();

    if (!controls.controlPanel.visible) {
        return null;
    }

    return (
        <ControlPanel
            // Read here, so this component re-renders when a control is turned on or off:
            // the items, without a hook of their own, would read the store untracked.
            controls={Object.values(controls).map(({ id, name, visible }) => ({
                id,
                name,
                visible
            }))}
            onChange={actions.ui.toggleControlVisibility}
        />
    );
};
