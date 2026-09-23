import React, { FC } from 'react';
import styles from './styles.css';
import { PropertyField } from './PropertyField';
import type { PropertyRow, PropertyValue } from 'src/app/properties';

export interface Props {
    rows: PropertyRow[];
    shapeIds: string[];
    onChange: (shapeIds: string[], key: string, value: PropertyValue) => void;
}

/** The properties every selected shape shares; editing one changes all of them. */
export const PropertyPanel: FC<Props> = ({ rows, shapeIds, onChange }) => {
    if (shapeIds.length === 0) {
        return <div className={styles.propertyPanel}>No shapes selected</div>;
    }

    return (
        <table className={styles.propertyPanel}>
            <tbody>
                {rows.map((row) => (
                    <PropertyField
                        key={row.property.key}
                        row={row}
                        shapeIds={shapeIds}
                        onChange={onChange}
                    />
                ))}
            </tbody>
            <tfoot>
                <tr>
                    <td>Selected</td>
                    <td>{shapeIds.length}</td>
                </tr>
            </tfoot>
        </table>
    );
};
