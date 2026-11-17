import { layoutTreeRoot } from './screenLayouts';
import type { Document, ChangeVariantAction, InstanceShape, Shape } from './types';
import { screenOwners } from './screenViews';
import { instanceAction, effectiveActivation } from './screenInteractions';
import { booleanVisibility, visibilityStates } from './prototypeState';
import type { Condition } from '../shared/conditions';

/**
 * Returns the check behind `prototypeTargets`, for testing single instances without
 * walking every shape. Ancestry results are kept only for this check's lifetime.
 */
function prototypeTargetFilter(document: Document, screenId?: string, fromFrameId?: string) {
    const owners = screenOwners(document.frames);
    const sourceMembers = new Set(
        Object.values(document.components).flatMap((component) => component.shapesIds)
    );
    // Many controls share a parent, so each frame's layout root is resolved once.
    const roots = new Map<string, string | undefined>();
    const rootFor = (frameId: string) => {
        if (!roots.has(frameId)) {
            roots.set(frameId, layoutTreeRoot(document, frameId));
        }

        return roots.get(frameId);
    };
    const fromRoot = fromFrameId ? rootFor(fromFrameId) : undefined;

    return (shape: Shape | undefined): shape is InstanceShape => {
        if (
            shape?.type !== 'instance' ||
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
    };
}

/** First increment: ordinary screen instances; repeated and nested source instances are excluded. */
export function prototypeTargets(document: Document, screenId?: string, fromFrameId?: string) {
    return Object.values(document.shapes).filter(
        prototypeTargetFilter(document, screenId, fromFrameId)
    );
}

/** The one instance `prototypeTargets` would return for this id, without scanning every shape. */
export function prototypeTarget(
    document: Document,
    instanceId: string,
    screenId?: string,
    fromFrameId?: string
) {
    // Ids can come from unvalidated edits, so only an own record with that exact id counts.
    const shape =
        typeof instanceId === 'string' && Object.hasOwn(document.shapes, instanceId)
            ? document.shapes[instanceId]
            : undefined;

    return shape?.id === instanceId && prototypeTargetFilter(document, screenId, fromFrameId)(shape)
        ? shape
        : undefined;
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
    if (activate?.type === 'state') {
        return activate.change === 'toggle' ? activate.stateId : undefined;
    }
    const target =
        activate?.type === 'toggleVisibility' ? document.shapes[activate.instanceId] : undefined;

    return target?.type === 'instance' ? booleanVisibility(document, target)?.stateId : undefined;
}

/**
 * Showing `instance` while `condition` holds would hide a control that toggles a state it reads:
 * itself, or one that toggles `instance` and already follows that state. Only Reset could show
 * it again. Set and reset actions may hide their control: a "Show more" can give way to "Less".
 */
export function bindingHidesControl(
    document: Document,
    instance: InstanceShape,
    condition: Condition
) {
    const states = visibilityStates({ prototypeVisibleWhen: condition });
    const toggled = document.components[instance.componentId]
        ? toggledState(document, instance)
        : undefined;
    if (toggled && states.includes(toggled)) {
        return true;
    }
    const followed = booleanVisibility(document, { prototypeVisibleWhen: condition })?.stateId;
    if (!followed) {
        return false;
    }

    return Object.values(document.shapes).some((shape) => {
        if (
            shape.type !== 'instance' ||
            !visibilityStates(shape).includes(followed) ||
            !document.components[shape.componentId]
        ) {
            return false;
        }
        const activate = effectiveActivation(document.components[shape.componentId], shape);

        return activate?.type === 'toggleVisibility' && activate.instanceId === instance.id;
    });
}
