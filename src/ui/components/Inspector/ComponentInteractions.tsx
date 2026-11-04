import React, { type FC } from 'react';
import { useActions } from 'src/app/hooks';
import { useRoleEditor } from 'src/app/roleHooks';
import type { InteractionSettings } from 'src/app/types';
import { PropertyGroup } from './PropertyGroup';
import styles from './styles.css';

/** Actions belong to the component or instance, independently of its semantic role. */
export const ComponentInteractions: FC<{ componentId?: string; instanceId?: string }> = ({
    componentId,
    instanceId
}) => {
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
    const visibilityAction =
        data.activation?.type === 'toggleVisibility' ? data.activation : undefined;
    const variantAction = data.activation?.type === 'changeVariant' ? data.activation : undefined;
    const target = data.activation?.screenId;
    const sourceTarget = data.sourceActivation?.screenId;
    const unavailable = target && !data.screens.some((screen) => screen.id === target);
    const trigger = data.settings.role === 'input' ? 'On Enter' : 'On activation';

    return (
        <section aria-label="Interactions" className={styles.interactions}>
            <table>
                <PropertyGroup name="Interactions">
                    <tr>
                        <td colSpan={2}>
                            <div className={styles.interactionField}>
                                <label htmlFor="activate-target">{trigger}</label>
                                <select
                                    id="activate-target"
                                    aria-label={`${trigger}: action`}
                                    disabled={data.disabled || data.actionFamily !== undefined}
                                    value={
                                        data.actionInherited
                                            ? 'inherit'
                                            : visibilityAction
                                              ? JSON.stringify(visibilityAction)
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
                                        update({
                                            activate:
                                                choice === 'none'
                                                    ? null
                                                    : typeof JSON.parse(choice) === 'string'
                                                      ? {
                                                            type: 'navigate',
                                                            screenId: JSON.parse(choice)
                                                        }
                                                      : JSON.parse(choice)
                                        });
                                    }}
                                >
                                    {instanceId && (
                                        <option value="inherit">
                                            Source:{' '}
                                            {data.sourceActivation?.type === 'toggleVisibility'
                                                ? 'Toggle visibility'
                                                : data.sourceActivation?.type === 'changeVariant'
                                                  ? 'Change variant'
                                                  : sourceTarget
                                                    ? (data.screens.find(
                                                          (screen) => screen.id === sourceTarget
                                                      )?.name ?? 'Unavailable screen')
                                                    : 'No action'}
                                        </option>
                                    )}
                                    <option value="none">No action</option>
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
                                            <option value={JSON.stringify(visibilityAction)}>
                                                Unavailable visibility target
                                            </option>
                                        )}
                                    {data.visibilityTargets.length > 0 && (
                                        <optgroup label="Toggle visibility">
                                            {data.visibilityTargets.map((item) => (
                                                <option
                                                    key={item.id}
                                                    value={JSON.stringify({
                                                        type: 'toggleVisibility',
                                                        instanceId: item.id
                                                    })}
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
                                            Unavailable screen
                                        </option>
                                    )}
                                    {data.screens.map((screen) => (
                                        <option key={screen.id} value={JSON.stringify(screen.id)}>
                                            Navigate to {screen.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </td>
                    </tr>
                    {instanceId && data.prototypeVisible !== undefined && (
                        <tr>
                            <td colSpan={2}>
                                <label className={styles.prototypeVisibility}>
                                    <input
                                        type="checkbox"
                                        checked={data.prototypeVisible}
                                        disabled={data.disabled}
                                        onChange={(event) =>
                                            editInteractions({
                                                target: 'visibility',
                                                instanceId,
                                                visible: event.target.checked
                                            })
                                        }
                                    />{' '}
                                    Show initially in prototype
                                </label>
                            </td>
                        </tr>
                    )}
                    {(data.actionFamily !== undefined || unavailable) && (
                        <tr>
                            <td colSpan={2}>
                                <small className={styles.frameHint}>
                                    {data.actionFamily !== undefined &&
                                        `Action managed by ${data.actionFamily}. `}
                                    {unavailable &&
                                        'Choose an available screen to restore navigation.'}
                                </small>
                            </td>
                        </tr>
                    )}
                </PropertyGroup>
            </table>
        </section>
    );
};

/** One spelling per action, whatever order a stored action's keys are in. */
function variantChoice(instanceId: string, variantId: string) {
    return JSON.stringify({ type: 'changeVariant', instanceId, variantId });
}
