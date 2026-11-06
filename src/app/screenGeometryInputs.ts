import { screenLayoutMembers, selectScreenLayout } from './screenLayouts';
import type { ScreenViewport } from './screenProjection';
import type { Document, Shape } from './types';

/**
 * Geometry dependencies of one root screen's active layout. Sources can live on
 * other screens, and nested/automatic variants can use any family member. Include
 * all of those authored shapes, even hidden or currently unselected alternatives.
 * Shared definitions, variables, modes and frame topology are keyed by the caller.
 */
export function screenGeometryInputs(
    document: Document,
    screenId: string,
    viewport: ScreenViewport
) {
    const screen = document.frames[screenId];

    // A nested screen can depend on its parent's stack, siblings and hug sizing.
    // Keep the full layout input until that dependency graph is indexed as well.
    if (screen?.parentFrameId) {
        return [viewport, document.frames, document.shapes, document.shapesIds];
    }

    const members = screenLayoutMembers(
        document,
        screenId,
        selectScreenLayout(document, screenId, viewport)
    );
    const shapeIds = new Set<string>();
    const componentIds = new Set<string>();
    const pending: Shape[] = [];
    const components: string[] = [];
    const groups = new Map<string, string[][]>();
    const visitedGroups = new Set<string[]>();
    Object.values(document.groups).forEach((group) => {
        group.shapesIds.forEach((id) => {
            const memberships = groups.get(id) ?? [];
            memberships.push(group.shapesIds);
            groups.set(id, memberships);
        });
    });
    const includeShape = (id: string) => {
        if (shapeIds.has(id)) {
            return;
        }
        shapeIds.add(id);
        if (document.shapes[id]) {
            pending.push(document.shapes[id]);
        }
    };
    Object.values(document.shapes).forEach((shape) => {
        if (members.has(shape.parentFrameId ?? '')) {
            includeShape(shape.id);
        }
    });

    // Both queues are bounded by document records; visited IDs break component/group cycles.
    while (pending.length || components.length) {
        const shape = pending.pop();
        if (shape) {
            (groups.get(shape.id) ?? []).forEach((members) => {
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

    return [
        viewport,
        document.frames[viewport.id ?? ''],
        document.frames[screenId],
        [...members].map((id) => document.frames[id]),
        [...shapeIds].map((id) => document.shapes[id]),
        document.shapesIds.filter((id) => shapeIds.has(id))
    ];
}
