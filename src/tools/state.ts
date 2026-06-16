import { Tools } from './types';

// The select (hand) tool is the canvas default: it is active on load and
// whenever no other tool is in use, so the canvas always has a usable mode.
export const DEFAULT_TOOL_ID = 'select';

export const state: Tools = {
    activeToolsIds: [DEFAULT_TOOL_ID]
};
