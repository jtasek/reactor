import type { Document } from './types';
import { frameParents, isFrameVisible } from './frameState';

/** Only visible screens on Canvas are prototype destinations. Identity survives nesting. */
export function screenFrames(document: Document) {
    const parents = frameParents(document.frames);

    return Object.values(document.frames).filter(
        (frame) =>
            frame.kind === 'screen' && !parents.get(frame.id) && isFrameVisible(document, frame.id)
    );
}
