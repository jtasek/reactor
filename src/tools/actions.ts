import { Context } from '../app';
import { Point } from 'src/app/types';
import { getToolById } from './components';
import { zoomAt } from 'src/events/drivers/cameraMath';
import { DEFAULT_TOOL_ID } from './state';

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
    // Tools are mutually exclusive modes: selecting one replaces any other.
    // Enforcing a single active tool prevents duplicate React keys and a single
    // drag executing several tools at once (e.g. drawing a rectangle *and* a
    // circle).
    tools.activeToolsIds = [toolId];
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

    // Fall back to the default select tool so the canvas is never left without
    // an active mode (e.g. after finishing a drawing or clicking empty canvas).
    if (tools.activeToolsIds.length === 0) {
        tools.activeToolsIds = [DEFAULT_TOOL_ID];
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

/**
 * Zooms one step in/out while keeping the world point under `point` (a surface
 * local screen coordinate) anchored, so the canvas does not drift. The camera is
 * read live from state — never from a stale React closure — so rapid wheel events
 * compose correctly against the latest scale/position.
 */
export const zoomAtPoint = (
    { state: { currentDocument } }: Context,
    options: { point: Point; deltaY: number }
) => {
    const { camera } = currentDocument;
    const newScale = options.deltaY > 0 ? scaleDown(camera.scale) : scaleUp(camera.scale);

    if (newScale === camera.scale) {
        return;
    }

    const next = zoomAt(
        { scale: camera.scale, position: { x: camera.position.x, y: camera.position.y } },
        newScale,
        options.point
    );

    camera.scale = next.scale;
    camera.position.x = next.position.x;
    camera.position.y = next.position.y;
};

/**
 * Pans the camera by a screen-space delta (grab-and-drag): the content follows
 * the delta, so a positive dx moves the canvas right.
 */
export const panCamera = (
    { state: { currentDocument } }: Context,
    delta: { dx: number; dy: number }
) => {
    currentDocument.camera.position.x += delta.dx;
    currentDocument.camera.position.y += delta.dy;
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
