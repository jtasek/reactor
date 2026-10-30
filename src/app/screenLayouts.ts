import type { Document, Frame, RoleSettings, Size } from './types';
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

/** A screen's width rules with their IDs, narrowest first; equal widths in ID order. */
export function screenLayoutRules(document: Pick<Document, 'frames'>, screenId: string) {
    return Object.entries(document.frames[screenId]?.responsiveLayouts ?? {})
        .map(([id, rule]) => ({ id, ...rule }))
        .sort((a, b) => a.minWidth - b.minWidth || (a.id < b.id ? -1 : Number(a.id > b.id)));
}

/** Explicit choices always win. Equal thresholds resolve deterministically after a merge. */
export function selectScreenLayout(
    document: Pick<Document, 'frames'>,
    screenId: string,
    choice: LayoutChoice
) {
    if (choice.layoutId || choice.layoutMode !== 'auto') {
        return choice.layoutId;
    }
    // The first of equal widths wins, as the Inspector lists them.
    const rules = screenLayoutRules(document, screenId);
    const width = Math.max(
        -1,
        ...rules.filter((rule) => rule.minWidth <= choice.size.width).map((rule) => rule.minWidth)
    );
    const rule = rules.find((rule) => rule.minWidth === width);

    return rule?.layoutId;
}

export function screenLayoutProblems(document: Pick<Document, 'frames'>, screenId: string) {
    const ordered = screenLayoutRules(document, screenId);

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

/** The Screen or alternate layout whose artwork tree holds a frame, if any. */
export function layoutTreeRoot(document: Pick<Document, 'frames'>, frameId: string | undefined) {
    const seen = new Set<string>();
    let frame = document.frames[frameId ?? ''];

    while (frame && !frame.screenLayout && frame.kind !== 'screen' && !seen.has(frame.id)) {
        seen.add(frame.id);
        frame = document.frames[frame.parentFrameId ?? ''];
    }

    return frame && (frame.screenLayout || frame.kind === 'screen') ? frame.id : undefined;
}

/**
 * Returns a check that drops a new input's identity when another input in the same
 * layout tree already has it, as a clone or a paste beside its original would.
 * Pasting into another layout keeps the identity, which pairs the two inputs in Preview.
 */
export function inputIdentityGuard(document: Pick<Document, 'frames' | 'shapes'>) {
    type Input = { type: string; parentFrameId?: string; interaction?: RoleSettings };
    const key = (shape: Input) =>
        shape.type === 'instance' && shape.interaction?.controlId
            ? JSON.stringify([
                  layoutTreeRoot(document, shape.parentFrameId) ?? null,
                  shape.interaction.controlId
              ])
            : undefined;
    const taken = new Set(Object.values(document.shapes).map(key));

    return (shape: Input) => {
        const identity = key(shape);

        if (identity === undefined || !shape.interaction) {
            return;
        }
        if (taken.has(identity)) {
            shape.interaction = { ...shape.interaction };
            delete shape.interaction.controlId;
        } else {
            taken.add(identity);
        }
    };
}
