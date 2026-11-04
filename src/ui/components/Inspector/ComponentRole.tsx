import { DataList } from './DataList';
import React, { useEffect, useState, type FC } from 'react';
import type { ComponentRole as ComponentRoleName, RoleSettings } from 'src/app/types';
import { roleLinks } from 'src/app/componentRoles';
import { useActions } from 'src/app/hooks';
import { useRoleEditor } from 'src/app/roleHooks';
import { ComponentInteractions } from './ComponentInteractions';
import { PropertyGroup } from './PropertyGroup';
import styles from './styles.css';

const ROLES = ['none', 'text', 'input', 'button', 'list', 'image'] as const;

/** Saves the identity once, on Enter or leaving the field, so it can hold spaces. */
const InputIdentity: FC<{
    value: string | undefined;
    disabled: boolean;
    onCommit: (controlId: string | undefined) => void;
}> = ({ value, disabled, onCommit }) => {
    const [draft, setDraft] = useState(value ?? '');
    useEffect(() => setDraft(value ?? ''), [value]);

    return (
        <input
            id="input-identity"
            type="text"
            aria-label="Input identity"
            disabled={disabled}
            value={draft}
            placeholder="e.g. contact-email"
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => {
                const controlId = draft.trim() || undefined;
                setDraft(controlId ?? '');
                if (controlId !== value) {
                    onCommit(controlId);
                }
            }}
            onKeyDown={(event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    event.currentTarget.blur();
                }
            }}
        />
    );
};

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
        <>
            {instanceId && <DataList key={instanceId} instanceId={instanceId} />}
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
                                        if (
                                            role === 'inherit' ||
                                            (role === 'none' && !instanceId)
                                        ) {
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
                                        <option value="inherit">
                                            From source ({data.sourceRole})
                                        </option>
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
                        {instanceId && data.settings.role === 'input' && (
                            <tr>
                                <th scope="row">
                                    <label htmlFor="input-identity">Input identity</label>
                                </th>
                                <td>
                                    <InputIdentity
                                        value={data.settings.controlId}
                                        disabled={data.disabled}
                                        onCommit={(controlId) =>
                                            update({ ...data.settings, controlId })
                                        }
                                    />
                                </td>
                            </tr>
                        )}
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
            <ComponentInteractions componentId={componentId} instanceId={instanceId} />
            <details className={styles.inspectorHelp}>
                <summary>About prototype behavior</summary>
                <p>
                    Roles connect exposed properties to controls. Actions run in Preview and
                    Prototype; canvas clicks select and edit.
                </p>
                {data.settings.role === 'input' && (
                    <p>
                        Input actions run on Enter. Use the same input identity and Value property
                        across layouts to keep typed input. Each identity must be unique within a
                        screen layout.
                    </p>
                )}
                {instanceId && (
                    <p>
                        From source follows the component. Choose it again to restore inheritance.
                    </p>
                )}
            </details>
        </>
    );
};
