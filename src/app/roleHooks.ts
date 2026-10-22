import { useAppState } from './hooks';
import {
    effectiveRoleSettings,
    resolveComponentRole,
    startingRoleLinks,
    ROLE_PROPERTIES
} from './componentRoles';
import type { ComponentRole } from './types';
import { resolveComponentProp } from './componentProps';
import { isReadOnly } from './documentAccess';
import { isShapeLocked } from './utils';
import { frameParents, isFrameVisible } from './frameState';

export const useRoleEditor = (componentId?: string, instanceId?: string) =>
    useAppState((state) => {
        const document = state.currentDocument;
        const shape = instanceId === undefined ? undefined : document.shapes[instanceId];
        const instance = shape?.type === 'instance' ? shape : undefined;
        const component = document.components[instance?.componentId ?? componentId ?? ''];
        if (!component || (instanceId !== undefined && !instance)) {
            return null;
        }
        const settings = effectiveRoleSettings(component, instance);
        const fields = settings.role === 'none' ? [] : ROLE_PROPERTIES[settings.role];
        const parents = frameParents(document.frames);

        return {
            settings: { ...settings, props: { ...settings.props } },
            screens: Object.values(document.frames)
                .filter((frame) => !parents.get(frame.id) && isFrameVisible(document, frame.id))
                .map((frame) => ({ id: frame.id, name: frame.name })),
            inherited: Boolean(instance && !instance.interaction),
            sourceRole: component.interaction?.role ?? 'none',
            startingLinks: Object.fromEntries(
                (Object.keys(ROLE_PROPERTIES) as ComponentRole[]).map((role) => [
                    role,
                    startingRoleLinks(document, component, settings, role, instance)
                ])
            ) as Record<ComponentRole, Record<string, string>>,
            problems: resolveComponentRole(document, component, instance).problems,
            fields: fields.map((field) => ({
                ...field,
                choices: (component.props ?? []).flatMap((prop) => {
                    const resolved = resolveComponentProp(component, prop.id, document);

                    return resolved?.property.kind === field.kind
                        ? [{ id: prop.id, label: prop.label }]
                        : [];
                })
            })),
            disabled:
                document.locked ||
                isReadOnly(state) ||
                state.events.pointer.gesture.kind !== 'idle' ||
                (instance
                    ? isShapeLocked(document, instance.id)
                    : Boolean(component.library || component.locked))
        };
    });
