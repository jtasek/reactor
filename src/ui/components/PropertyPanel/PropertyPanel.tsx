import React, { FC } from 'react';
import styles from './styles.css';
import { PropertyField } from './PropertyField';
import { PropertyValue, sharedProperties } from 'src/app/properties';
import { Shape } from 'src/app/types';

export interface Props {
    shapes: Shape[];
    onChange: (key: string, value: PropertyValue) => void;
}

/** The properties every selected shape shares; editing one changes all of them. */
export const PropertyPanel: FC<Props> = ({ shapes, onChange }) => {
    if (shapes.length === 0) {
        return <div className={styles.propertyPanel}>No shapes selected</div>;
    }

    return (
        <table className={styles.propertyPanel}>
            <tbody>
                {sharedProperties(shapes).map((row) => (
                    <PropertyField key={row.property.key} row={row} onChange={onChange} />
                ))}
            </tbody>
            <tfoot>
                <tr>
                    <td>Selected</td>
                    <td>{shapes.length}</td>
                </tr>
            </tfoot>
        </table>
    );
};
