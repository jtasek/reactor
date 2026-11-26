import { FC } from 'react';

import { Action, Command, PathPoint, Shape } from '../app/types';
import type { ImageToPlace } from '../app/services/assets';
import type { Smoothing } from '../app/smoothingSetting';

export interface Tool extends Command {
    /** Runs when the tool is chosen, before it draws. */
    activate?: Action;
    /** Runs when another tool replaces it, to keep or drop what it was drawing. */
    deactivate?: Action;
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
    /** How much the Pencil smooths a stroke when it is drawn. */
    pencilSmoothing: Smoothing;
    /** The path the Pen is drawing: the points placed so far, in the document they belong to. */
    penDraft: { documentId: string; points: PathPoint[] } | null;
}
