import React, { ChangeEvent, FC, useCallback } from 'react';
import { useActions } from 'src/app/hooks';
import { useInstanceProperties } from 'src/app/componentHooks';
import { InstancePropertyField } from './InstancePropertyField';
import type { PropertyValue } from 'src/app/types';

/** The values exposed by one source, shared across selected instances. */
export const InstanceProps: FC = () => {
    const data = useInstanceProperties();

    if (!data || data.rows.length === 0) {
        return null;
    }

    return (
        <section aria-label="Component properties">
            <h3>Component</h3>
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
        <div>
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
            <button type="button" disabled={!overridden} onClick={handleReset}>
                Reset
            </button>
        </div>
    );
};
