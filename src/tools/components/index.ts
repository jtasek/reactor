import { Tool } from '../types';
import { getTools } from '../../app/actions';

export function getToolById(toolId: string): Tool | undefined {
    const tools = getTools();

    return Object.values(tools).find((item) => item.id === toolId);
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
