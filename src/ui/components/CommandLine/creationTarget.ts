import type { Context } from 'src/app';
import type { Point } from 'src/app/types';
import { editableScreenView } from 'src/app/screenViewEditing';
import { isFrameLocked, isFrameVisible } from 'src/app/frameState';
import { projectContextualLayout } from 'src/app/contextualLayout';
import { renderedFrame } from 'src/app/frameLayout';

/** Resolve the current selection at execution time, including a view's active layout. */
export function creationTarget(state: Context['state'], canvasCenter: Point) {
    const document = state.currentDocument;
    const id = document.selectedFrameId;

    if (!id) {
        return { center: canvasCenter, origin: { x: 0, y: 0 }, parentFrameId: undefined };
    }

    const frame = document.frames[id];

    if (!frame || !isFrameVisible(document, id) || isFrameLocked(document, id)) {
        throw new Error(
            'The selected frame is unavailable, hidden or locked. Select an editable frame or clear the selection.'
        );
    }

    if (frame.kind === 'view') {
        const placed = editableScreenView(state, { documentId: document.id, viewId: id });

        if (!placed || placed.projection.exceedsNodeLimit) {
            throw new Error(
                'The selected Screen view cannot be edited. Check its screen and layout.'
            );
        }

        return {
            center: {
                x: placed.projection.screen.size.width / 2,
                y: placed.projection.screen.size.height / 2
            },
            origin: placed.screen.position,
            parentFrameId: placed.screen.id
        };
    }

    const layout = projectContextualLayout(document, {
        simulation: state.previewModes[document.id]
    });
    const rendered = renderedFrame(document, id, layout);

    return {
        center: { x: rendered.size.width / 2, y: rendered.size.height / 2 },
        origin: frame.position,
        parentFrameId: id
    };
}
