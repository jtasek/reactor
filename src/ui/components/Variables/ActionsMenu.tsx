import React, {
    Children,
    cloneElement,
    isValidElement,
    useEffect,
    useId,
    useRef,
    useState,
    type ButtonHTMLAttributes,
    type ReactNode
} from 'react';
import { Ellipsis } from 'lucide-react';
import { Icon } from '../Icon';
import styles from './styles.css';

const MENU_GAP = 8;

/** Shared, light-dismiss actions that leave the editor's fields in place. */
export function ActionsMenu({ label, children }: { label: string; children: ReactNode }) {
    const id = useId();
    const trigger = useRef<HTMLButtonElement>(null);
    const menu = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    useEffect(() => {
        if (!open) {
            return;
        }
        const dismissOnResize = () => {
            menu.current?.hidePopover();
        };
        // The menu is placed once, so it would drift away from its row as the panel scrolls.
        const dismissOnScroll = (event: Event) => {
            if (!(event.target instanceof Node && menu.current?.contains(event.target))) {
                menu.current?.hidePopover();
            }
        };
        window.addEventListener('resize', dismissOnResize);
        window.addEventListener('scroll', dismissOnScroll, true);

        return () => {
            window.removeEventListener('resize', dismissOnResize);
            window.removeEventListener('scroll', dismissOnScroll, true);
        };
    }, [open]);
    const close = () => {
        menu.current?.hidePopover();
        trigger.current?.focus();
    };
    const dismiss = (event: React.KeyboardEvent<HTMLButtonElement>) => {
        if (event.key !== 'Escape' || !menu.current?.matches(':popover-open')) {
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        close();
    };

    return (
        <>
            <button
                ref={trigger}
                type="button"
                className={styles.iconButton}
                aria-label={label}
                title={label}
                aria-expanded={open}
                aria-controls={id}
                popoverTarget={id}
                onKeyDown={dismiss}
                onClick={() => {
                    const bounds = trigger.current?.getBoundingClientRect();
                    if (!menu.current || !bounds) {
                        return;
                    }
                    const width = Number.parseFloat(getComputedStyle(menu.current).width);
                    menu.current.style.left = `${Math.max(MENU_GAP, Math.min(bounds.right - width, window.innerWidth - width - MENU_GAP))}px`;
                    menu.current.style.top = `${bounds.bottom + MENU_GAP}px`;
                }}
            >
                <Icon icon={{ component: Ellipsis, size: 16 }} />
            </button>
            <div
                ref={menu}
                id={id}
                popover="auto"
                className={styles.actionMenu}
                role="group"
                aria-label={`${label} menu`}
                onToggle={(event) => {
                    setOpen(event.newState === 'open');
                    if (event.newState !== 'open' || !menu.current || !trigger.current) {
                        return;
                    }
                    const bounds = menu.current.getBoundingClientRect();
                    if (bounds.bottom > window.innerHeight - MENU_GAP) {
                        menu.current.style.top = `${Math.max(MENU_GAP, trigger.current.getBoundingClientRect().top - bounds.height - MENU_GAP)}px`;
                    }
                    menu.current.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
                }}
            >
                {Children.map(children, (child) => {
                    if (
                        !isValidElement<ButtonHTMLAttributes<HTMLButtonElement>>(child) ||
                        child.type !== 'button'
                    ) {
                        return child;
                    }

                    return cloneElement(child, {
                        onClick: (event) => {
                            // Close before a command can disable or remove its own button.
                            close();
                            child.props.onClick?.(event);
                        },
                        onKeyDown: (event) => {
                            dismiss(event);
                            if (!event.defaultPrevented) {
                                child.props.onKeyDown?.(event);
                            }
                        }
                    });
                })}
            </div>
        </>
    );
}
