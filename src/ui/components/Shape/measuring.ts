import { useAppState } from 'src/app/hooks';
import { instanceComponentId } from 'src/app/componentSource';
import type { Document } from 'src/app/types';
import { KEEPS_SHAPE_BOUNDS } from 'src/events/gestures';

/** Whether a frame, or a frame it is in, is the selected frame. */
const inSelectedFrame = (document: Document, frameId: string | undefined) => {
    const selected = document.selectedFrameId;
    const seen = new Set<string>();

    for (let id = frameId; selected !== undefined && id !== undefined; ) {
        if (id === selected) {
            return true;
        }

        if (seen.has(id)) {
            return false;
        }

        seen.add(id);
        id = document.frames[id]?.parentFrameId;
    }

    return false;
};

/**
 * Whether a shape of the component's source is selected, or of the source of an
 * instance in it, however deep: moving it changes the component's instances.
 */
const sourceSelected = (
    document: Document,
    componentId: string,
    seen = new Set<string>()
): boolean =>
    !seen.has(componentId) &&
    Boolean(seen.add(componentId)) &&
    (document.components[componentId]?.shapesIds ?? []).some((memberId) => {
        const member = document.shapes[memberId];

        return (
            member?.selected ||
            (member?.type === 'instance' &&
                sourceSelected(document, instanceComponentId(document, member), seen))
        );
    });

/**
 * Whether a shape is measured where drawn: not while a gesture keeps its bounds
 * itself. Gestures change selected shapes only, so a shape not selected never
 * reads the gesture, and does not render again as gestures begin and end.
 */
export const useMeasuringShape = (id: string, visible: boolean) =>
    useAppState((state) => {
        const shape = state.currentDocument.shapes[id];

        // A frame drag moves its descendants, and only a selected frame is dragged, so
        // only the selected frame's descendants read the gesture besides selected shapes.
        if (inSelectedFrame(state.currentDocument, shape?.parentFrameId)) {
            const gesture = state.events.pointer.gesture;

            if (gesture.kind === 'editingFrame' && gesture.shapes[id]) {
                return false;
            }
        }

        // Editing a component's source changes its instances though they are not
        // selected, so then they wait for the gesture to end too. Other instances,
        // and hidden ones, which are not measured, do not read the gesture, so they
        // do not render again as drags begin and end.
        if (shape?.type === 'instance' && !shape.selected) {
            const document = state.currentDocument;

            if (!visible) {
                return true;
            }

            const sourceEdited =
                state.enteredComponentId !== null ||
                sourceSelected(document, instanceComponentId(document, shape));

            return !sourceEdited || !KEEPS_SHAPE_BOUNDS[state.events.pointer.gesture.kind];
        }

        return !shape?.selected || !KEEPS_SHAPE_BOUNDS[state.events.pointer.gesture.kind];
    });
