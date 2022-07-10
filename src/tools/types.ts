import { FC } from 'react';

import { Command } from '../app/types';

export interface Tool {
  id: string;
  name: string;
  component?: FC<any>;
  description?: string;
  command: Command;
}
export interface Tools {
  activeToolsIds: string[];
}
