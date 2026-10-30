import type { Document, Frame, Size } from './types';
import { frameParents } from './frameState';

export const MISSING_SCREEN_LAYOUT =
    'The chosen layout is unavailable. Showing the default layout.';

/** Invalid links retain their artwork as ordinary frames, rather than hiding it. */
export function isScreenLayout(
    frames: Record<string, Frame>,
    id: string,
    parents = frameParents(frames)
) {
    const frame = frames[id];
    const parent = parents.get(id);

    return (
        frame?.screenLayout === true &&
        frame.kind === 'frame' &&
        parent !== undefined &&
        frames[parent]?.kind === 'screen' &&
        !parents.get(parent)
    );
}

export function screenLayouts(document: Pick<Document, 'frames'>, screenId: string) {
    const parents = frameParents(document.frames);

    return Object.values(document.frames).filter(
        (frame) =>
            frame.parentFrameId === screenId && isScreenLayout(document.frames, frame.id, parents)
    );
}

export function screenLayoutRoot(
    document: Pick<Document, 'frames'>,
    screenId: string,
    layoutId?: string
) {
    const layout = document.frames[layoutId ?? ''];

    if (layout?.parentFrameId === screenId && isScreenLayout(document.frames, layout.id)) {
        return layout;
    }

    return document.frames[screenId];
}

export function viewLayoutRoot(
    document: Pick<Document, 'frames'>,
    view: Pick<Frame, 'screenId' | 'layoutId'> | undefined
) {
    return screenLayoutRoot(document, view?.screenId ?? '', view?.layoutId);
}

/** Active members only; another layout is never a nested frame in this tree. */
export function screenLayoutMembers(
    document: Pick<Document, 'frames'>,
    screenId: string,
    layoutId?: string
) {
    const root = screenLayoutRoot(document, screenId, layoutId);
    const parents = frameParents(document.frames);
    const layouts = new Set(screenLayouts(document, screenId).map((frame) => frame.id));
    const members = new Set<string>();

    for (const id of Object.keys(document.frames)) {
        for (let current: string | undefined = id; current; current = parents.get(current)) {
            if (current === root?.id) {
                members.add(id);
                break;
            }

            if (layouts.has(current)) {
                break;
            }
        }
    }

    return members;
}

/** Fit only the inspected tree. Authored geometry, modes and layout choices stay intact. */
export function screenLayoutDocument(
    document: Document,
    screenId: string,
    layoutId?: string,
    size?: Size
) {
    const screen = document.frames[screenId];
    const root = screenLayoutRoot(document, screenId, layoutId);

    if (!screen || !root) {
        return document;
    }

    const resize = (frame: Frame): Frame =>
        size
            ? {
                  ...frame,
                  size,
                  sizing: undefined,
                  bindings: Object.fromEntries(
                      Object.entries(frame.bindings ?? {}).filter(
                          ([key]) => key !== 'width' && key !== 'height'
                      )
                  )
              }
            : frame;

    return {
        ...document,
        frames: {
            ...document.frames,
            [screenId]: resize(screen),
            ...(root.id === screenId ? {} : { [root.id]: resize(root) })
        }
    };
}
