import { projectScreen, projectScreenViews, type ScreenProjection } from './screenProjection';
import {
    screenGeometryIndex,
    screenGeometryLayout,
    screenLayoutInputs
} from './screenGeometryInputs';
import { hasNumericLayout } from './contextualLayout';
import { snapshot, artwork, geometryKey, signature } from './geometrySnapshot';
import { untracked } from './untracked';
import type { Document, VariableContext } from './types';

const EMPTY_BINDINGS = {};
const ORIGIN = { x: 0, y: 0 };
/**
 * Fields a move or resize writes on each shape type (see `translateShape` and
 * `resizeShapeFromHandle`). A free shape's views skip them; keep this in step with
 * new geometry fields, which the per-type cache test checks.
 */
const FREE_SHAPE_GEOMETRY = [
    'position',
    'size',
    'radius',
    'cornerRadius',
    'bounds',
    'start',
    'end',
    'points',
    'fontSize',
    'textLayout'
];
const projections = new WeakMap<
    Document,
    {
        key: string;
        views: ReturnType<typeof projectScreenViews>;
        screens: Map<string, { key: string; projection: ScreenProjection | null }>;
    }
>();

function records<T extends object>(items: Record<string, T>): Record<string, T> {
    return Object.fromEntries(Object.entries(items).map(([id, item]) => [id, artwork(item)]));
}

/**
 * Called by an Overmind derived value: authored changes invalidate the snapshot,
 * and cache hits replay its dependencies to every reader. Never memoize a mutable
 * document's identity.
 *
 * The projection sees only the snapshot below, never the raw document, so it cannot
 * read a field the cache does not track. Derived fields such as `frameLayout` and
 * `frameStates` are absent and computed from the snapshot. If projection code needs
 * another document field, add it to `inputs`; without it the field reads undefined
 * and tests fail instead of views silently drawing stale artwork.
 */
export function resolveScreenViewGeometry(document: Document, simulation?: VariableContext) {
    const frames = Object.fromEntries(
        Object.entries(document.frames).map(([id, frame]) => [
            id,
            frame.kind === 'view'
                ? {
                      ...artwork(frame, ['position', 'bindings']),
                      bindings: snapshot(frame.bindings ?? EMPTY_BINDINGS),
                      position: ORIGIN
                  }
                : artwork(frame)
        ])
    );

    if (!Object.values(frames).some((frame) => frame.kind === 'view' && frame.visible)) {
        projections.delete(untracked(document));

        return [];
    }

    // Free canvas geometry cannot affect a screen unless a component or group
    // uses it. Keep context inputs (such as text wrapping) but do not subscribe
    // to its drag geometry, so resizing or rounding it leaves views cached.
    const dependencies = new Set([
        ...Object.values(document.components).flatMap((component) => component.shapesIds),
        ...Object.values(document.groups).flatMap((group) => group.shapesIds)
    ]);
    const inputs = {
        frames,
        shapes: Object.fromEntries(
            Object.entries(document.shapes).map(([id, shape]) => [
                id,
                artwork(
                    shape,
                    shape.parentFrameId !== undefined || dependencies.has(id)
                        ? []
                        : FREE_SHAPE_GEOMETRY
                )
            ])
        ),
        shapesIds: [...document.shapesIds],
        groups: records(document.groups),
        layers: records(document.layers),
        components: Object.fromEntries(
            Object.entries(document.components).map(([id, component]) => [
                id,
                {
                    ...artwork(component, ['sourceShapes']),
                    ...(component.sourceShapes
                        ? { sourceShapes: records(component.sourceShapes) }
                        : {})
                }
            ])
        ),
        variables: snapshot(document.variables),
        dimensions: snapshot(document.dimensions),
        shownLayerId: document.shownLayerId
    };

    // Adding/removing a local document field invalidates Overmind's parent path.
    // Compare authored inputs only on those derived misses, never on every render.
    const modes = snapshot(simulation);
    const key = signature(geometryKey([inputs, modes]));
    const owner = untracked(document);
    const cached = projections.get(owner);

    if (cached?.key === key) {
        return cached.views;
    }

    const source = { id: owner.id, ...inputs } as unknown as Document;
    const shared = signature(
        geometryKey([
            inputs.groups,
            inputs.layers,
            inputs.variables,
            inputs.dimensions,
            inputs.shownLayerId,
            modes,
            hasNumericLayout(source),
            Object.values(frames).map((frame) => [
                frame.id,
                frame.kind,
                frame.parentFrameId,
                frame.screenLayout
            ])
        ])
    );
    const screens = new Map<string, { key: string; projection: ScreenProjection | null }>();
    const layouts = new Map<string, string>();
    let index: ReturnType<typeof screenGeometryIndex> | undefined;
    const views = projectScreenViews(
        source,
        modes,
        ORIGIN,
        (document, screenId, viewport, simulation) => {
            const id = viewport.id!;
            // Views of the same layout share its inputs; only the viewport is per view.
            const layoutId = screenGeometryLayout(document, screenId, viewport);
            const layoutKey = JSON.stringify([screenId, layoutId ?? null]);
            let layoutInputs = layouts.get(layoutKey);
            if (layoutInputs === undefined) {
                index ??= screenGeometryIndex(document);
                layoutInputs = signature(
                    geometryKey(screenLayoutInputs(document, screenId, layoutId, index))
                );
                layouts.set(layoutKey, layoutInputs);
            }
            const viewKey = `${shared}:${layoutInputs}:${signature(
                geometryKey([viewport, document.frames[viewport.id ?? '']])
            )}`;
            const previous = cached?.screens.get(id);
            const result =
                previous?.key === viewKey
                    ? previous
                    : {
                          key: viewKey,
                          projection: projectScreen(document, screenId, viewport, simulation)
                      };
            screens.set(id, result);

            return result.projection;
        }
    );
    projections.set(owner, { key, views, screens });

    return views;
}
