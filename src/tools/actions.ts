import { Context } from '../app';
import { Point } from 'src/app/types';
import { getToolById } from './components';
import {
    DEFAULT_SCALE,
    MAX_SCALE,
    MIN_SCALE,
    ZOOM_STEP,
    panBy,
    placeWorldPoint,
    zoomAt
} from 'src/app/camera';
import { DEFAULT_TOOL_ID } from './state';

type ZoomOptions = { scale: number; point?: Point };

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

const zoomByStep = ({ state, actions }: Context, step: number, direction: number) => {
    if (!Number.isFinite(step) || step <= 0) {
        return;
    }

    const scale = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, state.currentDocument.camera.scale + direction * step)
    );

    // Remove arithmetic noise for discrete steps without quantizing pinch input.
    actions.tools.zoom({ scale: Number(scale.toFixed(10)) });
};

export const zoomIn = (context: Context, step = ZOOM_STEP) => {
    zoomByStep(context, step, 1);
};

export const zoomOut = (context: Context, step = ZOOM_STEP) => {
    zoomByStep(context, step, -1);
};

export const zoomReset = ({ actions }: Context) => {
    actions.tools.zoom({ scale: DEFAULT_SCALE });
};

export const zoom = ({ state: { currentDocument, events } }: Context, options: ZoomOptions) => {
    // Zooming mid-gesture would move the canvas under a pointer that is editing it.
    if (events.pointer.dragging) {
        return;
    }

    const next = zoomAt(currentDocument.camera, options.scale, options.point);

    if (!next) {
        return;
    }

    currentDocument.camera.scale = next.scale;
    currentDocument.camera.position.x = next.position.x;
    currentDocument.camera.position.y = next.position.y;
};

/**
 * Pinch zoom: scales the camera while keeping the `anchor` world point under the
 * surface-local `point`, so the canvas follows the fingers as well as zooming.
 */
export const zoomToAnchor = (
    { state: { currentDocument } }: Context,
    options: { scale: number; anchor: Point; point: Point }
) => {
    const next = placeWorldPoint(
        currentDocument.camera,
        options.scale,
        options.anchor,
        options.point
    );

    if (!next) {
        return;
    }

    currentDocument.camera.scale = next.scale;
    currentDocument.camera.position.x = next.position.x;
    currentDocument.camera.position.y = next.position.y;
};

/**
 * Zooms continuously while keeping the world point under `point` (a surface
 * local screen coordinate) anchored, so the canvas does not drift. The camera is
 * read live from state — never from a stale React closure — so rapid wheel events
 * compose correctly against the latest scale/position.
 */
export const zoomAtPoint = (
    { state: { currentDocument }, actions }: Context,
    options: { point: Point; deltaY: number }
) => {
    if (!Number.isFinite(options.deltaY) || options.deltaY === 0) {
        return;
    }

    const delta = Math.min(1000, Math.max(-1000, options.deltaY));

    actions.tools.zoom({
        scale: currentDocument.camera.scale * Math.exp(-delta * 0.01),
        point: options.point
    });
};

/**
 * Pans the camera by a surface-local delta (grab-and-drag): the content follows
 * the delta, so a positive dx moves the canvas right.
 */
export const panCamera = (
    { state: { currentDocument } }: Context,
    delta: { dx: number; dy: number }
) => {
    const next = panBy(currentDocument.camera, { x: delta.dx, y: delta.dy });

    if (!next) {
        return;
    }

    currentDocument.camera.position.x = next.position.x;
    currentDocument.camera.position.y = next.position.y;
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
