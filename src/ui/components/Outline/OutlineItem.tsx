import React, { DragEvent, FC, ReactNode, useState } from 'react';
import styles from './styles.css';
import { Icon } from '../Icon';

const icon = (name: string) => ({ group: 'action', name, color: 'rgba(255,255,255)', size: 16 });
const visibleIcon = icon('visibility');
const hiddenIcon = icon('visibility_off');
const lockedIcon = icon('lock_outline');
const openIcon = icon('lock_open');

/** What is dragged in the outline: a shape, or a group with all its shapes. */
export interface Dragged {
    kind: 'shape' | 'group';
    id: string;
}

const DRAG_TYPE = 'application/x-reactor-outline';

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
    locked?: boolean;
    visible?: boolean;
    /** What pressing the name does; the name is plain text without it. */
    onClick?: () => void;
    onToggleLocked?: () => void;
    onToggleVisible?: () => void;
    /** Takes a shape or group dropped on the item. */
    onDrop?: (dragged: Dragged) => void;
    children?: ReactNode;
}

/** A row of the outline: its name, show and lock buttons, and the items under it. */
export const OutlineItem: FC<Props> = ({
    kind,
    name,
    dragged,
    selected = false,
    active = false,
    shown = false,
    locked = false,
    visible = true,
    onClick,
    onToggleLocked,
    onToggleVisible,
    onDrop,
    children
}) => {
    const [dropTarget, setDropTarget] = useState(false);
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
                <span className={styles.icons}>
                    {onToggleVisible && (
                        <button
                            type="button"
                            className={styles.icon}
                            title={visible ? 'Hide' : 'Show'}
                            onClick={onToggleVisible}
                        >
                            <Icon icon={visible ? visibleIcon : hiddenIcon} />
                        </button>
                    )}
                    {onToggleLocked && (
                        <button
                            type="button"
                            className={styles.icon}
                            title={locked ? 'Unlock' : 'Lock'}
                            onClick={onToggleLocked}
                        >
                            <Icon icon={locked ? lockedIcon : openIcon} />
                        </button>
                    )}
                </span>
            </div>
            {children && <ul>{children}</ul>}
        </li>
    );
};
