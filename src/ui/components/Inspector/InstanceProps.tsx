import React, { ChangeEvent, FC, useCallback } from 'react';
import { RotateCcw } from 'lucide-react';
import { useActions } from 'src/app/hooks';
import { useInstanceProperties } from 'src/app/componentHooks';
import { InstancePropertyField } from './InstancePropertyField';
import { Icon } from '../Icon';
import styles from './styles.css';
import type { PropertyValue } from 'src/app/types';

/** The values exposed by one source, shared across selected instances. */
export const InstanceProps: FC = () => {
    const data = useInstanceProperties();
    const { setInstanceVariant, discardRetainedOverrides } = useActions();

    if (!data) {
        return null;
    }

    const children = [...new Map(data.rows.map((row) => [row.shapeId, row.shapeName])).entries()];
    const changedCount = data.rows.filter((row) => row.overridden).length;

    return (
        <section className={styles.instanceProps} aria-label="Component properties">
            {(data.variants.length > 1 || data.variantProblems.length > 0) && (
                <div className={styles.instanceChild}>
                    <h4>Variant</h4>
                    <div className={styles.instanceFields}>
                        <div className={styles.instanceRow}>
                            <div className={styles.instanceValue}>
                                <label htmlFor="component-variant">Source</label>
                                <select
                                    id="component-variant"
                                    aria-label="Component variant"
                                    value={data.selectedVariantId}
                                    onChange={(event) =>
                                        setInstanceVariant({
                                            instanceIds: data.ids,
                                            variantId:
                                                event.target.value === data.variants[0].id
                                                    ? undefined
                                                    : event.target.value
                                        })
                                    }
                                >
                                    {data.selectedVariantId === '' && (
                                        <option value="">Mixed</option>
                                    )}
                                    {data.selectedVariantId !== '' &&
                                        !data.variants.some(
                                            (variant) => variant.id === data.selectedVariantId
                                        ) && (
                                            <option value={data.selectedVariantId} disabled>
                                                Unavailable variant — showing default
                                            </option>
                                        )}
                                    {data.variants.map((variant) => (
                                        <option key={variant.id} value={variant.id}>
                                            {variant.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                    {data.variantProblems.map((problem) => (
                        <p key={problem} role="status" className={styles.componentHint}>
                            {problem}
                        </p>
                    ))}
                </div>
            )}
            <div className={styles.instanceSectionHeading}>
                <h3 className={styles.heading}>Properties</h3>
                <span>{changedCount ? `${changedCount} changed` : 'All from source'}</span>
            </div>
            {data.propertyProblems.map((problem) => (
                <p key={problem} role="status" className={styles.componentHint}>
                    {problem}
                </p>
            ))}
            {data.hasRetainedValues && (
                <div className={styles.variantActions}>
                    <button
                        type="button"
                        onClick={() => discardRetainedOverrides({ instanceIds: data.ids })}
                    >
                        Discard kept values
                    </button>
                </div>
            )}
            {data.rows.length === 0 && (
                <p className={styles.instanceEmpty}>
                    No editable properties yet. Edit the component and select a shape to expose its
                    fields.
                </p>
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
                                <option
                                    key={variable.id}
                                    value={variable.id}
                                    disabled={variable.modesUnavailable}
                                >
                                    {variable.name}
                                    {variable.modesUnavailable
                                        ? ' — modes unavailable for component sizes'
                                        : ''}
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
                        <Icon icon={{ component: RotateCcw, size: 14 }} />
                        Reset
                    </button>
                )}
            </div>
        </div>
    );
};
