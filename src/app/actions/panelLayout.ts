import type { ActionWithParam, PanelPlacement } from '../types';
import { PANEL_LAYOUT_KEY } from '../panelLayout';

export const setPanelPlacement: ActionWithParam<{ id: string; placement: PanelPlacement }> = (
    { state, effects },
    { id, placement }
) => {
    state.config.panelLayout[id] = placement;
    try {
        effects.saveState(PANEL_LAYOUT_KEY, state.config.panelLayout);
    } catch {
        // Keep the layout for this session if local storage is unavailable.
    }
};
