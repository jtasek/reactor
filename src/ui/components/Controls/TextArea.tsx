import React, { type ComponentProps, type FC, type ReactNode } from 'react';
import styles from './styles.css';

type Props = ComponentProps<'textarea'> & { label: ReactNode };

export const TextArea: FC<Props> = ({ label, className, ...props }) => (
    <label className={className ? `${styles.field} ${className}` : styles.field}>
        {label}
        <textarea {...props} className={`${styles.input} ${styles.multiline}`} />
    </label>
);
