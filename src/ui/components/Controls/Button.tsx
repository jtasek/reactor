import React, { type ComponentProps, type FC } from 'react';
import styles from './styles.css';

export type ButtonKind = 'primary' | 'secondary' | 'quiet' | 'destructive';

type Props = ComponentProps<'button'> & { kind?: ButtonKind };

export const Button: FC<Props> = ({ kind = 'secondary', className, type = 'button', ...props }) => (
    <button
        {...props}
        type={type}
        className={className ? `${styles.button} ${className}` : styles.button}
        data-kind={kind}
    />
);
