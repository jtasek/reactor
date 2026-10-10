import { FC } from 'react';

import { Action, Command } from '../app/types';
import type { ImageToPlace } from '../app/services/assets';

export interface Tool extends Command {
    /** Runs when the tool is chosen, before it draws. */
    activate?: Action;
    /** Draws a committed shape of this tool's type, from the shape's own fields. */
    component?: FC<never>;
    designComponent: FC;
}
export interface Tools {
    activeToolsIds: string[];
    componentToPlace?: string;
    /** The image the image tool draws, once one is chosen. */
    imageToPlace?: ImageToPlace;
}
