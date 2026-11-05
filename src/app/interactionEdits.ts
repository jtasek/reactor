import { screenOwners } from './screenViews';
import type { Context } from './index';
import type { InteractionSettings } from './types';
import { isReadOnly } from './documentAccess';
import { isShapeLocked } from './utils';
import { orUndefined, readInteractions, readEntity } from './services/documentStorage';
import { screenFrames } from './screens';
import {
    validVariantAction,
    prototypeTargets,
    toggledState,
    bindingHidesControl
} from './interactiveVariants';
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

export type PrototypeStateEdit =
    | { target: 'state'; kind: 'add'; name: string; initial: boolean }
    | { target: 'state'; kind: 'update'; id: string; name: string; initial: boolean }
    | { target: 'state'; kind: 'delete'; id: string }
    | {
          target: 'state';
          kind: 'bind';
          instanceId: string;
          stateId: string | null;
          /** With no state, how the instance starts; leaves it unchanged when omitted. */
          visible?: boolean;
          when?: boolean;
      };

export function editInteractions(
    context: Context,
    edit: InteractionEdit | VisibilityEdit | PrototypeStateEdit
) {
    if (edit.target === 'state') {
        return editPrototypeState(context, edit);
    }
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
    if (
        (settings.activate?.type === 'toggleState' || settings.activate?.type === 'setState') &&
        (!owner || !document.prototypeBooleans[settings.activate.stateId])
    ) {
        return;
    }
    // A control bound to the state it toggles would hide itself until Reset.
    if (
        instance?.type === 'instance' &&
        instance.prototypeVisibilityStateId &&
        settings.activate &&
        toggledState(document, instance, settings.activate) === instance.prototypeVisibilityStateId
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

/** Named runtime values are authored graph records; a session never writes them back. */
function editPrototypeState(
    { state, effects }: Context,
    edit: PrototypeStateEdit
): string | undefined {
    const document = state.currentDocument;
    if (
        document.locked ||
        isReadOnly(state) ||
        state.resetDocumentId ||
        state.events.pointer.gesture.kind !== 'idle'
    ) {
        return 'Prototype state cannot be edited right now.';
    }
    if (edit.kind === 'bind') {
        if (edit.when !== undefined && typeof edit.when !== 'boolean') {
            return 'Choose true or false for the visibility condition.';
        }
        const shape = prototypeTargets(document).find((item) => item.id === edit.instanceId);
        if (
            !shape ||
            isShapeLocked(document, shape.id) ||
            (edit.stateId !== null && !document.prototypeBooleans[edit.stateId])
        ) {
            return 'Choose an unlocked instance and an available state.';
        }
        if (edit.stateId !== null && bindingHidesControl(document, shape, edit.stateId)) {
            return 'A control that toggles this state would hide itself. Choose another state.';
        }
        effects.collaboration.startBatch(document.id, { kind: 'person' });
        if (edit.stateId === null) {
            delete shape.prototypeVisibilityStateId;
            delete shape.prototypeVisibilityWhen;
            if (edit.visible === true) {
                delete shape.prototypeVisible;
            } else if (edit.visible === false) {
                shape.prototypeVisible = false;
            }
        } else {
            shape.prototypeVisibilityStateId = edit.stateId;
            shape.prototypeVisibilityWhen = edit.when ?? true;
        }
        effects.collaboration.flush();

        return;
    }
    if (edit.kind !== 'add' && !document.prototypeBooleans[edit.id]) {
        return 'This state no longer exists.';
    }
    if (edit.kind === 'delete') {
        // Keep bindings durable so Undo and remote restoration reconnect them.
        effects.collaboration.startBatch(document.id, { kind: 'person' });
        delete document.prototypeBooleans[edit.id];
        effects.collaboration.flush();

        return;
    }
    try {
        const id = edit.kind === 'add' ? effects.newId() : edit.id;
        const value = readEntity('prototypeBooleans', {
            id,
            name: edit.name,
            initial: edit.initial
        });
        if (
            Object.values(document.prototypeBooleans).some(
                (item) => item.id !== id && item.name === value.name
            )
        ) {
            return 'A state with this name already exists.';
        }
        effects.collaboration.startBatch(document.id, { kind: 'person' });
        const existing = document.prototypeBooleans[id];
        if (existing) {
            existing.name = value.name;
            existing.initial = value.initial;
        } else {
            document.prototypeBooleans[id] = value;
        }
        effects.collaboration.flush();
    } catch (error) {
        return error instanceof Error ? error.message : 'Could not edit prototype state.';
    }
}
