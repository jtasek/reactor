import { screenLayoutMembers, selectScreenLayout } from './screenLayouts';
import type { ScreenViewport } from './screenProjection';
import type { Document, Shape } from './types';

/** Reverse lookups built once per resolve and shared by every view. */
export interface ScreenGeometryIndex {
    /** Group member lists containing each shape. */
    groups: Map<string, string[][]>;
    /** Components whose source lists each shape; their visibility affects drawing. */
    components: Map<string, string[]>;
    /** Shapes by parent frame. */
    children: Map<string, string[]>;
    /** Drawing order of each listed shape. */
    order: Map<string, number>;
}

export function screenGeometryIndex(
    document: Pick<Document, 'groups' | 'components' | 'shapes' | 'shapesIds'>
): ScreenGeometryIndex {
    const groups = new Map<string, string[][]>();
    const components = new Map<string, string[]>();
    const children = new Map<string, string[]>();
    const append = <T>(map: Map<string, T[]>, key: string, value: T) => {
        const items = map.get(key);
        if (items) {
            items.push(value);
        } else {
            map.set(key, [value]);
        }
    };
    Object.values(document.groups).forEach((group) => {
        group.shapesIds.forEach((id) => append(groups, id, group.shapesIds));
    });
    Object.values(document.components).forEach((component) => {
        component.shapesIds.forEach((id) => append(components, id, component.id));
    });
    Object.values(document.shapes).forEach((shape) => {
        if (shape.parentFrameId !== undefined) {
            append(children, shape.parentFrameId, shape.id);
        }
    });

    return {
        groups,
        components,
        children,
        order: new Map(document.shapesIds.map((id, index) => [id, index]))
    };
}

/** The active layout a view draws, or undefined for the screen itself. */
export function screenGeometryLayout(
    document: Pick<Document, 'frames'>,
    screenId: string,
    viewport: ScreenViewport
) {
    return document.frames[screenId]?.parentFrameId
        ? undefined
        : selectScreenLayout(document, screenId, viewport);
}

/**
 * Inputs one root screen's layout reads, independent of the view drawing it, so views
 * of the same layout share them. Sources can live on other screens, and nested or
 * automatic variants can use any family member. Include all of those authored shapes
 * and component records, even hidden or currently unselected alternatives. Shared
 * groups, layers, variables, modes and frame topology are keyed by the caller.
 */
export function screenLayoutInputs(
    document: Pick<Document, 'frames' | 'shapes' | 'shapesIds' | 'components'>,
    screenId: string,
    layoutId: string | undefined,
    index: ScreenGeometryIndex
) {
    const screen = document.frames[screenId];

    // A nested screen can depend on its parent's stack, siblings and hug sizing.
    // Keep the full layout input until that dependency graph is indexed as well.
    if (screen?.parentFrameId) {
        return [document.frames, document.shapes, document.shapesIds, document.components];
    }

    const members = screenLayoutMembers(document, screenId, layoutId);
    const shapeIds = new Set<string>();
    const componentIds = new Set<string>();
    const pending: Shape[] = [];
    const components: string[] = [];
    const visitedGroups = new Set<string[]>();
    const includeShape = (id: string) => {
        if (shapeIds.has(id)) {
            return;
        }
        shapeIds.add(id);
        if (document.shapes[id]) {
            pending.push(document.shapes[id]);
        }
        // A hidden or source-only component hides the shapes it lists.
        components.push(...(index.components.get(id) ?? []));
    };
    members.forEach((id) => index.children.get(id)?.forEach(includeShape));

    // Both queues are bounded by document records; visited IDs break component/group cycles.
    while (pending.length || components.length) {
        const shape = pending.pop();
        if (shape) {
            (index.groups.get(shape.id) ?? []).forEach((members) => {
                if (visitedGroups.has(members)) {
                    return;
                }
                visitedGroups.add(members);
                members.forEach(includeShape);
            });
            if (shape.type === 'instance') {
                components.push(shape.componentId);
            }
            continue;
        }

        const id = components.pop()!;
        if (componentIds.has(id)) {
            continue;
        }
        componentIds.add(id);
        const component = document.components[id];
        if (!component) {
            continue;
        }
        components.push(...(component.variantIds ?? []));
        component.shapesIds.forEach((id) => {
            const source = component.sourceShapes?.[id];
            if (source) {
                pending.push(source);

                return;
            }
            includeShape(id);
        });
    }

    const sorted = [...shapeIds].sort();

    return [
        document.frames[screenId],
        [...members].sort().map((id) => document.frames[id]),
        // Missing components are keyed too, so adding one invalidates its instances.
        [...componentIds].sort().map((id) => [id, document.components[id] ?? null]),
        sorted.map((id) => document.shapes[id]),
        sorted
            .filter((id) => index.order.has(id))
            .sort((a, b) => index.order.get(a)! - index.order.get(b)!)
    ];
}

/** Geometry dependencies of one view: its viewport and frame, plus its layout's inputs. */
export function screenGeometryInputs(
    document: Pick<Document, 'frames' | 'shapes' | 'shapesIds' | 'components' | 'groups'>,
    screenId: string,
    viewport: ScreenViewport,
    index = screenGeometryIndex(document)
) {
    return [
        viewport,
        document.frames[viewport.id ?? ''],
        screenLayoutInputs(
            document,
            screenId,
            screenGeometryLayout(document, screenId, viewport),
            index
        )
    ];
}
