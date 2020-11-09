import { derived } from 'overmind';
import { Tools } from '../types';

export const activeTools = derived(({ activeToolsIds }: Tools) => {
  const tools = [];
  return activeToolsIds.map((toolId) => tools[toolId]);
});
