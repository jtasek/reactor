import React, { FC } from 'react';
import styles from './styles.css';
import { DocumentInfoField } from './DocumentInfoField';

export interface Props {
    fields: { name: string; value: string | undefined }[];
}

export const DocumentInfo: FC<Props> = ({ fields }) => (
    <table className={styles.documentInfo}>
        <tbody>
            {fields.map(({ name, value }) => (
                <DocumentInfoField key={name} name={name} value={value} />
            ))}
        </tbody>
    </table>
);
