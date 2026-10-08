import React, { DragEvent, FC, ReactNode, createContext, useContext, useState } from 'react';
import styles from './styles.css';
import { ItemMenu, ItemMenuAction } from '../ItemMenu';
import { useDocumentFilter } from 'src/app/hooks';

/** What is dragged in the explorer: a shape, or a group with all its shapes. */
export interface Dragged {
    kind: 'shape' | 'group';
    id: string;
}

const DRAG_TYPE = 'application/x-reactor-explorer';

/**
 * The collapsed items, kept by the whole explorer rather than each row, so an item a
 * search leaves out is still collapsed when it is listed again.
 */
export const CollapsedItems = createContext<{
    collapsed: ReadonlySet<string>;
    toggle: (collapseId: string) => void;
}>({ collapsed: new Set(), toggle: () => undefined });

function readDragged(event: DragEvent): Dragged | null {
    try {
        const { kind, id }: Partial<Dragged> = JSON.parse(event.dataTransfer.getData(DRAG_TYPE));

        return (kind === 'shape' || kind === 'group') && typeof id === 'string'
            ? { kind, id }
            : null;
    } catch {
        return null;
    }
}

interface Props {
    kind: 'layer' | 'group' | 'shape';
    name: string;
    /** What dragging the item moves; a layer is not dragged. */
    dragged?: Dragged;
    selected?: boolean;
    active?: boolean;
    /** The one layer this screen shows. */
    shown?: boolean;
    visible?: boolean;
    /** Names the item to collapse, for an item holding rows; it has no toggle without one. */
    collapseId?: string;
    /** What pressing the name does; the name is plain text without it. */
    onClick?: () => void;
    menuActions?: ItemMenuAction[];
    /** Takes a shape or group dropped on the item. */
    onDrop?: (dragged: Dragged) => void;
    children?: ReactNode;
}

/** A row of the explorer: its name, show and lock buttons, and the items under it. */
export const ExplorerItem: FC<Props> = ({
    kind,
    name,
    dragged,
    selected = false,
    active = false,
    shown = false,
    visible = true,
    collapseId,
    onClick,
    menuActions,
    onDrop,
    children
}) => {
    const [dropTarget, setDropTarget] = useState(false);
    const items = useContext(CollapsedItems);
    const collapsed = collapseId !== undefined && items.collapsed.has(collapseId);
    // A search shows everything it finds, also in collapsed items.
    const searching = useDocumentFilter().trim() !== '';
    const className = [
        kind === 'layer' && styles.layer,
        selected && styles.selected,
        active && !selected && styles.active,
        shown && styles.shown,
        !visible && styles.hidden
    ]
        .filter(Boolean)
        .join(' ');
    const acceptsDrop = (event: DragEvent) =>
        onDrop !== undefined && event.dataTransfer.types.includes(DRAG_TYPE);

    return (
        <li className={className}>
            <div
                className={[styles.row, dropTarget && styles.dropTarget].filter(Boolean).join(' ')}
                data-menu-host
                draggable={dragged !== undefined}
                onDragStart={(event) => {
                    event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(dragged));
                    event.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(event) => {
                    if (acceptsDrop(event)) {
                        event.preventDefault();
                        setDropTarget(true);
                    }
                }}
                onDragLeave={() => setDropTarget(false)}
                onDrop={(event) => {
                    const dropped = acceptsDrop(event) ? readDragged(event) : null;

                    setDropTarget(false);

                    if (dropped) {
                        event.preventDefault();
                        onDrop?.(dropped);
                    }
                }}
            >
                {dragged && (
                    // Some browsers start no drag from a press on a button, as the name is.
                    <span className={styles.grip} draggable aria-hidden="true">
                        ⠿
                    </span>
                )}
                {collapseId && !searching && (
                    <button
                        type="button"
                        className={styles.toggle}
                        aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${name}`}
                        onClick={() => items.toggle(collapseId)}
                    >
                        <span aria-hidden="true">{collapsed ? '▸' : '▾'}</span>
                    </button>
                )}
                {onClick ? (
                    <button
                        type="button"
                        className={styles.name}
                        aria-pressed={kind === 'layer' ? shown : selected}
                        onClick={onClick}
                    >
                        {name}
                    </button>
                ) : (
                    <span className={styles.label}>{name}</span>
                )}
                {menuActions && <ItemMenu itemName={name} actions={menuActions} />}
            </div>
            {children && (searching || !collapsed) && <ul>{children}</ul>}
        </li>
    );
};
