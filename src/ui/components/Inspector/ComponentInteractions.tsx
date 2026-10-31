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
    const target = data.activation?.screenId;
    const unavailable = target && !data.screens.some((screen) => screen.id === target);

    return (
        <section aria-label="Interactions" className={styles.interactions}>
            <table>
                <PropertyGroup name="Interactions">
                    <tr>
                        <th scope="row">
                            <label htmlFor="activate-target">Activate</label>
                        </th>
                        <td>
                            <select
                                id="activate-target"
                                aria-label="Navigate to screen"
                                disabled={data.disabled || data.actionFamily !== undefined}
                                value={
                                    data.actionInherited
                                        ? 'inherit'
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
                                                : { type: 'navigate', screenId: JSON.parse(choice) }
                                    });
                                }}
                            >
                                {instanceId && <option value="inherit">From source</option>}
                                <option value="none">No action</option>
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
                        </td>
                    </tr>
                    <tr>
                        <td colSpan={2}>
                            <small className={styles.frameHint}>
                                {data.actionFamily !== undefined &&
                                    `Variants use the action of ${data.actionFamily}. `}
                                {data.actionInherited &&
                                    (target
                                        ? `From source: navigate to ${data.screens.find((screen) => screen.id === target)?.name ?? 'unavailable screen'}. `
                                        : 'From source: no action. ')}
                                {unavailable
                                    ? 'Choose an available screen to restore navigation. '
                                    : ''}
                                {data.settings.role === 'input'
                                    ? 'Press Enter in Preview to activate. '
                                    : 'Click or use the keyboard in Preview to activate. '}
                                Canvas clicks select and edit.
                            </small>
                        </td>
                    </tr>
                </PropertyGroup>
            </table>
        </section>
    );
};
