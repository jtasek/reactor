import React, { FC, KeyboardEvent, useId, useState } from 'react';
import styles from './styles.css';
import { Dragged, acceptsDragged, readDragged } from './ExplorerItem';

/** Moves the keyboard through the outline's rows, across its sections, as in a Finder sidebar. */
export function handleOutlineKeys(event: KeyboardEvent<HTMLElement>) {
    const target = event.target as HTMLElement;
    const outline = event.currentTarget.closest('[data-explorer-outline]');

    if (!target.matches('[data-explorer-row]') || !outline) {
        return;
    }

    const rows = [...outline.querySelectorAll<HTMLElement>('[data-explorer-row]')];
    const at = rows.indexOf(target);
    const item = target.closest<HTMLElement>('[role="treeitem"]');
    const go = (row: HTMLElement | null | undefined) => {
        if (row) {
            event.preventDefault();
            row.focus();
            row.scrollIntoView?.({ block: 'nearest' });
            // Moving the focus selects, as in Finder.
            row.click();
        }
    };
    const toggle = () =>
        item?.querySelector<HTMLButtonElement>(':scope > div > button[data-open]')?.click();

    switch (event.key) {
        case 'ArrowDown':
            go(rows[at + 1]);
            break;
        case 'ArrowUp':
            go(rows[at - 1]);
            break;
        case 'Home':
            go(rows[0]);
            break;
        case 'End':
            go(rows.at(-1));
            break;
        case 'ArrowRight':
            if (item?.getAttribute('aria-expanded') === 'false') {
                event.preventDefault();
                toggle();
            } else if (item?.getAttribute('aria-expanded') === 'true') {
                go(item.querySelector<HTMLElement>(':scope > ul [data-explorer-row]'));
            }
            break;
        case 'ArrowLeft':
            if (item?.getAttribute('aria-expanded') === 'true') {
                event.preventDefault();
                toggle();
            } else {
                go(
                    item?.parentElement
                        ?.closest<HTMLElement>('[role="treeitem"]')
                        ?.querySelector<HTMLElement>(':scope > div [data-explorer-row]')
                );
            }
            break;
    }
}

/** A titled part of the outline: Screens, Canvas or Components. */
export const Section: FC<{
    title: string;
    onDrop?: (dragged: Dragged) => void;
    children: React.ReactNode;
}> = ({ title, onDrop, children }) => {
    const [dropTarget, setDropTarget] = useState(false);
    const id = useId();

    return (
        <section className={styles.section} aria-labelledby={id}>
            <h3
                id={id}
                className={[styles.sectionTitle, dropTarget && styles.dropTarget]
                    .filter(Boolean)
                    .join(' ')}
                onDragOver={(event) => {
                    if (onDrop && acceptsDragged(event)) {
                        event.preventDefault();
                        setDropTarget(true);
                    }
                }}
                onDragLeave={() => setDropTarget(false)}
                onDrop={(event) => {
                    const dropped = onDrop && acceptsDragged(event) ? readDragged(event) : null;

                    setDropTarget(false);
                    if (dropped) {
                        event.preventDefault();
                        onDrop?.(dropped);
                    }
                }}
            >
                {title}
            </h3>
            <ul role="tree" aria-labelledby={id} onKeyDown={handleOutlineKeys}>
                {children}
            </ul>
        </section>
    );
};
