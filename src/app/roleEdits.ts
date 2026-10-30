import type { Context } from './index';
import type { Component, Document, RoleSettings } from './types';
import { readRoleSettings, orUndefined } from './services/documentStorage';
import { isReadOnly } from './documentAccess';
import { isShapeLocked } from './utils';
import { ROLE_PROPERTIES, effectiveRoleSettings } from './componentRoles';
import { resolveComponentProp } from './componentProps';
import { frameParents, isFrameVisible } from './frameState';
import { sameRoleSettings } from './componentVariants';

/**
 * A family's instances take the default's role, so a role edit on the default carries over
 * to alternates that matched it. Alternates someone set up differently keep their settings.
 */
function mirrorToAlternates(
    document: Document,
    family: Component,
    previous: RoleSettings,
    settings: RoleSettings | null
) {
    for (const id of family.variantIds ?? []) {
        const alternate = document.components[id];
        if (
            !alternate ||
            alternate.library ||
            alternate.locked ||
            !sameRoleSettings(previous, effectiveRoleSettings(alternate))
        ) {
            continue;
        }
        if (settings === null) {
            delete alternate.interaction;
        } else {
            alternate.interaction = { ...settings, props: { ...settings.props } };
        }
    }
}

export interface RoleEdit {
    target: 'component' | 'instance';
    id: string;
    /** Null removes a source role or restores an instance's inheritance. */
    settings: RoleSettings | null;
}

export function editRole({ state }: Context, edit: RoleEdit) {
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
    if (!component || (edit.target === 'component' && (component.library || component.locked))) {
        return;
    }
    const target = instance?.type === 'instance' ? instance : component;
    if (edit.settings === null) {
        if (target === component) {
            mirrorToAlternates(document, component, effectiveRoleSettings(component), null);
        }
        delete target.interaction;

        return;
    }
    const settings = orUndefined(() => readRoleSettings(edit.settings));
    if (!settings) {
        return;
    }
    const fields = settings.role === 'none' ? [] : ROLE_PROPERTIES[settings.role];
    const previous = effectiveRoleSettings(
        component,
        instance?.type === 'instance' ? instance : undefined
    );
    const invalid = Object.entries(settings.props).some(([key, id]) => {
        if (previous.role === settings.role && previous.props[key] === id) {
            return false;
        }
        const field = fields.find((field) => field.key === key);
        const resolved = resolveComponentProp(component, id, document);

        return !field || !resolved || resolved.property.kind !== field.kind;
    });
    if (
        settings.navigateTo &&
        settings.navigateTo !== previous.navigateTo &&
        (settings.role !== 'button' ||
            !document.frames[settings.navigateTo] ||
            frameParents(document.frames).get(settings.navigateTo) ||
            !isFrameVisible(document, settings.navigateTo))
    ) {
        return;
    }
    if (invalid) {
        return;
    }
    if (JSON.stringify(target.interaction) === JSON.stringify(settings)) {
        return;
    }
    if (target === component) {
        mirrorToAlternates(document, component, previous, settings);
    }
    target.interaction = settings;
}
