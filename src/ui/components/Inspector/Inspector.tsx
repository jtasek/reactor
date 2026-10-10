import React, { FC } from 'react';
import styles from './styles.css';
import { PropertyField } from './PropertyField';
import { PropertyGroup } from './PropertyGroup';
import { AlignSection } from './AlignSection';
import { InstanceProps } from './InstanceProps';
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
    if (shapeIds.length === 0) {
        return <div className={styles.inspector}>No shapes selected</div>;
    }

    return (
        <div className={styles.inspector}>
            <AlignSection />
            <table>
                {groupRows(rows).map(({ group, rows: grouped }) => (
                    <PropertyGroup key={group} name={group}>
                        {grouped.map((row) => (
                            <PropertyField
                                key={row.property.key}
                                row={row}
                                shapeIds={shapeIds}
                                onChange={onChange}
                                variables={variables.filter(
                                    (variable) => variable.type === row.property.kind
                                )}
                                variable={bound[row.property.key]}
                                note={notes[row.property.key]}
                                onBind={onBind}
                                onUnbind={onUnbind}
                            />
                        ))}
                    </PropertyGroup>
                ))}
                <tfoot>
                    <tr>
                        <td>Selected</td>
                        <td>{shapeIds.length}</td>
                    </tr>
                </tfoot>
            </table>
            <InstanceProps />
        </div>
    );
};
