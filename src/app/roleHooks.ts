import { screenOwners } from './screenViews';
import { variantTargets, prototypeTargets, bindingHidesControl } from './interactiveVariants';
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
import { screenFrames } from './screens';
import { effectiveActivation, inheritedActivation } from './screenInteractions';
import {
    booleanVisibility,
    describeCondition,
    stateEquals,
    stateType,
    visibilityProblems,
    visibilityStates,
    stateProperty,
    conditionDecidesVisibility
} from './prototypeState';
import type { Condition } from '../shared/conditions';

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

        // A variant draws for its family, whose action applies to every variant.
        const family = instance
            ? undefined
            : Object.values(document.components).find((item) =>
                  item.variantIds?.includes(component.id)
              );

        const owner = instance?.parentFrameId
            ? screenOwners(document.frames).get(instance.parentFrameId)
            : undefined;

        const visibilityTargets = owner
            ? prototypeTargets(document, owner, instance?.parentFrameId)
            : [];

        return {
            states: Object.values(document.prototypeBooleans).map((value) => ({ ...value })),
            visibleWhen: instance?.prototypeVisibleWhen
                ? (JSON.parse(JSON.stringify(instance.prototypeVisibleWhen)) as Condition)
                : undefined,
            visibilityProblems: instance?.prototypeVisibleWhen
                ? visibilityProblems(document, instance.prototypeVisibleWhen)
                : [],
            followed: instance ? booleanVisibility(document, instance) : undefined,
            visibilityText: instance?.prototypeVisibleWhen
                ? describeCondition(document, instance.prototypeVisibleWhen)
                : undefined,
            // States this instance cannot follow without hiding a control that toggles them.
            blockedStateIds: instance
                ? Object.values(document.prototypeBooleans)
                      .filter(
                          (value) =>
                              stateType(value) === 'boolean' &&
                              bindingHidesControl(document, instance, stateEquals(value.id, true))
                      )
                      .map((value) => value.id)
                : [],
            // A control that hid itself could only come back on Reset.
            visibilityTargets: visibilityTargets
                .filter((target) => {
                    const followed = booleanVisibility(document, target)?.stateId;

                    return (
                        target.id !== instanceId &&
                        !conditionDecidesVisibility(document, target) &&
                        !(followed && instance && visibilityStates(instance).includes(followed))
                    );
                })
                .map(({ id, name }) => ({ id, name })),
            // Text properties a state can show in the prototype; an input's value also takes typing.
            stateProperties: instance
                ? (component.props ?? [])
                      .filter((prop) => stateProperty(document, component.id, prop.id))
                      .map((prop) => ({
                          id: prop.id,
                          label: prop.label,
                          input: settings.role === 'input' && settings.props.value === prop.id,
                          stateId: instance.stateBindings?.[prop.id]
                      }))
                : [],
            prototypeVisible:
                instance && visibilityTargets.some((target) => target.id === instance.id)
                    ? (instance.prototypeVisible ?? true)
                    : undefined,
            settings: { ...settings, props: { ...settings.props } },
            activation: effectiveActivation(family ?? component, instance),
            sourceActivation: effectiveActivation(family ?? component),
            variantTargets: (owner
                ? variantTargets(document, owner, instance?.parentFrameId)
                : []
            ).map((target) => ({
                id: target.id,
                name: target.name,
                variants: [
                    target.componentId,
                    ...(document.components[target.componentId].variantIds ?? [])
                ]
                    .filter((id) => Boolean(document.components[id]))
                    .map((id) => ({ id, name: document.components[id].name }))
            })),
            actionFamily: family?.name,
            actionInherited: Boolean(instance && inheritedActivation(instance)),
            screens: screenFrames(document).map((frame) => ({ id: frame.id, name: frame.name })),
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
