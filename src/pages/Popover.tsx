import React, { type ReactNode, useEffect, useRef, useState } from 'react';
import styles from './Prototype.css';

/** A button that opens a panel below it; Escape or a press outside closes it. */
export function Popover({
    button,
    label,
    title,
    className,
    align = 'start',
    children
}: {
    button: ReactNode;
    /** The button's accessible name; the panel is named after it. */
    label: string;
    title?: string;
    className?: string;
    align?: 'start' | 'end';
    children: (close: () => void) => ReactNode;
}) {
    const [open, setOpen] = useState(false);
    const root = useRef<HTMLSpanElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const close = () => {
        setOpen(false);
        trigger.current?.focus();
    };

    useEffect(() => {
        if (!open) {
            return;
        }
        const outside = (event: PointerEvent) => {
            if (!root.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        const escape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.stopPropagation();
                setOpen(false);
                trigger.current?.focus();
            }
        };
        document.addEventListener('pointerdown', outside);
        document.addEventListener('keydown', escape);

        return () => {
            document.removeEventListener('pointerdown', outside);
            document.removeEventListener('keydown', escape);
        };
    }, [open]);

    return (
        <span ref={root} className={styles.popoverRoot}>
            <button
                ref={trigger}
                type="button"
                className={className}
                aria-label={label}
                title={title}
                aria-haspopup="dialog"
                aria-expanded={open}
                onClick={() => setOpen(!open)}
            >
                {button}
            </button>
            {open && (
                <div className={styles.popover} data-align={align} role="dialog" aria-label={label}>
                    {children(close)}
                </div>
            )}
        </span>
    );
}
