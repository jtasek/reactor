import { FC } from 'react';

import { Command } from '../app/types';

export interface Tool extends Command {
    component?: FC<any>;
    designComponent: FC;
}
export interface Tools {
    activeToolsIds: string[];
}
