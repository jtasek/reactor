import React, { FC } from 'react';
import styles from './styles.css';
import { PropertyField } from './PropertyField';
import { PropertyGroup } from './PropertyGroup';
import { AlignSection } from './AlignSection';
import { InstanceProps } from './InstanceProps';
import { ComponentDetails, SourceChildHeading } from './ComponentDetails';
import { useComponentExposure, useSelectedComponentContext } from 'src/app/componentHooks';
import { useActions } from 'src/app/hooks';
import { groupRows, type PropertyRow, type PropertyValue } from 'src/app/properties';
import type { Variable } from 'src/app/types';

export interface Props {
    rows: PropertyRow[];
    shapeIds: string[];
    onChange: (shapeIds: string[], key: string, value: PropertyValue) => void;
    variables: Variable[];
    /** The variable every shape follows for a property, by its key. */
    bound: Record<string, Variable>;
    /** What a field's value cannot show, by property key. */
    notes: Record<string, string>;
    onBind: (shapeIds: string[], key: string, variableId: string) => void;
    onUnbind: (shapeIds: string[], key: string) => void;
}

/**
 * The properties every selected shape shares, in sections; editing one changes
 * all of them.
 */
export const Inspector: FC<Props> = ({
    rows,
    shapeIds,
    onChange,
    variables,
    bound,
    notes,
    onBind,
    onUnbind
}) => {
    const componentContext = useSelectedComponentContext();
    const exposure = useComponentExposure(
        componentContext?.kind === 'child' ? componentContext.componentId : null,
        componentContext?.kind === 'child' ? componentContext.shapeId : null
    );
    const { exposeComponentProp, removeComponentProp } = useActions();
    const propertyField = (row: PropertyRow) => (
        <PropertyField
            key={row.property.key}
            row={row}
            shapeIds={shapeIds}
            onChange={onChange}
            variables={variables.filter((variable) => variable.type === row.property.kind)}
            variable={bound[row.property.key]}
            note={notes[row.property.key]}
            onBind={onBind}
            onUnbind={onUnbind}
            exposure={exposureFor(row.property.key)}
        />
    );
    const exposureFor = (key: string) => {
        if (!exposure || componentContext?.kind !== 'child') {
            return undefined;
        }
        const candidate = exposure.candidates.find((item) => item.key === key);

        if (!candidate) {
            return undefined;
        }
        const prop = exposure.props.find(
            (item) => item.shapeId === componentContext.shapeId && item.key === candidate.key
        );

        return {
            active: Boolean(prop),
            disabled: exposure.disabled,
            onToggle: () => {
                if (prop) {
                    removeComponentProp({
                        componentId: componentContext.componentId,
                        propId: prop.id
                    });

                    return;
                }
                exposeComponentProp({
                    componentId: componentContext.componentId,
                    shapeId: componentContext.shapeId,
                    key: candidate.key,
                    label: candidate.label
                });
            }
        };
    };

    if (componentContext?.kind === 'source') {
        return (
            <div className={styles.inspector}>
                <ComponentDetails
                    key={componentContext.componentId}
                    componentId={componentContext.componentId}
                />
            </div>
        );
    }

    if (shapeIds.length === 0) {
        return <div className={styles.inspector}>No shapes selected</div>;
    }

    const instance = componentContext?.kind === 'instance';
    const nameRow = instance ? rows.find((row) => row.property.key === 'name') : undefined;
    const shownRows = instance ? rows.filter((row) => row.property.key !== 'name') : rows;

    return (
        <div className={`${styles.inspector} ${instance ? styles.instanceInspector : ''}`}>
            {componentContext?.kind === 'child' && (
                <SourceChildHeading
                    componentId={componentContext.componentId}
                    shapeId={componentContext.shapeId}
                />
            )}
            {instance && (
                <InstanceProps
                    nameField={
                        nameRow && (
                            <table className={styles.instanceName}>
                                <tbody>{propertyField(nameRow)}</tbody>
                            </table>
                        )
                    }
                />
            )}
            <AlignSection />
            <table>
                {groupRows(shownRows).map(({ group, rows: grouped }) => (
                    <PropertyGroup
                        key={group}
                        name={instance && group === 'Shape' ? 'Layout' : group}
                    >
                        {grouped.map(propertyField)}
                    </PropertyGroup>
                ))}
                <tfoot>
                    <tr>
                        <td>Selected</td>
                        <td>{shapeIds.length}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
};
