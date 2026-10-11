import React, { ChangeEvent, FC, ReactNode, useCallback } from 'react';
import { useActions } from 'src/app/hooks';
import { useInstanceProperties } from 'src/app/componentHooks';
import { InstancePropertyField } from './InstancePropertyField';
import { Icon } from '../Icon';
import styles from './styles.css';
import type { PropertyValue } from 'src/app/types';

/** The values exposed by one source, shared across selected instances. */
export const InstanceProps: FC<{ nameField?: ReactNode }> = ({ nameField }) => {
    const data = useInstanceProperties();
    const { selectComponentSource } = useActions();

    if (!data) {
        return null;
    }

    const children = [...new Map(data.rows.map((row) => [row.shapeId, row.shapeName])).entries()];
    const changedCount = data.rows.filter((row) => row.overridden).length;

    return (
        <section className={styles.instanceProps} aria-label="Component properties">
            <div className={styles.instanceIdentity}>
                {nameField}
                <button
                    type="button"
                    className={styles.sourceLink}
                    title={`Edit ${data.componentName}`}
                    onClick={() => selectComponentSource(data.componentId)}
                >
                    Edit component ↗
                </button>
            </div>
            <div className={styles.instanceSectionHeading}>
                <h3 className={styles.heading}>Properties</h3>
                <span>{changedCount ? `${changedCount} changed` : 'All from source'}</span>
            </div>
            {data.rows.length === 0 && (
                <p>Select a source shape to make its properties editable in instances.</p>
            )}
            {children.map(([shapeId, shapeName]) => (
                <div className={styles.instanceChild} key={shapeId}>
                    <h4>{shapeName}</h4>
                    <div className={styles.instanceFields}>
                        {data.rows
                            .filter((row) => row.shapeId === shapeId)
                            .map((row) => (
                                <InstancePropertyRow
                                    key={row.prop.id}
                                    row={row}
                                    instanceIds={data.ids}
                                    variables={data.variables}
                                />
                            ))}
                    </div>
                </div>
            ))}
        </section>
    );
};

type InstanceProperties = NonNullable<ReturnType<typeof useInstanceProperties>>;

const InstancePropertyRow: FC<{
    row: InstanceProperties['rows'][number];
    instanceIds: string[];
    variables: InstanceProperties['variables'];
}> = ({ row, instanceIds, variables }) => {
    const { prop, kind, value, mixed, overridden, variableId } = row;
    const actions = useActions();
    const handleChange = useCallback(
        (next: PropertyValue) => {
            actions.setInstanceOverride({ instanceIds, propId: prop.id, value: next });
        },
        [actions, instanceIds, prop.id]
    );
    const handleBind = (event: ChangeEvent<HTMLSelectElement>) => {
        actions.bindInstanceOverride({
            instanceIds,
            propId: prop.id,
            variableId: event.target.value
        });
    };
    const handleReset = () => actions.resetInstanceOverrides({ instanceIds, propId: prop.id });

    return (
        <div className={styles.instanceRow}>
            <div className={styles.instanceValue}>
                <label htmlFor={`component-prop-${prop.id}`}>{row.fieldLabel}</label>
                <InstancePropertyField
                    id={`component-prop-${prop.id}`}
                    label={prop.label}
                    kind={kind}
                    value={value}
                    mixed={mixed}
                    onChange={handleChange}
                />
                <details className={styles.instanceOptions}>
                    <summary aria-label={`${prop.label} options`}>⋯</summary>
                    <select
                        aria-label={`Variable for ${prop.label}`}
                        value={variableId}
                        onChange={handleBind}
                    >
                        <option value="">Variable</option>
                        {variables
                            .filter((variable) => variable.type === kind)
                            .map((variable) => (
                                <option key={variable.id} value={variable.id}>
                                    {variable.name}
                                </option>
                            ))}
                    </select>
                </details>
            </div>
            <div className={styles.instanceStatus}>
                <span>{overridden ? 'Changed' : 'From source'}</span>
                {overridden && (
                    <button
                        type="button"
                        className={styles.instanceReset}
                        title={`Reset ${prop.label} to source value`}
                        aria-label={`Reset ${prop.label} to source value`}
                        onClick={handleReset}
                    >
                        <Icon icon={{ group: 'action', name: 'restore', size: 14 }} />
                        Reset
                    </button>
                )}
            </div>
        </div>
    );
};
