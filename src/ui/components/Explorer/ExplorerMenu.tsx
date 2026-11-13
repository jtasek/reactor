import React, { FC, KeyboardEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Icon as IconType, Point } from 'src/app/types';
import { Icon } from '../Icon';
import styles from '../ContextMenu/styles.css';
import explorerStyles from './styles.css';

export type ExplorerMenuItem =
    | {
          id: string;
          label: string;
          icon?: IconType;
          /** A choice in a list: shown with a check while chosen. */
          checked?: boolean;
          disabled?: boolean;
          danger?: boolean;
          /** Quiet text at the trailing edge, such as the current choice. */
          detail?: string;
          /** Leads to more of the same menu, so running it leaves the menu open. */
          keepOpen?: boolean;
          onRun: () => void;
      }
    | { heading: string }
    | 'separator';

interface Props {
    label: string;
    position: Point;
    items: ExplorerMenuItem[];
    /** The button that opens and closes the menu: a press on it is left to the button. */
    anchor?: Element | null;
    /** On narrow windows: a sheet along the bottom edge instead of a menu at a point. */
    sheet?: boolean;
    onClose: () => void;
}

const MARGIN = 8;

/**
 * A menu of the Explorer, in the canvas menu's glass: from a row's right-click or the
 * filter button. It goes on the page itself, as the panel's glass would clip it.
 * Escape and Tab close it and give focus back to what opened it.
 */
export const ExplorerMenu: FC<Props> = ({ label, position, items, anchor, sheet, onClose }) => {
    const menu = useRef<HTMLDivElement>(null);
    const opener = useRef(document.activeElement);
    const [placement, setPlacement] = useState(position);

    useLayoutEffect(() => {
        const width = menu.current?.offsetWidth ?? 0;
        const height = menu.current?.offsetHeight ?? 0;

        setPlacement({
            x: Math.max(MARGIN, Math.min(position.x, window.innerWidth - width - MARGIN)),
            y: Math.max(MARGIN, Math.min(position.y, window.innerHeight - height - MARGIN))
        });
        // The menu itself takes the focus when nothing in it can run, so Escape still closes it.
        (
            menu.current?.querySelector<HTMLButtonElement>('button:not(:disabled)') ?? menu.current
        )?.focus();
    }, [position]);

    useEffect(() => {
        const handlePointerDown = (event: PointerEvent) => {
            if (
                event.target instanceof Node &&
                (menu.current?.contains(event.target) || anchor?.contains(event.target))
            ) {
                return;
            }
            onClose();
        };

        document.addEventListener('pointerdown', handlePointerDown, true);

        return () => document.removeEventListener('pointerdown', handlePointerDown, true);
    }, [anchor, onClose]);

    const close = () => {
        onClose();
        if (opener.current instanceof HTMLElement) {
            opener.current.focus({ preventScroll: true });
        }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
        event.stopPropagation();
        if (event.key === 'Escape' || event.key === 'Tab') {
            event.preventDefault();
            close();
            return;
        }
        const buttons = [
            ...(menu.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])
        ];
        const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];

        if (step !== undefined) {
            event.preventDefault();
            buttons[(at + step + buttons.length) % buttons.length]?.focus();
        } else if (event.key === 'Home' || event.key === 'End') {
            event.preventDefault();
            buttons.at(event.key === 'Home' ? 0 : -1)?.focus();
        }
    };

    return createPortal(
        <div
            ref={menu}
            role="menu"
            aria-label={label}
            tabIndex={-1}
            className={`${styles.contextMenu}${sheet ? ` ${explorerStyles.menuSheet}` : ''}`}
            style={sheet ? undefined : { left: placement.x, top: placement.y }}
            onKeyDown={handleKeyDown}
            onContextMenu={(event) => event.preventDefault()}
        >
            {items.map((item, index) => {
                if (item === 'separator') {
                    return <div key={index} className={styles.divider} role="separator" />;
                }
                if ('heading' in item) {
                    return (
                        <div key={index} className={styles.header} role="presentation">
                            <span>{item.heading}</span>
                        </div>
                    );
                }

                return (
                    <button
                        key={item.id}
                        type="button"
                        role={item.checked === undefined ? 'menuitem' : 'menuitemradio'}
                        aria-checked={item.checked}
                        className={`${styles.row}${item.danger ? ` ${styles.danger}` : ''}`}
                        disabled={item.disabled}
                        onClick={() => {
                            if (!item.keepOpen) {
                                close();
                            }
                            item.onRun();
                        }}
                    >
                        {item.icon ? (
                            <Icon icon={{ ...item.icon, color: undefined, size: 16 }} />
                        ) : (
                            <span className={explorerStyles.menuIconSpace} aria-hidden="true" />
                        )}
                        <span className={styles.rowLabel}>{item.label}</span>
                        {item.detail && (
                            <span className={explorerStyles.menuDetail}>{item.detail}</span>
                        )}
                        {item.checked && (
                            <span className={styles.trailing} aria-hidden="true">
                                ✓
                            </span>
                        )}
                    </button>
                );
            })}
        </div>,
        document.body
    );
};
