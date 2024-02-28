import { FC } from 'react';
import { Tool } from '../types';

import { CircleTool } from './Circle';
import { EllipseTool } from './Ellipse';
import { ImageTool } from './Image';
import { LineTool } from './Line';
import { PenTool } from './Pen';
import { RectTool } from './Rect';
import { SelectTool } from './Select';
import { TextTool } from './Text';

const tools = [
    CircleTool,
    EllipseTool,
    ImageTool,
    LineTool,
    PenTool,
    RectTool,
    SelectTool,
    TextTool
];

export function getToolById(toolId: string): Tool | undefined {
    return tools.find((item) => item.id === toolId);
}

export function getComponentByType(type: string) {
    const result = getToolById(type);

    if (!result?.component) {
        throw new Error(`${type} type doesn't have component defined`);
    }

    return result.component;
}

export function useRegisteredTools(): Tool[] {
    return Object.values(tools).map((item) => item);
}
