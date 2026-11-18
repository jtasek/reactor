import { Sparkles } from 'lucide-react';
import React, { FC } from 'react';
import { aiOffered } from 'src/app/aiAccess';
import { renderedFrame } from 'src/app/frameLayout';
import { useActions, useAppState } from 'src/app/hooks';
import { menuGoesBelow } from 'src/app/selectionMenu';
import type { SelectionOverlay } from 'src/app/selectionOverlays';
import { takesEditorInput } from 'src/events/input';
import styles from './styles.css';

const BUTTON_SIZE = 28;
/** Off a corner of the selection on its right, clear of the corner handle. */
const OFFSET = 10;
const WINDOW_MARGIN = 4;

/**
 * A button by the selected object that opens the AI bar over the canvas, shown while AI is
 * offered, nothing is being dragged and the chat is closed.
 */
export const AiSelectionButton: FC<{ overlay: SelectionOverlay | null }> = ({ overlay }) => {
    const { requestAiEdit } = useActions();
    const place = useAppState((state) => {
        const document = state.currentDocument;

        if (
            !aiOffered(state) ||
            !takesEditorInput(state) ||
            document.locked ||
            state.aiEditDocumentId === state.currentDocumentId ||
            state.events.pointer.dragging
        ) {
            return null;
        }
        let box = overlay
            ? { topLeft: overlay.extent.topLeft, bottomRight: overlay.extent.bottomRight }
            : null;
        let camera = overlay?.document.camera ?? document.camera;

        if (!box && document.selectedFrameId && document.frames[document.selectedFrameId]) {
            const { position, size } = renderedFrame(document, document.selectedFrameId);

            box = {
                topLeft: position,
                bottomRight: { x: position.x + size.width, y: position.y + size.height }
            };
            camera = document.camera;
        }
        if (!box) {
            return null;
        }
        const { scale, position } = camera;
        const right = box.bottomRight.x * scale + position.x;
        const top = box.topLeft.y * scale + position.y;
        const bottom = box.bottomRight.y * scale + position.y;

        // The corner away from the selection menu: below it while the menu is above the box.
        return {
            left: right + OFFSET,
            top: menuGoesBelow(top) ? top - OFFSET - BUTTON_SIZE : bottom + OFFSET
        };
    });

    if (!place) {
        return null;
    }

    return (
        <button
            type="button"
            className={styles.selectionButton}
            aria-label="Ask AI about the selection"
            title="Ask AI about the selection"
            style={{
                left: Math.max(
                    WINDOW_MARGIN,
                    Math.min(place.left, window.innerWidth - BUTTON_SIZE - WINDOW_MARGIN)
                ),
                top: Math.max(WINDOW_MARGIN, place.top)
            }}
            onClick={() => requestAiEdit('bar')}
        >
            <Sparkles aria-hidden="true" size={15} strokeWidth={1.75} />
        </button>
    );
};
