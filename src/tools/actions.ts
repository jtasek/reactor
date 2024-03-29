import type { Pointer } from 'src/events/types';
import { Context } from '../app';
import { getToolById } from './components';

const DEFAULT_SCALE = 1;
const MAX_SCALE = 10;
const MIN_SCALE = 0.1;
const ZOOM_STEP = 0.1;

const limitScale = (scale: number) =>
    parseFloat(Math.min(Math.max(scale, MIN_SCALE), MAX_SCALE).toFixed(1));

export const activateTool = ({ state: { tools }, actions }: Context, toolId: string) => {
    tools.activeToolsIds.push(toolId);
    actions.ui.hideContextMenu();
};

export const deactivateTool = ({ state: { tools } }: Context, toolId: string) => {
    const index = tools.activeToolsIds.indexOf(toolId);
    if (index > -1) {
        tools.activeToolsIds.splice(index, 1);
    }
};

export const resetTools = ({ state: { events, tools } }: Context) => {
    if (!events.keyboard.shiftKey) {
        tools.activeToolsIds = [];
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

export const zoom = ({ state: { currentDocument } }: Context, scale = DEFAULT_SCALE) => {
    currentDocument.camera.scale = limitScale(scale);
};

export const moveCamera = (
    { state: { currentDocument } }: Context,
    delta: { deltaX: number; deltaY: number; deltaZ: number }
) => {
    currentDocument.camera.position.x -= delta.deltaX;
    currentDocument.camera.position.y -= delta.deltaY;
};

function rescalePointer(pointer: Pointer) {
    return {
        ...pointer,
        center: pointer.scaledCenter,
        position: pointer.scaledCurrent,
        offset: pointer.scaledOffset,
        path: pointer.scaledPath,
        radius: pointer.scaledRadius,
        size: pointer.scaledSize,
        startPosition: pointer.scaledStart,
        topLeftPosition: pointer.scaledTopLeft,
        bottomRightPosition: pointer.scaledBottomRight
    };
}

export const executeToolCommands = (context: Context) => {
    const { state, actions } = context;
    const { activeToolsIds } = state.tools;

    for (const toolId of activeToolsIds) {
        const tool = getToolById(toolId);
        console.log(`Execute tool command: ${toolId}`);

        if (tool?.canExecute(context)) {
            tool.execute(context);
        }
    }
};
