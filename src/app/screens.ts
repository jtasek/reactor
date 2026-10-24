import type { Document } from './types';
import { frameParents, isFrameVisible } from './frameState';

/** Visible root screen definitions are prototype destinations, even with no canvas views. */
export function screenFrames(document: Document) {
    const parents = frameParents(document.frames);

    return Object.values(document.frames).filter(
        (frame) =>
            frame.kind === 'screen' && !parents.get(frame.id) && isFrameVisible(document, frame.id)
    );
}
