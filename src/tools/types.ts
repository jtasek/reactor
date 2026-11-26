import { FC } from 'react';

import { Action, Command, Shape } from '../app/types';
import type { ImageToPlace } from '../app/services/assets';

export interface Tool extends Command {
    /** Runs when the tool is chosen, before it draws. */
    activate?: Action;
    /** Draws a committed shape of this tool's type, from the shape's own fields. */
    component?: FC<never>;
    /** The shape type `component` draws, when it is not the tool's id. */
    draws?: Shape['type'];
    designComponent: FC;
}
export interface Tools {
    activeToolsIds: string[];
    componentToPlace?: string;
    /** The image the image tool draws, once one is chosen. */
    imageToPlace?: ImageToPlace;
}
