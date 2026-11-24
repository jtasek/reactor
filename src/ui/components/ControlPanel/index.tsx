import React, { FC } from 'react';

import { ControlPanel } from './ControlPanel';
import { useActions, useControls, useDebugMode } from 'src/app/hooks';

/** Parts of the editor that are not panels a designer turns on or off. */
const FIXED = ['contextMenu', 'controlPanel', 'statusBar', 'surface'];
const DEBUG = ['documentInfo', 'stats'];

export const ConnectedControlPanel: FC = () => {
    const controls = useControls();
    const actions = useActions();
    const debugMode = useDebugMode();

    if (!controls.controlPanel.visible) {
        return null;
    }

    return (
        <ControlPanel
            // Read here, so this component re-renders when a control is turned on or off:
            // the items, without a hook of their own, would read the store untracked.
            controls={Object.values(controls)
                .filter(({ id }) => !FIXED.includes(id) && (debugMode || !DEBUG.includes(id)))
                .map(({ id, name, visible }) => ({ id, name, visible }))}
            onChange={actions.ui.toggleControlVisibility}
        />
    );
};
