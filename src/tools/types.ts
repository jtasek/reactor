import { FC } from 'react';
import { Keyboard, Pointer } from 'src/events/types';
import { Action, Icon } from '../app/types';

export interface Tool {
  id: string;
  name: string;
  component?: FC<any>;
  description?: string;
  factory?: (pointer: Pointer, keyboard: Keyboard) => any;
  handler?: Action;
  icon?: Icon;
  regex: RegExp;
  shortcut: string;
  tool: FC<any>;
}
export interface Tools {
  activeToolsIds: string[];
}
