import React, { type FC } from 'react';
import type { ComponentRole as ComponentRoleName, RoleSettings } from 'src/app/types';
import { roleLinks } from 'src/app/componentRoles';
import { useActions } from 'src/app/hooks';
import { useRoleEditor } from 'src/app/roleHooks';
import { PropertyGroup } from './PropertyGroup';
import styles from './styles.css';

const ROLES = ['none', 'text', 'input', 'button', 'list', 'image'] as const;

export const ComponentRole: FC<{ componentId?: string; instanceId?: string }> = ({
    componentId,
    instanceId
}) => {
    const data = useRoleEditor(componentId, instanceId);
    const { editRole } = useActions();
    if (!data) {
        return null;
    }
    const update = (settings: RoleSettings | null) =>
        editRole({
            target: instanceId ? 'instance' : 'component',
            id: instanceId ?? componentId!,
            settings
        });

    return (
        <section aria-label="Semantic role">
            <table>
                <PropertyGroup name="Role">
                    <tr>
                        <th scope="row">
                            <label htmlFor="component-role">Role</label>
                        </th>
                        <td>
                            <select
                                id="component-role"
                                aria-label="Semantic role"
                                disabled={data.disabled}
                                value={data.inherited ? 'inherit' : data.settings.role}
                                onChange={(event) => {
                                    const role = event.target.value;
                                    if (role === 'inherit' || (role === 'none' && !instanceId)) {
                                        update(null);

                                        return;
                                    }
                                    if (
                                        data.inherited &&
                                        role !== 'none' &&
                                        role === data.sourceRole
                                    ) {
                                        // Already this role through the source; keep following it.
                                        return;
                                    }
                                    update(
                                        role === 'none'
                                            ? { role, props: {} }
                                            : {
                                                  role: role as ComponentRoleName,
                                                  props: data.startingLinks[
                                                      role as ComponentRoleName
                                                  ]
                                              }
                                    );
                                }}
                            >
                                {instanceId && (
                                    <option value="inherit">From source ({data.sourceRole})</option>
                                )}
                                {ROLES.map((role) => (
                                    <option key={role} value={role}>
                                        {role[0].toUpperCase() + role.slice(1)}
                                    </option>
                                ))}
                            </select>
                        </td>
                    </tr>
                    {data.fields.map((field) => {
                        const value = data.settings.props[field.key] ?? '';
                        const missing =
                            value && !field.choices.some((choice) => choice.id === value);

                        return (
                            <tr key={field.key}>
                                <th scope="row">
                                    <label htmlFor={`role-${field.key}`}>{field.label}</label>
                                </th>
                                <td>
                                    <select
                                        id={`role-${field.key}`}
                                        aria-label={`Role ${field.label.toLowerCase()}`}
                                        disabled={data.disabled}
                                        value={value}
                                        onChange={(event) => {
                                            const props = roleLinks(data.settings.role, {
                                                ...data.settings.props
                                            });
                                            if (event.target.value) {
                                                props[field.key] = event.target.value;
                                            } else {
                                                delete props[field.key];
                                            }
                                            update({ ...data.settings, props });
                                        }}
                                    >
                                        <option value="">Not linked</option>
                                        {missing && (
                                            <option value={value}>
                                                Missing or incompatible property
                                            </option>
                                        )}
                                        {field.choices.map((choice) => (
                                            <option key={choice.id} value={choice.id}>
                                                {choice.label}
                                            </option>
                                        ))}
                                    </select>
                                </td>
                            </tr>
                        );
                    })}
                    {data.settings.role === 'button' && (
                        <tr>
                            <th scope="row">
                                <label htmlFor="role-target">Navigate to</label>
                            </th>
                            <td>
                                <select
                                    id="role-target"
                                    aria-label="Navigate to screen"
                                    disabled={data.disabled}
                                    value={data.settings.navigateTo ?? ''}
                                    onChange={(event) =>
                                        update({
                                            ...data.settings,
                                            navigateTo: event.target.value || undefined
                                        })
                                    }
                                >
                                    <option value="">No navigation</option>
                                    {data.settings.navigateTo &&
                                        !data.screens.some(
                                            (screen) => screen.id === data.settings.navigateTo
                                        ) && (
                                            <option value={data.settings.navigateTo}>
                                                Missing or hidden screen
                                            </option>
                                        )}
                                    {data.screens.map((screen) => (
                                        <option key={screen.id} value={screen.id}>
                                            {screen.name}
                                        </option>
                                    ))}
                                </select>
                            </td>
                        </tr>
                    )}
                    <tr>
                        <td colSpan={2}>
                            <small className={styles.frameHint}>
                                {data.settings.role === 'none'
                                    ? 'Choose a role for this component.'
                                    : 'Choose the exposed property for each role field. Test controls in Preview.'}
                                {instanceId &&
                                    !data.inherited &&
                                    ' Custom role settings; choose From source to reset.'}
                            </small>
                        </td>
                    </tr>
                    {data.problems.map((problem) => (
                        <tr key={problem}>
                            <td colSpan={2}>
                                <small className={styles.frameHint} role="status">
                                    {problem}
                                </small>
                            </td>
                        </tr>
                    ))}
                </PropertyGroup>
            </table>
        </section>
    );
};
