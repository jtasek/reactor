import React, { type FC } from 'react';
import {
    ArrowLeftRight,
    Ban,
    Braces,
    Eye,
    FileText,
    Info,
    ToggleLeft,
    type LucideIcon
} from 'lucide-react';
import { useActions } from 'src/app/hooks';
import { useRoleEditor } from 'src/app/roleHooks';
import type { InteractionSettings, StateAction } from 'src/app/types';
import { stateType } from 'src/app/prototypeState';
import { Icon } from '../Icon';
import {
    PrototypeState,
    PrototypeVisibility,
    StateBindings,
    StateValueInput
} from './PrototypeState';
import { InspectorTable, PropertyGroup } from './PropertyGroup';
import styles from './styles.css';

/** Actions belong to the component or instance, independently of its semantic role. */
export const ComponentInteractions: FC<{
    componentId?: string;
    instanceId?: string;
    actionOnly?: boolean;
}> = ({ componentId, instanceId, actionOnly = false }) => {
    const data = useRoleEditor(componentId, instanceId);
    const { editInteractions } = useActions();
    if (!data) {
        return null;
    }
    const update = (settings: InteractionSettings) =>
        editInteractions({
            target: instanceId ? 'instance' : 'component',
            id: instanceId ?? componentId!,
            settings
        });
    const stateAction = data.activation?.type === 'state' ? data.activation : undefined;
    const actedState = stateAction && data.states.find((value) => value.id === stateAction.stateId);
    const followed = new Set(data.followed ? [data.followed.stateId] : []);
    const visibilityAction =
        data.activation?.type === 'toggleVisibility' ? data.activation : undefined;
    const variantAction = data.activation?.type === 'changeVariant' ? data.activation : undefined;
    const target = data.activation?.screenId;
    const sourceTarget = data.sourceActivation?.screenId;
    const unavailable = target && !data.screens.some((screen) => screen.id === target);
    const trigger = data.settings.role === 'input' ? 'On Enter' : 'On activation';
    const kind: ActionKind | undefined = data.actionInherited
        ? undefined
        : stateAction
          ? stateAction.change === 'toggle'
              ? 'toggle'
              : 'set'
          : visibilityAction
            ? 'visibility'
            : variantAction
              ? 'variant'
              : target
                ? 'page'
                : 'none';
    const toggleable = data.states.find(
        (value) => stateType(value) === 'boolean' && !followed.has(value.id)
    );
    const firstState = data.states[0];
    const firstVariant = data.variantTargets.find((item) => item.variants.length > 0);
    // Each kind starts at its first target; the pop-up below picks another.
    const defaults: Record<ActionKind, InteractionSettings['activate'] | undefined> = {
        none: null,
        page: data.screens[0] && { type: 'navigate', screenId: data.screens[0].id },
        visibility: data.visibilityTargets[0] && {
            type: 'toggleVisibility',
            instanceId: data.visibilityTargets[0].id
        },
        variant: firstVariant && {
            type: 'changeVariant',
            instanceId: firstVariant.id,
            variantId: firstVariant.variants[0].id
        },
        toggle:
            instanceId && toggleable
                ? { type: 'state', change: 'toggle', stateId: toggleable.id }
                : undefined,
        set:
            instanceId && firstState
                ? {
                      type: 'state',
                      change: 'set',
                      stateId: firstState.id,
                      value: stateType(firstState) === 'boolean' ? true : firstState.initial
                  }
                : undefined
    };
    const kinds = ACTION_KINDS.filter(
        (item) => instanceId || (item.id !== 'toggle' && item.id !== 'set')
    );
    const actionDisabled = data.disabled || data.actionFamily !== undefined;

    return (
        <section
            aria-label="Interactions"
            className={styles.interactions}
            data-action-only={actionOnly}
        >
            <InspectorTable>
                <PropertyGroup name="Interactions">
                    <tr>
                        <td colSpan={2}>
                            <div className={styles.interactionField}>
                                <label htmlFor="activate-target" className={styles.caption}>
                                    {trigger}
                                    {' · '}
                                    <b>
                                        {kind
                                            ? ACTION_KINDS.find((item) => item.id === kind)!.name
                                            : 'From source'}
                                    </b>
                                </label>
                                <div
                                    role="group"
                                    aria-label={`${trigger}: kind of action`}
                                    className={`${styles.segments} ${styles.iconSwitch}`}
                                >
                                    {kinds.map((item) => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            aria-label={item.name}
                                            title={item.name}
                                            aria-pressed={kind === item.id}
                                            disabled={
                                                actionDisabled || defaults[item.id] === undefined
                                            }
                                            onClick={() => {
                                                if (kind !== item.id) {
                                                    update({ activate: defaults[item.id] });
                                                }
                                            }}
                                        >
                                            <Icon icon={{ component: item.icon, size: 16 }} />
                                        </button>
                                    ))}
                                </div>
                                <select
                                    id="activate-target"
                                    aria-label={`${trigger}: action`}
                                    disabled={actionDisabled}
                                    value={
                                        data.actionInherited
                                            ? 'inherit'
                                            : stateAction
                                              ? stateChoice(stateAction)
                                              : visibilityAction
                                                ? visibilityChoice(visibilityAction.instanceId)
                                                : variantAction
                                                  ? variantChoice(
                                                        variantAction.instanceId,
                                                        variantAction.variantId
                                                    )
                                                  : target
                                                    ? JSON.stringify(target)
                                                    : 'none'
                                    }
                                    onChange={(event) => {
                                        const choice = event.target.value;
                                        if (choice === 'inherit') {
                                            update({});

                                            return;
                                        }
                                        const parsed =
                                            choice === 'none' ? null : JSON.parse(choice);
                                        // Setting a text or number state starts at its initial value.
                                        const state =
                                            parsed?.type === 'state' &&
                                            parsed.change === 'set' &&
                                            parsed.value === undefined
                                                ? data.states.find(
                                                      (value) => value.id === parsed.stateId
                                                  )
                                                : undefined;
                                        update({
                                            activate:
                                                parsed === null
                                                    ? null
                                                    : typeof parsed === 'string'
                                                      ? { type: 'navigate', screenId: parsed }
                                                      : state
                                                        ? { ...parsed, value: state.initial }
                                                        : parsed
                                        });
                                    }}
                                >
                                    {instanceId && (
                                        <option value="inherit">
                                            Source:{' '}
                                            {data.sourceActivation?.type === 'toggleVisibility'
                                                ? 'Toggle visibility'
                                                : data.sourceActivation?.type === 'state'
                                                  ? 'Change state'
                                                  : data.sourceActivation?.type === 'changeVariant'
                                                    ? 'Change variant'
                                                    : sourceTarget
                                                      ? (data.screens.find(
                                                            (screen) => screen.id === sourceTarget
                                                        )?.name ?? 'Unavailable page')
                                                      : 'No action'}
                                        </option>
                                    )}
                                    <option value="none">No action</option>
                                    {stateAction && !actedState && (
                                        <option value={stateChoice(stateAction)}>
                                            Missing state
                                        </option>
                                    )}
                                    {instanceId &&
                                        data.states.some(
                                            (value) =>
                                                stateType(value) === 'boolean' &&
                                                !followed.has(value.id)
                                        ) && (
                                            <optgroup label="Toggle state">
                                                {data.states
                                                    // Toggling the state it follows would hide this control.
                                                    .filter(
                                                        (value) =>
                                                            stateType(value) === 'boolean' &&
                                                            !followed.has(value.id)
                                                    )
                                                    .map((value) => (
                                                        <option
                                                            key={value.id}
                                                            value={stateChoice({
                                                                type: 'state',
                                                                change: 'toggle',
                                                                stateId: value.id
                                                            })}
                                                        >
                                                            Toggle state: {value.name}
                                                        </option>
                                                    ))}
                                            </optgroup>
                                        )}
                                    {instanceId &&
                                        data.states.map((state) => (
                                            <optgroup key={state.id} label={`Set ${state.name}`}>
                                                {stateType(state) === 'boolean' ? (
                                                    [true, false].map((value) => (
                                                        <option
                                                            key={String(value)}
                                                            value={stateChoice({
                                                                type: 'state',
                                                                change: 'set',
                                                                stateId: state.id,
                                                                value
                                                            })}
                                                        >
                                                            Set {state.name} to {String(value)}
                                                        </option>
                                                    ))
                                                ) : (
                                                    <option
                                                        value={JSON.stringify({
                                                            type: 'state',
                                                            change: 'set',
                                                            stateId: state.id
                                                        })}
                                                    >
                                                        Set {state.name} to…
                                                    </option>
                                                )}
                                                <option
                                                    value={stateChoice({
                                                        type: 'state',
                                                        change: 'reset',
                                                        stateId: state.id
                                                    })}
                                                >
                                                    Reset {state.name}
                                                </option>
                                            </optgroup>
                                        ))}
                                    {variantAction &&
                                        !data.variantTargets.some(
                                            (item) =>
                                                item.id === variantAction.instanceId &&
                                                item.variants.some(
                                                    (variant) =>
                                                        variant.id === variantAction.variantId
                                                )
                                        ) && (
                                            <option
                                                value={variantChoice(
                                                    variantAction.instanceId,
                                                    variantAction.variantId
                                                )}
                                            >
                                                Unavailable variant
                                            </option>
                                        )}
                                    {visibilityAction &&
                                        !data.visibilityTargets.some(
                                            (item) => item.id === visibilityAction.instanceId
                                        ) && (
                                            <option
                                                value={visibilityChoice(
                                                    visibilityAction.instanceId
                                                )}
                                            >
                                                Unavailable visibility target
                                            </option>
                                        )}
                                    {data.visibilityTargets.length > 0 && (
                                        <optgroup label="Toggle visibility">
                                            {data.visibilityTargets.map((item) => (
                                                <option
                                                    key={item.id}
                                                    value={visibilityChoice(item.id)}
                                                >
                                                    Toggle {item.name}
                                                </option>
                                            ))}
                                        </optgroup>
                                    )}
                                    {data.variantTargets.map((item) => (
                                        <optgroup key={item.id} label={`Change ${item.name}`}>
                                            {item.variants.map((variant) => (
                                                <option
                                                    key={variant.id}
                                                    value={variantChoice(item.id, variant.id)}
                                                >
                                                    {item.name} → {variant.name}
                                                </option>
                                            ))}
                                        </optgroup>
                                    ))}
                                    {unavailable && (
                                        <option value={JSON.stringify(target)}>
                                            Unavailable page
                                        </option>
                                    )}
                                    {data.screens.map((screen) => (
                                        <option key={screen.id} value={JSON.stringify(screen.id)}>
                                            Navigate to {screen.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {stateAction?.change === 'set' &&
                                actedState &&
                                stateType(actedState) !== 'boolean' &&
                                !data.actionInherited && (
                                    <div className={styles.interactionField}>
                                        <label>
                                            {`Set ${actedState.name} to`}
                                            <StateValueInput
                                                type={stateType(actedState)}
                                                value={stateAction.value}
                                                label={`Value to set ${actedState.name} to`}
                                                disabled={data.disabled}
                                                onCommit={(value) =>
                                                    update({ activate: { ...stateAction, value } })
                                                }
                                            />
                                        </label>
                                    </div>
                                )}
                        </td>
                    </tr>
                    {!actionOnly && instanceId && data.prototypeVisible !== undefined && (
                        <tr>
                            <td colSpan={2}>
                                <PrototypeVisibility
                                    instanceId={instanceId}
                                    visible={data.prototypeVisible}
                                    condition={data.visibleWhen}
                                    text={data.visibilityText}
                                    problems={data.visibilityProblems}
                                    values={data.states}
                                    blocked={data.blockedStateIds}
                                    disabled={data.disabled}
                                />
                            </td>
                        </tr>
                    )}
                    {!actionOnly &&
                        instanceId &&
                        data.states.length > 0 &&
                        data.stateProperties.length > 0 && (
                            <tr>
                                <td colSpan={2}>
                                    <StateBindings
                                        instanceId={instanceId}
                                        properties={data.stateProperties}
                                        values={data.states}
                                        disabled={data.disabled}
                                    />
                                </td>
                            </tr>
                        )}
                    {(data.actionFamily !== undefined || unavailable) && (
                        <tr className={styles.footnote}>
                            <td colSpan={2}>
                                <small className={styles.frameHint}>
                                    {data.actionFamily !== undefined &&
                                        `Action managed by ${data.actionFamily}. `}
                                    {unavailable &&
                                        'Choose an available page to restore navigation.'}
                                </small>
                            </td>
                        </tr>
                    )}
                </PropertyGroup>
            </InspectorTable>
            {!actionOnly && (
                <details className={styles.inspectorHelp}>
                    <summary title="About prototype behavior">
                        <Icon icon={{ component: Info, size: 16 }} />
                        <span className={styles.visuallyHidden}>About prototype behavior</span>
                    </summary>
                    <p>
                        Roles connect exposed properties to controls. Actions run in Preview and
                        Prototype; canvas clicks select and edit.
                    </p>
                    {data.settings.role === 'input' && (
                        <p>
                            Input actions run on Enter. Use the same input identity and Value
                            property across a page’s designs to keep typed input. Each identity must
                            be unique within a design.
                        </p>
                    )}
                    {instanceId && (
                        <p>
                            From source follows the component. Choose it again to restore
                            inheritance.
                        </p>
                    )}
                </details>
            )}
            {!actionOnly && instanceId && data.prototypeVisible !== undefined && (
                <PrototypeState values={data.states} disabled={data.disabled} />
            )}
        </section>
    );
};

type ActionKind = 'none' | 'page' | 'visibility' | 'variant' | 'toggle' | 'set';

const ACTION_KINDS: { id: ActionKind; name: string; icon: LucideIcon }[] = [
    { id: 'none', name: 'No action', icon: Ban },
    { id: 'page', name: 'Go to page', icon: FileText },
    { id: 'visibility', name: 'Show or hide', icon: Eye },
    { id: 'variant', name: 'Change variant', icon: ArrowLeftRight },
    { id: 'toggle', name: 'Toggle state', icon: ToggleLeft },
    { id: 'set', name: 'Set state', icon: Braces }
];

/** One spelling per action, whatever order a stored action's keys are in. */
function variantChoice(instanceId: string, variantId: string) {
    return JSON.stringify({ type: 'changeVariant', instanceId, variantId });
}

function visibilityChoice(instanceId: string) {
    return JSON.stringify({ type: 'toggleVisibility', instanceId });
}

/** Setting a text or number state is one choice, whatever value it sets. */
function stateChoice(action: StateAction) {
    return JSON.stringify({
        type: action.type,
        change: action.change,
        stateId: action.stateId,
        ...(action.change === 'set' && typeof action.value === 'boolean'
            ? { value: action.value }
            : {})
    });
}
