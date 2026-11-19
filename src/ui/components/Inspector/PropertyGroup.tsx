import React, { FC, ReactNode } from 'react';
import styles from './styles.css';

interface Props {
    name: string;
    children?: ReactNode;
}

/** A section of related properties (e.g. Shape or Text) under its own heading. */
export const PropertyGroup: FC<Props> = ({ name, children }) => (
    <tbody data-property-group={name}>
        <tr>
            <th colSpan={2} scope="colgroup">
                {name}
            </th>
        </tr>
        {children}
    </tbody>
);

/** Property sections share one label column, so every label and value lines up. */
export const InspectorTable: FC<{ children?: ReactNode }> = ({ children }) => (
    <table>
        <colgroup>
            <col className={styles.labelColumn} />
            <col />
        </colgroup>
        {children}
    </table>
);
