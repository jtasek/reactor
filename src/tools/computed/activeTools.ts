import { derived } from 'overmind';
import { getToolByType } from '../components';
import type { Tool, Tools } from '../types';

export const activeTools: Tool[] = derived(({ activeToolsIds }: Tools) => {
  return activeToolsIds.map((toolId) => getToolByType[toolId]);
});
