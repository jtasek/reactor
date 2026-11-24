import React, { type ComponentProps, type FC, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import styles from './styles.css';

type Props = ComponentProps<'select'> & { label?: ReactNode };

/** A native select drawn as a field; without `label`, name it with `aria-label`. */
export const Select: FC<Props> = ({ label, className, ...props }) => {
    const select = (
        <span className={styles.select}>
            <select {...props} className={styles.input} />
            <ChevronDown size={14} strokeWidth={1.5} aria-hidden="true" />
        </span>
    );

    return label === undefined ? (
        select
    ) : (
        <label className={className ? `${styles.field} ${className}` : styles.field}>
            {label}
            {select}
        </label>
    );
};
