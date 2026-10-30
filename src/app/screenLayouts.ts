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

export type LayoutChoice = {
    layoutId?: string;
    layoutMode?: 'auto';
    size: Size;
};

/** Explicit choices always win. Equal thresholds resolve deterministically after a merge. */
export function selectScreenLayout(
    document: Pick<Document, 'frames'>,
    screenId: string,
    choice: LayoutChoice
) {
    if (choice.layoutId || choice.layoutMode !== 'auto') {
        return choice.layoutId;
    }
    const rules = document.frames[screenId]?.responsiveLayouts ?? [];
    const rule = [...rules]
        .sort(
            (a, b) =>
                b.minWidth - a.minWidth ||
                (a.layoutId < b.layoutId ? -1 : Number(a.layoutId > b.layoutId))
        )
        .find((rule) => rule.minWidth <= choice.size.width);

    return rule?.layoutId;
}

export function screenLayoutProblems(document: Pick<Document, 'frames'>, screenId: string) {
    const rules = document.frames[screenId]?.responsiveLayouts ?? [];
    const ordered = [...rules].sort(
        (a, b) =>
            a.minWidth - b.minWidth ||
            (a.layoutId < b.layoutId ? -1 : Number(a.layoutId > b.layoutId))
    );

    return ordered.flatMap((rule, index) => {
        if (index > 0 && ordered[index - 1].minWidth === rule.minWidth) {
            return [
                `A layout rule at ${rule.minWidth}px is unreachable because another rule has the same minimum width.`
            ];
        }
        if (screenLayoutRoot(document, screenId, rule.layoutId)?.id !== rule.layoutId) {
            return [
                `The layout rule at ${rule.minWidth}px references a missing layout. It uses the default.`
            ];
        }

        return [];
    });
}

export function viewLayoutId(
    document: Pick<Document, 'frames'>,
    view: (LayoutChoice & Pick<Frame, 'screenId'>) | undefined
) {
    return view ? selectScreenLayout(document, view.screenId ?? '', view) : undefined;
}

export function viewLayoutRoot(
    document: Pick<Document, 'frames'>,
    view: (LayoutChoice & Pick<Frame, 'screenId'>) | undefined
) {
    return screenLayoutRoot(document, view?.screenId ?? '', viewLayoutId(document, view));
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
    size?: Partial<Size>
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
                  size: { ...frame.size, ...size },
                  sizing:
                      frame.sizing &&
                      Object.fromEntries(
                          Object.entries(frame.sizing).filter(
                              ([axis]) => !Object.hasOwn(size, axis)
                          )
                      ),
                  bindings: Object.fromEntries(
                      Object.entries(frame.bindings ?? {}).filter(
                          ([key]) => !Object.hasOwn(size, key)
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
