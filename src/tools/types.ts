import { FC } from 'react';

import { Command } from '../app/types';

export interface Tool extends Command {
    /** Draws a committed shape of this tool's type, from the shape's own fields. */
    component?: FC<never>;
    designComponent: FC;
}
export interface Tools {
    activeToolsIds: string[];
}
