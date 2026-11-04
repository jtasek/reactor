import { layoutTreeRoot } from './screenLayouts';
import type { Document, ChangeVariantAction, InstanceShape } from './types';
import { screenOwners } from './screenViews';

/** First increment: ordinary screen instances; repeated and nested source instances are excluded. */
export function variantTargets(document: Document, screenId?: string, fromFrameId?: string) {
    const owners = screenOwners(document.frames);
    const sourceMembers = new Set(
        Object.values(document.components).flatMap((component) => component.shapesIds)
    );

    return Object.values(document.shapes).filter((shape): shape is InstanceShape => {
        if (
            shape.type !== 'instance' ||
            shape.dataList ||
            !shape.parentFrameId ||
            sourceMembers.has(shape.id)
        ) {
            return false;
        }
        const owner = owners.get(shape.parentFrameId);

        return Boolean(
            owner &&
            (!screenId || owner === screenId) &&
            (!fromFrameId ||
                layoutTreeRoot(document, shape.parentFrameId) ===
                    layoutTreeRoot(document, fromFrameId)) &&
            document.components[shape.componentId]?.variantIds?.length
        );
    });
}

export function validVariantAction(
    document: Document,
    action: ChangeVariantAction,
    screenId?: string,
    fromFrameId?: string
) {
    const target = variantTargets(document, screenId, fromFrameId).find(
        (shape) => shape.id === action.instanceId
    );
    if (!target) {
        return false;
    }
    const family = document.components[target.componentId];

    return Boolean(
        document.components[action.variantId] &&
        (action.variantId === family.id || family.variantIds?.includes(action.variantId))
    );
}
