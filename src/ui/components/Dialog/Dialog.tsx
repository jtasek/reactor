import React, { FC, ReactNode, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from './styles.css';

export interface Props {
    title: string;
    description: string;
    visible: boolean;
    onClose: () => void;
    actions?: ReactNode;
    children?: ReactNode;
}

export const Dialog: FC<Props> = ({ title, description, visible, onClose, actions, children }) => {
    const ref = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    const descriptionId = useId();

    useEffect(() => {
        const dialog = ref.current;
        if (!dialog || !visible) return;
        const trigger = document.activeElement;
        const stopShortcuts = (event: KeyboardEvent) => event.stopPropagation();
        dialog.addEventListener('keydown', stopShortcuts);
        dialog.showModal();
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
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            onCancel={(event) => {
                event.preventDefault();
                onClose();
            }}
        >
            <h2 id={titleId}>{title}</h2>
            <p id={descriptionId}>{description}</p>
            {children}
            <div className={styles.actions}>
                {actions ?? (
                    <button type="button" onClick={onClose}>
                        Close
                    </button>
                )}
            </div>
        </dialog>,
        document.body
    );
};
