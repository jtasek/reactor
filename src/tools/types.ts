import { FC } from 'react';

import { Command } from '../app/types';

export interface Tool {
  command: Command;
  component: FC<any>;
  description?: string;
  id: string;
  name: string;
}
export interface Tools {
  activeToolsIds: string[];
}
