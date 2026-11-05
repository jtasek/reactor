import { screenOwners } from './screenViews';
import type { Context } from './index';
import type { InteractionSettings } from './types';
import { isReadOnly } from './documentAccess';
import { isShapeLocked } from './utils';
import { orUndefined, readInteractions } from './services/documentStorage';
import { screenFrames } from './screens';
import { validVariantAction, prototypeTargets } from './interactiveVariants';
import { effectiveActivation } from './screenInteractions';

export interface InteractionEdit {
    target: 'component' | 'instance';
    id: string;
    settings: InteractionSettings;
}

export interface VisibilityEdit {
    target: 'visibility';
    instanceId: string;
    visible: boolean;
}

export function editInteractions(context: Context, edit: InteractionEdit | VisibilityEdit) {
    if (edit.target === 'visibility') {
        editPrototypeVisibility(context, edit);

        return;
    }
    const { state } = context;
    const document = state.currentDocument;
    if (document.locked || isReadOnly(state) || state.events.pointer.gesture.kind !== 'idle') {
        return;
    }
    const instance = edit.target === 'instance' ? document.shapes[edit.id] : undefined;
    if (
        edit.target === 'instance' &&
        (instance?.type !== 'instance' || isShapeLocked(document, edit.id))
    ) {
        return;
    }
    const component =
        document.components[instance?.type === 'instance' ? instance.componentId : edit.id];
    if (
        !component ||
        (edit.target === 'component' &&
            (component.library ||
                component.locked ||
                // Variants take their family's action, so their own would never apply.
                Object.values(document.components).some((item) =>
                    item.variantIds?.includes(component.id)
                )))
    ) {
        return;
    }
    const settings = orUndefined(() => readInteractions(edit.settings));
    if (!settings) {
        return;
    }
    const target = instance?.type === 'instance' ? instance : component;
    const current = effectiveActivation(
        component,
        instance?.type === 'instance' ? instance : undefined
    );
    const owner = instance?.parentFrameId
        ? screenOwners(document.frames).get(instance.parentFrameId)
        : undefined;
    if (
        settings.activate?.type === 'changeVariant' &&
        (!owner || !validVariantAction(document, settings.activate, owner, instance?.parentFrameId))
    ) {
        return;
    }
    const visibilityTarget =
        settings.activate?.type === 'toggleVisibility' ? settings.activate.instanceId : undefined;
    if (
        visibilityTarget !== undefined &&
        (!owner ||
            visibilityTarget === instance?.id ||
            !prototypeTargets(document, owner, instance?.parentFrameId).some(
                (shape) => shape.id === visibilityTarget
            ))
    ) {
        return;
    }
    const destination = settings.activate?.screenId;
    if (
        destination &&
        destination !== current?.screenId &&
        !screenFrames(document).some((screen) => screen.id === destination)
    ) {
        return;
    }
    if (JSON.stringify(target.interactions) === JSON.stringify(settings)) {
        return;
    }
    target.interactions = settings;
}

/** Edits only the launch default, never a running player's boolean state. */
function editPrototypeVisibility(
    { state }: Context,
    edit: { instanceId: string; visible: boolean }
) {
    const document = state.currentDocument;
    if (
        typeof edit.visible !== 'boolean' ||
        document.locked ||
        isReadOnly(state) ||
        state.events.pointer.gesture.kind !== 'idle' ||
        isShapeLocked(document, edit.instanceId)
    ) {
        return;
    }
    const target = prototypeTargets(document).find((shape) => shape.id === edit.instanceId);
    if (!target) {
        return;
    }
    if (edit.visible) {
        delete target.prototypeVisible;

        return;
    }
    target.prototypeVisible = false;
}
