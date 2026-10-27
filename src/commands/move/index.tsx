import { Command, Point } from 'src/app/types';
import { Context } from 'src/app';
import { editableScreenView, reportUnavailableView } from 'src/app/screenViewEditing';
import { hasLayoutOffset } from 'src/app/frameLayout';
import { componentSourceNudge } from 'src/app/componentViewTransform';

export const moveSelectionOrPan = (context: Context, direction: Point) => {
    const { state, actions } = context;
    const step = state.config.arrowKeyStep;
    const shapeIds = state.currentDocument.editableSelectedShapesIds;

    const frame = state.currentDocument.frames[state.currentDocument.selectedFrameId ?? ''];

    if (frame) {
        actions.editFrame({
            kind: 'update',
            id: frame.id,
            changes: {
                position: {
                    x: frame.position.x + direction.x * step,
                    y: frame.position.y + direction.y * step
                }
            }
        });

        return;
    }

    if (shapeIds.length === 0) {
        actions.tools.panCamera({ dx: -direction.x * step, dy: -direction.y * step });

        return;
    }

    const address = state.events.pointer.screenView;
    const placed = address ? editableScreenView(state, address) : null;
    const shown = new Set(placed?.projection.shapes.map((shape) => shape.id));

    if (address && !placed) {
        reportUnavailableView(context);

        return;
    }

    if (
        placed &&
        (hasLayoutOffset(state.currentDocument, shapeIds) ||
            shapeIds.some((id) => placed.projection.layoutOffsets.has(id) || !shown.has(id)))
    ) {
        return;
    }

    actions.moveShapesBy({
        shapeIds,
        delta: componentSourceNudge(
            { x: direction.x * step, y: direction.y * step },
            placed?.component
        )
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
