import { screenOwners } from './screenViews';
import type { Context } from './index';
import type { Component, Document, InstanceShape, InteractionSettings, StateValue } from './types';
import { conditionOperands, type Condition } from '../shared/conditions';
import { isReadOnly } from './documentAccess';
import { isShapeLocked } from './utils';
import {
    orUndefined,
    readInteractions,
    readEntity,
    readCondition
} from './services/documentStorage';
import { screenFrames } from './screens';
import {
    validVariantAction,
    prototypeTarget,
    toggledState,
    bindingHidesControl
} from './interactiveVariants';
import { effectiveActivation } from './screenInteractions';
import {
    stateActionProblem,
    stateEquals,
    visibilityProblems,
    visibilityStates,
    stateType,
    stateProperty,
    conditionDecidesVisibility
} from './prototypeState';
import { effectiveRoleSettings } from './componentRoles';

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
    | {
          target: 'state';
          kind: 'add';
          name: string;
          /** Yes/no when omitted. */
          type?: 'boolean' | 'text' | 'number';
          initial: StateValue;
          /** A control that switches the new state, in the same undo step. */
          switchedBy?: string;
      }
    | { target: 'state'; kind: 'update'; id: string; name: string; initial: StateValue }
    | { target: 'state'; kind: 'delete'; id: string }
    | {
          target: 'state';
          kind: 'bind';
          instanceId: string;
          stateId: string | null;
          /** With no state, how the instance starts; leaves it unchanged when omitted. */
          visible?: boolean;
          /** With a yes/no state, the value that shows the instance; true when omitted. */
          when?: boolean;
      }
    /** Shown while a condition over state values holds. */
    | { target: 'state'; kind: 'show'; instanceId: string; condition: Condition }
    /** An exposed property shows a state's value in the prototype; null unbinds it. */
    | {
          target: 'state';
          kind: 'bindProperty';
          instanceId: string;
          propId: string;
          stateId: string | null;
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
    if (activationProblem(document, settings, target)) {
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
    const target = prototypeTarget(document, edit.instanceId);
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
function editPrototypeState(context: Context, edit: PrototypeStateEdit): string | undefined {
    const { state, effects } = context;
    const document = state.currentDocument;
    if (
        document.locked ||
        isReadOnly(state) ||
        state.resetDocumentId ||
        state.events.pointer.gesture.kind !== 'idle'
    ) {
        return 'Prototype state cannot be edited right now.';
    }
    if (edit.kind === 'bind' || edit.kind === 'show') {
        return showWhen(context, edit);
    }
    if (edit.kind === 'bindProperty') {
        return bindProperty(context, edit);
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
        // A state keeps its type; deleting and adding one is the way to change it.
        const type =
            edit.kind === 'add'
                ? (edit.type ?? 'boolean')
                : stateType(document.prototypeBooleans[edit.id]);
        const value = readEntity('prototypeBooleans', {
            id,
            name: edit.name,
            ...(type === 'boolean' ? {} : { type }),
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
        if (edit.kind === 'add' && edit.switchedBy && type === 'boolean') {
            editInteractions(context, {
                target: 'instance',
                id: edit.switchedBy,
                settings: { activate: { type: 'state', change: 'toggle', stateId: id } }
            });
        }
        effects.collaboration.flush();
    } catch (error) {
        return error instanceof Error ? error.message : 'Could not edit prototype state.';
    }
}

function showWhen(
    { state, effects }: Context,
    edit: Extract<PrototypeStateEdit, { kind: 'bind' | 'show' }>
): string | undefined {
    const document = state.currentDocument;
    if (edit.kind === 'bind' && edit.when !== undefined && typeof edit.when !== 'boolean') {
        return 'Choose true or false for the visibility condition.';
    }
    const shape = prototypeTarget(document, edit.instanceId);
    if (!shape || isShapeLocked(document, shape.id)) {
        return 'Choose an unlocked instance on a page.';
    }
    let condition: Condition | null = null;
    if (edit.kind === 'show') {
        condition = orUndefined(() => readCondition(edit.condition)) ?? null;
        // Visibility reads state values; there is no record to take fields from.
        if (!condition || conditionOperands(condition).some((item) => item.kind === 'field')) {
            return 'This condition cannot be read.';
        }
    } else if (edit.stateId !== null) {
        const value = document.prototypeBooleans[edit.stateId];
        if (!value || stateType(value) !== 'boolean') {
            return 'Choose an available yes/no state.';
        }
        condition = stateEquals(edit.stateId, edit.when ?? true);
    }
    if (condition) {
        const problem = visibilityProblems(document, condition)[0];
        if (problem) {
            return problem;
        }
        if (bindingHidesControl(document, shape, condition)) {
            return 'A control that toggles this state would hide itself. Choose another state.';
        }
    }
    effects.collaboration.startBatch(document.id, { kind: 'person' });
    if (condition) {
        shape.prototypeVisibleWhen = condition;
    } else {
        delete shape.prototypeVisibleWhen;
        if (edit.kind === 'bind' && edit.visible === true) {
            delete shape.prototypeVisible;
        } else if (edit.kind === 'bind' && edit.visible === false) {
            shape.prototypeVisible = false;
        }
    }
    effects.collaboration.flush();

    return undefined;
}

/** Text and number states fit text properties; any state fits a text property as words. */
function bindProperty(
    { state, effects }: Context,
    edit: Extract<PrototypeStateEdit, { kind: 'bindProperty' }>
): string | undefined {
    const document = state.currentDocument;
    const shape = document.shapes[edit.instanceId];
    if (shape?.type !== 'instance' || isShapeLocked(document, shape.id)) {
        return 'Choose an unlocked instance.';
    }
    const component = document.components[shape.componentId];
    const prop = component?.props?.find((item) => item.id === edit.propId);
    if (!component || !prop) {
        return 'This property is no longer exposed.';
    }
    if (edit.stateId !== null) {
        const value = document.prototypeBooleans[edit.stateId];
        if (!value) {
            return 'Choose an available state.';
        }
        const settings = effectiveRoleSettings(component, shape);
        if (
            settings.role === 'input' &&
            settings.props.value === prop.id &&
            stateType(value) === 'boolean'
        ) {
            return 'A field writes text or a number; choose a text or number state.';
        }
        if (!stateProperty(document, shape.componentId, prop.id)) {
            return 'Only a text property can show a state.';
        }
    }
    if ((shape.stateBindings?.[prop.id] ?? null) === edit.stateId) {
        return undefined;
    }
    effects.collaboration.startBatch(document.id, { kind: 'person' });
    if (edit.stateId === null) {
        if (shape.stateBindings) {
            delete shape.stateBindings[prop.id];
            if (!Object.keys(shape.stateBindings).length) {
                delete shape.stateBindings;
            }
        }
    } else if (shape.stateBindings) {
        shape.stateBindings[prop.id] = edit.stateId;
    } else {
        shape.stateBindings = { [prop.id]: edit.stateId };
    }
    effects.collaboration.flush();

    return undefined;
}

/**
 * Why an instance, or a component's own source, cannot take these settings, as the Flow menu
 * and the Inspector would refuse them; a link it already has may keep a page that is gone.
 */
export function activationProblem(
    document: Document,
    settings: InteractionSettings,
    owner: InstanceShape | Component
): string | undefined {
    const instance = 'type' in owner && owner.type === 'instance' ? owner : undefined;
    const component = instance ? document.components[instance.componentId] : (owner as Component);
    if (!component) {
        return 'Its component no longer exists.';
    }
    const activate = settings.activate;
    const current = effectiveActivation(component, instance);
    const page = instance?.parentFrameId
        ? screenOwners(document.frames).get(instance.parentFrameId)
        : undefined;
    if (
        activate?.type === 'changeVariant' &&
        (!page || !validVariantAction(document, activate, page, instance?.parentFrameId))
    ) {
        return 'It can only change a variant of an instance on its page.';
    }
    if (
        activate?.type === 'toggleVisibility' &&
        (!page ||
            activate.instanceId === instance?.id ||
            !prototypeTarget(document, activate.instanceId, page, instance?.parentFrameId) ||
            conditionDecidesVisibility(document, document.shapes[activate.instanceId] as never))
    ) {
        return 'It can only show or hide another instance on its page that no condition shows.';
    }
    if (activate?.type === 'state') {
        const problem = page ? stateActionProblem(document, activate) : 'It is not on a page.';
        if (problem) {
            return problem;
        }
    }
    // A control that toggles a state its own visibility reads would hide itself until Reset.
    const toggled = instance && activate && toggledState(document, instance, activate);
    if (toggled && visibilityStates(instance).includes(toggled)) {
        return 'It would hide itself.';
    }
    const destination = activate?.screenId;
    if (
        destination &&
        destination !== current?.screenId &&
        !screenFrames(document).some((screen) => screen.id === destination)
    ) {
        return `${destination} is not a page.`;
    }

    return undefined;
}
