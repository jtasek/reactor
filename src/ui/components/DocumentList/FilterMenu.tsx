import React, { KeyboardEvent, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import menuStyles from '../ContextMenu/styles.css';
import styles from './filters.css';
import tagStyles from './tags.css';
import { useAnchoredPopup } from './useAnchoredPopup';

interface Props {
    anchor: HTMLButtonElement;
    title: string;
    options: { value: string; label: string; tone?: string }[];
    selected: string[];
    multiple?: boolean;
    onSelect: (value: string) => void;
    onClose: () => void;
}

export function FilterMenu({
    anchor,
    title,
    options,
    selected,
    multiple,
    onSelect,
    onClose
}: Props) {
    const menu = useRef<HTMLDivElement>(null);

    useAnchoredPopup(menu, anchor, onClose);

    const navigate = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Tab') {
            anchor.focus();
            onClose();
            return;
        }
        const buttons = Array.from(
            event.currentTarget.querySelectorAll<HTMLButtonElement>('button')
        );
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const destinations: Record<string, number> = {
            ArrowDown: (index + 1) % buttons.length,
            ArrowUp: (index - 1 + buttons.length) % buttons.length,
            Home: 0,
            End: buttons.length - 1
        };
        if (event.key in destinations) {
            event.preventDefault();
            buttons[destinations[event.key]]?.focus();
        }
    };
    const choose = (value: string) => {
        onSelect(value);
        if (!multiple) {
            anchor.focus();
            onClose();
        }
    };

    return createPortal(
        <div
            ref={menu}
            className={`${menuStyles.contextMenu} ${tagStyles.editor} ${styles.filterMenu}`}
            role="menu"
            tabIndex={-1}
            aria-label={title}
            onKeyDown={navigate}
        >
            <div className={`${menuStyles.header} ${tagStyles.heading}`}>{title}</div>
            {options.map(({ value, label, tone }) => (
                <button
                    key={value}
                    type="button"
                    role={multiple ? 'menuitemcheckbox' : 'menuitemradio'}
                    aria-checked={selected.some(
                        (item) => item.toLowerCase() === value.toLowerCase()
                    )}
                    className={`${menuStyles.row} ${tagStyles.option}`}
                    onClick={() => choose(value)}
                >
                    <span className={tone ? tagStyles.pill : menuStyles.rowLabel} data-tone={tone}>
                        {label}
                    </span>
                    <span className={tagStyles.check}>
                        {selected.some((item) => item.toLowerCase() === value.toLowerCase()) && (
                            <Check size={16} strokeWidth={1.5} aria-hidden="true" />
                        )}
                    </span>
                </button>
            ))}
            {options.length === 0 && <div className={menuStyles.header}>No tags yet</div>}
        </div>,
        document.body
    );
}
