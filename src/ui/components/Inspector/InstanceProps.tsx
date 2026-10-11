import React, { ChangeEvent, FC, useCallback } from 'react';
import { useActions } from 'src/app/hooks';
import { useInstanceProperties } from 'src/app/componentHooks';
import { InstancePropertyField } from './InstancePropertyField';
import { Icon } from '../Icon';
import styles from './styles.css';
import type { PropertyValue } from 'src/app/types';

/** The values exposed by one source, shared across selected instances. */
export const InstanceProps: FC = () => {
    const data = useInstanceProperties();
    const { selectComponentSource } = useActions();

    if (!data) {
        return null;
    }

    return (
        <section className={styles.instanceProps} aria-label="Component properties">
            <strong>Instance of {data.componentName}</strong>
            <p>Changes here affect only the selected instance.</p>
            <button
                type="button"
                className={styles.sourceLink}
                onClick={() => selectComponentSource(data.componentId)}
            >
                <Icon icon={{ group: 'action', name: 'find_in_page', size: 16 }} />
                Go to source
            </button>
            <h3 className={styles.heading}>Editable properties</h3>
            {data.rows.length === 0 && (
                <p>Select a source shape to make its properties editable in instances.</p>
            )}
            {data.rows.map((row) => (
                <InstancePropertyRow
                    key={row.prop.id}
                    row={row}
                    instanceIds={data.ids}
                    variables={data.variables}
                />
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
            <label htmlFor={`component-prop-${prop.id}`}>{prop.label}</label>
            <InstancePropertyField
                id={`component-prop-${prop.id}`}
                kind={kind}
                value={value}
                mixed={mixed}
                onChange={handleChange}
            />
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
            <button
                type="button"
                className={styles.iconButton}
                title={`Reset ${prop.label} to source value`}
                aria-label={`Reset ${prop.label} to source value`}
                disabled={!overridden}
                onClick={handleReset}
            >
                <Icon icon={{ group: 'action', name: 'restore', size: 16 }} />
            </button>
        </div>
    );
};
