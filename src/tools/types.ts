import { FC } from 'react';
import { Keyboard, Pointer } from 'src/events/types';
import { Action, Shape } from '../app/types';

export interface Tool {
  code: string;
  component: FC<any>;
  description?: string;
  factory?: (pointer: Pointer, keyboard: Keyboard) => any;
  handler?: Action<string>;
  icon?: Icon;
  regex: RegExp;
  shortcut: string;
  tool: FC<any>;
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
