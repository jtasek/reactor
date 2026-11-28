import React, { FC, ReactNode } from 'react';
import { Info } from 'lucide-react';
import { Icon } from '../Icon';
import styles from './styles.css';

interface Props {
    name: string;
    children?: ReactNode;
    help?: ReactNode;
}

/** A section of related properties (e.g. Shape or Text) under its own heading. */
export const PropertyGroup: FC<Props> = ({ name, children, help }) => (
    <tbody data-property-group={name}>
        <tr>
            <th colSpan={2} scope="colgroup">
                {name}
                {help && (
                    <details className={styles.inspectorHelp}>
                        <summary title={`About ${name.toLowerCase()}`}>
                            <Icon icon={{ component: Info, size: 16 }} />
                            <span className={styles.visuallyHidden}>
                                About {name.toLowerCase()}
                            </span>
                        </summary>
                        <p>{help}</p>
                    </details>
                )}
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
