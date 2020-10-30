import { Action } from '../app/types';

export interface Tool {
  id: string;
  active: boolean;
  code: string;
  description?: string;
  handler: Action<string>;
  icon: Icon;
}

export interface Icon {
  color: string;
  group: string;
  name: string;
  size: number;
}

export interface Tools {
  activeToolsIds: string[];
  activeTools: Tool[];
}
