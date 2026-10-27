import { projectFrameLayout, renderedFrame, renderedShape } from './frameLayout';
import { frameParents, isFrameVisible } from './frameState';
import { translateShape } from './geometry';
import { shownShapesIds } from './membership';
import type { Document, Frame, Point, Shape, Size } from './types';
import { json } from 'overmind';

export interface ScreenViewport {
    position: Point;
    size: Size;
}

export interface ScreenProjection {
    screen: Frame;
    frames: Frame[];
    shapes: Shape[];
    problems: string[];
    /** Shapes managed or offset by this viewport's layout, including hidden members. */
    layoutOffsets: Set<string>;
    /** Local focus composes this rotation with container frames, never durable data. */
    componentRotation?: number;
    exceedsNodeLimit?: boolean;
}

export const MAX_PROJECTED_NODES = 5000;

/** Project a screen at another canvas position and viewport without changing its source. */
export function projectScreen(
    document: Document,
    screenId: string,
    viewport: ScreenViewport
): ScreenProjection | null {
    const source = document.frames[screenId];

    if (source?.kind !== 'screen') {
        return null;
    }

    const parents = frameParents(document.frames);
    const belongsToScreen = (frameId: string | undefined): boolean => {
        const seen = new Set<string>();

        while (frameId !== undefined && !seen.has(frameId)) {
            if (frameId === screenId) {
                return true;
            }

            seen.add(frameId);
            frameId = parents.get(frameId);
        }

        return false;
    };
    const frameIds = Object.keys(document.frames).filter(
        (id) => id !== screenId && belongsToScreen(id) && isFrameVisible(document, id)
    );
    const shown = shownShapesIds(document, null);
    const memberIds = document.shapesIds.filter((id) =>
        belongsToScreen(document.shapes[id]?.parentFrameId)
    );
    const shapeIds = memberIds.filter((id) => shown.has(id));

    if (1 + frameIds.length + shapeIds.length > MAX_PROJECTED_NODES) {
        return {
            exceedsNodeLimit: true,
            screen: source,
            frames: [],
            shapes: [],
            problems: [`Screen view exceeds ${MAX_PROJECTED_NODES} projected nodes.`],
            layoutOffsets: new Set()
        };
    }

    const resized = {
        ...document,
        frames: {
            ...document.frames,
            [screenId]: { ...source, size: viewport.size, sizing: undefined }
        }
    };
    const layout = projectFrameLayout(resized);
    const involved = new Set([screenId, ...frameIds, ...shapeIds]);
    const offset = {
        x: viewport.position.x - source.position.x,
        y: viewport.position.y - source.position.y
    };

    return {
        screen: {
            ...renderedFrame(resized, screenId, layout),
            position: viewport.position,
            size: viewport.size
        },
        frames: frameIds.map((id) => {
            const frame = renderedFrame(resized, id, layout);

            return {
                ...frame,
                position: { x: frame.position.x + offset.x, y: frame.position.y + offset.y }
            };
        }),
        shapes: shapeIds.map((id) => {
            const shape = json(renderedShape(resized, id, layout));
            translateShape(shape, offset);

            return shape;
        }),
        problems: Object.entries(layout.problems)
            .filter(([id]) => involved.has(id))
            .map(([, problem]) => problem),
        layoutOffsets: new Set(
            memberIds.filter(
                (id) =>
                    layout.managedShapes.has(id) ||
                    Boolean(layout.shapes[id]?.x || layout.shapes[id]?.y)
            )
        )
    };
}

/** Bound all placed views together, so adding references cannot multiply render cost without limit. */
export function projectScreenViews(document: Document) {
    let nodes = 0;

    return Object.values(document.frames)
        .filter((frame) => frame.kind === 'view' && frame.visible)
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((view) => {
            if (nodes >= MAX_PROJECTED_NODES) {
                return {
                    view,
                    projection: null,
                    problem: `Screen views exceed ${MAX_PROJECTED_NODES} projected nodes.`
                };
            }

            const projection = view.screenId ? projectScreen(document, view.screenId, view) : null;
            const count = projection ? 1 + projection.frames.length + projection.shapes.length : 0;
            const blocked =
                !projection || projection.exceedsNodeLimit || nodes + count > MAX_PROJECTED_NODES;
            const problem =
                (!projection ? 'Source screen is unavailable.' : undefined) ??
                (projection?.exceedsNodeLimit ? projection.problems[0] : undefined) ??
                (nodes + count > MAX_PROJECTED_NODES
                    ? `Screen views exceed ${MAX_PROJECTED_NODES} projected nodes.`
                    : undefined) ??
                projection?.problems[0];

            if (!blocked) {
                nodes += count;
            }

            return { view, projection: blocked ? null : projection, problem };
        });
}
