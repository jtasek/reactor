import { FC, createElement } from 'react';
import { getToolById } from '../index';

export const Tool: FC<{ toolId: string }> = ({ toolId }) => {
    const tool = getToolById(toolId);

    if (!tool?.designComponent) {
        console.error(`Tool ${toolId} design component not found`);
        return null;
    }

    return createElement(tool.designComponent);
};
