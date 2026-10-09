import { Tool } from '../types';
export { InstanceTool } from './Instance';
import { getTool, getTools } from 'src/app/actions';

export function getToolById(toolId: string): Tool | undefined {
    return getTool(toolId);
}

export function getComponentByType(type: string) {
    const result = getToolById(type);

    if (!result?.component) {
        throw new Error(`${type} type doesn't have component defined`);
    }

    return result.component;
}

export function useRegisteredTools(): Tool[] {
    return getTools();
}
