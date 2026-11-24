import React, { FC, ReactNode, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CloseButton } from '../Controls';
import styles from './styles.css';

const FOCUSABLE = 'button:enabled, input:enabled, select:enabled, textarea:enabled, a[href]';

export interface Props {
    title: string;
    description?: string;
    visible: boolean;
    /** Left out for a dialog that must be answered with one of its actions. */
    onClose?: () => void;
    actions?: ReactNode;
    children?: ReactNode;
    /** Wide, for a dialog that shows a list beside a preview. */
    wide?: boolean;
}

export const Dialog: FC<Props> = ({
    title,
    description,
    visible,
    onClose,
    actions,
    children,
    wide = false
}) => {
    const ref = useRef<HTMLDialogElement>(null);
    const close = useRef<HTMLButtonElement>(null);
    const titleId = useId();
    const descriptionId = useId();

    useEffect(() => {
        const dialog = ref.current;
        if (!dialog || !visible) return;
        const trigger = document.activeElement;
        const stopShortcuts = (event: KeyboardEvent) => event.stopPropagation();
        dialog.addEventListener('keydown', stopShortcuts);
        dialog.showModal();
        // Opening lands on the first answer or field rather than on the ×.
        if (document.activeElement === close.current) {
            [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)]
                .find((element) => element !== close.current)
                ?.focus();
        }
        return () => {
            dialog.close();
            dialog.removeEventListener('keydown', stopShortcuts);
            if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
        };
    }, [visible]);

    if (!visible) return null;

    return createPortal(
        <dialog
            ref={ref}
            className={styles.dialog}
            data-wide={wide || undefined}
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            onCancel={(event) => {
                event.preventDefault();
                onClose?.();
            }}
        >
            <header className={styles.header}>
                <h2 id={titleId}>{title}</h2>
                {onClose && <CloseButton ref={close} label="Close" onClick={onClose} />}
            </header>
            {description && <p id={descriptionId}>{description}</p>}
            {children}
            {actions && <div className={styles.actions}>{actions}</div>}
        </dialog>,
        document.body
    );
};
