import { Command } from 'src/app/types';
import { createShape } from 'src/app/factories';
import { Context } from '../../app';

const POSITION_SHIFT_STEP = 10;

export const cloneSelection = ({ state }: Context) => {
    state.currentDocument?.selectedShapes
        .map((shape) =>
            createShape({
                ...shape,
                id: undefined,
                name: `Clone of ${shape.name}`,
                position: {
                    x: shape.position.x + POSITION_SHIFT_STEP,
                    y: shape.position.y + POSITION_SHIFT_STEP
                },
                selected: false
            })
        )
        .forEach((shape) => (state.currentDocument.shapes[shape.id] = shape));
};

export const CloneCommand: Command = {
    id: 'clone',
    name: 'Clone',
    category: 'tools',
    description: 'Clone current selection',
    icon: {
        group: 'content',
        name: 'content_copy',
        size: 24
    },
    regex: /(?<toolCode>clone)\('(?<shapeName>\w+)'\)/,
    shortcut: 'ctrl+v',
    canExecute: ({ state }: Context) => state.currentDocument?.selectedShapesIds.length > 0,
    execute: cloneSelection
};
