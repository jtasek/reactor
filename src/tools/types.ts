import { Pointer } from 'src/events/types';
import { Action, Shape } from '../app/types';

export interface Tool {
  id: string;
  active: boolean;
  code: string;
  description?: string;
  factory: (pointer: Pointer) => Shape;
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
  activeTools: Tool[];
  activeToolsIds: string[];
}
