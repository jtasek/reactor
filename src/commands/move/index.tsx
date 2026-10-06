import { Command, Point } from 'src/app/types';
import { Context } from 'src/app';
import { editableSelectedShapesIds } from 'src/app/membership';

export const moveSelectionOrPan = ({ state, actions }: Context, direction: Point) => {
    const step = state.config.arrowKeyStep;
    const document = state.currentDocument;

    if (document.selectedShapesIds.length === 0) {
        actions.tools.panCamera({ dx: -direction.x * step, dy: -direction.y * step });

        return;
    }

    actions.moveShapesBy({
        shapeIds: editableSelectedShapesIds(document),
        delta: { x: direction.x * step, y: direction.y * step }
    });
};

const moveCommand = (side: string, shortcut: string, direction: Point): Command => ({
    id: `move-${side}`,
    name: `Move ${side}`,
    category: 'surface',
    description: `Move the selection ${side}, or pan the canvas without one`,
    shortcut,
    places: [],
    canExecute: () => true,
    execute: (context) => moveSelectionOrPan(context, direction)
});

export const MoveLeftCommand = moveCommand('left', 'arrowleft', { x: -1, y: 0 });
export const MoveRightCommand = moveCommand('right', 'arrowright', { x: 1, y: 0 });
export const MoveUpCommand = moveCommand('up', 'arrowup', { x: 0, y: -1 });
export const MoveDownCommand = moveCommand('down', 'arrowdown', { x: 0, y: 1 });
