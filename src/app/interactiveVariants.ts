import { layoutTreeRoot } from './screenLayouts';
import type { Document, ChangeVariantAction, InstanceShape, Shape } from './types';
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

/**
 * `validVariantAction` for many controls of one projection: finds the document's targets once
 * instead of walking every shape and component for each control.
 */
export function variantActionCheck(document: Document) {
    let targets: Map<string, InstanceShape> | undefined;
    let owners: ReturnType<typeof screenOwners> | undefined;

    return (action: ChangeVariantAction, screenId: string) => {
        targets ??= new Map(variantTargets(document).map((shape) => [shape.id, shape]));
        owners ??= screenOwners(document.frames);
        const target = targets.get(action.instanceId);

        return Boolean(
            target &&
            owners.get(target.parentFrameId!) === screenId &&
            validFamilyMember(document, target, action.variantId)
        );
    };
}

function validFamilyMember(document: Document, target: InstanceShape, variantId: string) {
    const family = document.components[target.componentId];

    return Boolean(
        document.components[variantId] &&
        (variantId === family.id || family.variantIds?.includes(variantId))
    );
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
    return validFamilyMember(document, target, action.variantId);
}

/**
 * Points copied variant actions at the copies of their targets. A target left out of the
 * copy keeps its original ID, so the copied control still changes the original instance.
 */
export function remapVariantTargets(shapes: Shape[], ids: ReadonlyMap<string, string>) {
    for (const shape of shapes) {
        const action = shape.type === 'instance' ? shape.interactions?.activate : undefined;
        const copy = action?.type === 'changeVariant' ? ids.get(action.instanceId) : undefined;
        if (action?.type === 'changeVariant' && copy) {
            action.instanceId = copy;
        }
    }
}
