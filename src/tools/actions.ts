import { Context } from '../app';
import { getToolById } from './components';

const DEFAULT_SCALE = 1;
const MAX_SCALE = 10;
const MIN_SCALE = 0.1;
const ZOOM_STEP = 0.1;

type Delta = { deltaX: number; deltaY: number; deltaZ: number };
type ZoomOptions = { scale: number; delta?: Delta };

export const limitScale = (scale: number) =>
    parseFloat(Math.min(Math.max(scale, MIN_SCALE), MAX_SCALE).toFixed(1));

export const scaleUp = (scale: number) => limitScale(scale + ZOOM_STEP);
export const scaleDown = (scale: number) => limitScale(scale - ZOOM_STEP);

export const activateTool = ({ state: { tools }, actions }: Context, toolId: string) => {
    // Tools are mutually exclusive modes: selecting one replaces any other, and
    // clicking the active tool again toggles it off. Enforcing a single active
    // tool prevents duplicate React keys and a single drag executing several
    // tools at once (e.g. drawing a rectangle *and* a circle).
    const isActive = tools.activeToolsIds.includes(toolId);

    tools.activeToolsIds = isActive ? [] : [toolId];
    actions.ui.hideContextMenu();
};

const deactivateTool = ({ state: { tools } }: Context, toolId: string) => {
    const index = tools.activeToolsIds.indexOf(toolId);
    if (index > -1) {
        tools.activeToolsIds.splice(index, 1);
    }
};

export const resetTools = (context: Context) => {
    const {
        state: { tools }
    } = context;

    // Iterate a snapshot — deactivateTool mutates activeToolsIds in place.
    for (const toolId of [...tools.activeToolsIds]) {
        const tool = getToolById(toolId);

        if (!tool?.shouldDeactivate || tool.shouldDeactivate(context)) {
            deactivateTool(context, toolId);
        }
    }
};

export const zoomIn = ({ state: { currentDocument } }: Context, step = ZOOM_STEP) => {
    if (currentDocument.camera.scale >= MAX_SCALE) return;
    const scale = currentDocument.camera.scale + step;

    currentDocument.camera.scale = parseFloat(scale.toFixed(1));
};

export const zoomOut = ({ state: { currentDocument } }: Context, step = ZOOM_STEP) => {
    if (currentDocument.camera.scale <= MIN_SCALE) return;

    const scale = currentDocument.camera.scale - step;

    currentDocument.camera.scale = parseFloat(scale.toFixed(1));
};

export const zoomReset = ({ state: { currentDocument } }: Context) => {
    currentDocument.camera.scale = DEFAULT_SCALE;
};

export const zoom = ({ state: { currentDocument } }: Context, options: ZoomOptions) => {
    currentDocument.camera.scale = limitScale(options.scale);
    if (options.delta) {
        currentDocument.camera.position.x = options.delta.deltaX;
        currentDocument.camera.position.y = options.delta.deltaY;
    }
};

export const moveCamera = (
    { state: { currentDocument } }: Context,
    delta: { deltaX: number; deltaY: number; deltaZ: number }
) => {
    currentDocument.camera.position.x -= delta.deltaX;
    currentDocument.camera.position.y -= delta.deltaY;
};

export const executeToolCommands = (context: Context) => {
    const { activeToolsIds } = context.state.tools;

    for (const toolId of activeToolsIds) {
        const tool = getToolById(toolId);

        if (tool?.canExecute(context)) {
            tool.execute(context);
        }
    }
};
