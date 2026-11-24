import React, { type ComponentProps, type FC } from 'react';
import { X } from 'lucide-react';
import styles from './styles.css';

/** The glass-circle × that closes a panel or a dialog; `label` names what it closes. */
export const CloseButton: FC<Omit<ComponentProps<'button'>, 'children'> & { label: string }> = ({
    label,
    className,
    ...props
}) => (
    <button
        {...props}
        type="button"
        className={className ? `${styles.close} ${className}` : styles.close}
        aria-label={label}
        title={label}
    >
        <X aria-hidden="true" focusable="false" size={10} strokeWidth={2.6} />
    </button>
);
