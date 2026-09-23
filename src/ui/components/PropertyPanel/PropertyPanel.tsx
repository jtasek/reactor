import React, { FC } from 'react';
import styles from './styles.css';
import { PropertyField } from './PropertyField';
import { PropertyGroup } from './PropertyGroup';
import { groupRows, type PropertyRow, type PropertyValue } from 'src/app/properties';

export interface Props {
    rows: PropertyRow[];
    shapeIds: string[];
    onChange: (shapeIds: string[], key: string, value: PropertyValue) => void;
}

/**
 * The properties every selected shape shares, in sections; editing one changes
 * all of them.
 */
export const PropertyPanel: FC<Props> = ({ rows, shapeIds, onChange }) => {
    if (shapeIds.length === 0) {
        return <div className={styles.propertyPanel}>No shapes selected</div>;
    }

    return (
        <table className={styles.propertyPanel}>
            {groupRows(rows).map(({ group, rows: grouped }) => (
                <PropertyGroup key={group} name={group}>
                    {grouped.map((row) => (
                        <PropertyField
                            key={row.property.key}
                            row={row}
                            shapeIds={shapeIds}
                            onChange={onChange}
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
    );
};
