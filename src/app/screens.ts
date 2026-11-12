import type { Document, Frame } from './types';
import { frameParents, frameVisibility } from './frameState';

/** Visible root screen definitions are prototype destinations, even with no canvas views. */
export function screenFrames(document: Document) {
    const parents = frameParents(document.frames);
    const visible = frameVisibility(document);

    return Object.values(document.frames).filter(
        (frame) => frame.kind === 'screen' && !parents.get(frame.id) && visible(frame.id)
    );
}

/** Where a prototype starts: the Screen marked as the start, or the first one. When copies
 * marked different Screens at once, the lowest ID wins everywhere. */
export function startScreen(document: Document): Frame | undefined {
    const screens = screenFrames(document);

    return (
        screens.filter((screen) => screen.start).sort((a, b) => (a.id < b.id ? -1 : 1))[0] ??
        screens[0]
    );
}

/** SVG export takes a Screen view, or a root Screen as authored. Alternate layouts and Screens
 * nested in other frames are drawn as part of something else, so they are not artboards. */
export function exportableFrame(
    document: Pick<Document, 'frames'>,
    frameId: string | undefined
): Frame | undefined {
    const frame = document.frames[frameId ?? ''];

    return frame?.kind === 'view' ||
        (frame?.kind === 'screen' &&
            !frame.screenLayout &&
            !document.frames[frame.parentFrameId ?? ''])
        ? frame
        : undefined;
}
