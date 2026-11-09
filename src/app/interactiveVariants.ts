import { layoutTreeRoot } from './screenLayouts';
import type { Document, ChangeVariantAction, InstanceShape, Shape } from './types';
import { screenOwners } from './screenViews';
import { instanceAction, effectiveActivation } from './screenInteractions';

/** First increment: ordinary screen instances; repeated and nested source instances are excluded. */
export function prototypeTargets(document: Document, screenId?: string, fromFrameId?: string) {
    const owners = screenOwners(document.frames);
    const sourceMembers = new Set(
        Object.values(document.components).flatMap((component) => component.shapesIds)
    );
    // Many controls share a parent. Keep ancestry results only for this lookup,
    // so later edits and collaboration updates always resolve fresh frame data.
    const roots = new Map<string, string | undefined>();
    const rootFor = (frameId: string) => {
        if (!roots.has(frameId)) {
            roots.set(frameId, layoutTreeRoot(document, frameId));
        }

        return roots.get(frameId);
    };
    const fromRoot = fromFrameId ? rootFor(fromFrameId) : undefined;

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
            (!fromFrameId || rootFor(shape.parentFrameId) === fromRoot) &&
            document.components[shape.componentId]
        );
    });
}

export function variantTargets(document: Document, screenId?: string, fromFrameId?: string) {
    return prototypeTargets(document, screenId, fromFrameId).filter(
        (shape) => document.components[shape.componentId].variantIds?.length
    );
}

export function prototypeTargetCheck(document: Document) {
    const targets = new Map(prototypeTargets(document).map((shape) => [shape.id, shape]));
    const owners = screenOwners(document.frames);

    return (instanceId: string, screenId: string) => {
        const target = targets.get(instanceId);

        return Boolean(target && owners.get(target.parentFrameId!) === screenId);
    };
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
 * Points copied instance actions at the copies of their targets. A target left out of the
 * copy keeps its original ID, so the copied control still changes the original instance.
 */
export function remapVariantTargets(shapes: Shape[], ids: ReadonlyMap<string, string>) {
    for (const shape of shapes) {
        const action = instanceAction(shape);
        if (action) {
            action.instanceId = ids.get(action.instanceId) ?? action.instanceId;
        }
    }
}

/** The named state an instance's action toggles, directly or through a bound visibility target. */
export function toggledState(
    document: Document,
    instance: InstanceShape,
    activate = effectiveActivation(document.components[instance.componentId], instance)
): string | undefined {
    if (activate?.type === 'toggleState') {
        return activate.stateId;
    }
    const target =
        activate?.type === 'toggleVisibility' ? document.shapes[activate.instanceId] : undefined;

    return target?.type === 'instance' ? target.prototypeVisibilityStateId : undefined;
}

/**
 * Binding `instance` to `stateId` would hide a control that toggles the same state: itself, or one
 * that toggles `instance` and is already bound to `stateId`. Only Reset could show it again.
 */
export function bindingHidesControl(document: Document, instance: InstanceShape, stateId: string) {
    if (document.components[instance.componentId] && toggledState(document, instance) === stateId) {
        return true;
    }

    return Object.values(document.shapes).some((shape) => {
        if (
            shape.type !== 'instance' ||
            shape.prototypeVisibilityStateId !== stateId ||
            !document.components[shape.componentId]
        ) {
            return false;
        }
        const activate = effectiveActivation(document.components[shape.componentId], shape);

        return activate?.type === 'toggleVisibility' && activate.instanceId === instance.id;
    });
}
