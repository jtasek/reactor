import React, { type ComponentProps, type FC, type ReactNode } from 'react';
import styles from './styles.css';

type Props = ComponentProps<'input'> & { label: ReactNode };

export const Field: FC<Props> = ({ label, className, ...props }) => (
    <label className={className ? `${styles.field} ${className}` : styles.field}>
        {label}
        <input {...props} className={styles.input} />
    </label>
);
