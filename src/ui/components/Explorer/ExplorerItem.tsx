import React, {
    DragEvent,
    FC,
    KeyboardEvent,
    MouseEvent,
    MouseEventHandler,
    PointerEventHandler,
    ReactNode,
    Ref,
    createContext,
    useContext,
    useEffect,
    useId,
    useRef,
    useState
} from 'react';
import { ChevronRight, Pencil } from 'lucide-react';
import styles from './styles.css';
import type { ItemMenuAction } from '../ItemMenu';
import { Icon } from '../Icon';
import { ExplorerMenu, type ExplorerMenuItem } from './ExplorerMenu';
import { useDocumentFilter } from 'src/app/hooks';
import type { Point } from 'src/app/types';

/** What is dragged in the explorer: a shape, or a group with all its shapes. */
export interface Dragged {
    kind: 'shape' | 'group';
    id: string;
}

const DRAG_TYPE = 'application/x-reactor-explorer';
/** How long an Option-click keeps opening the rows that appear under it. */
const CASCADE_MS = 600;
const CHEVRON = { component: ChevronRight, size: 12 };

/**
 * Which rows are open, kept by the whole explorer rather than each row, so a row a
 * search leaves out is still closed when it is listed again.
 */
export const OpenItems = createContext<{
    isOpen: (key: string, fallback: boolean) => boolean;
    setOpen: (entries: Record<string, boolean>) => void;
}>({ isOpen: (_key, fallback) => fallback, setOpen: () => undefined });

/** An Option-click opening a row and every row under it, as they appear. */
const Cascade = createContext<number | null>(null);
const Level = createContext(0);

export const readDragged = (event: DragEvent): Dragged | null => {
    try {
        const { kind, id }: Partial<Dragged> = JSON.parse(event.dataTransfer.getData(DRAG_TYPE));

        return (kind === 'shape' || kind === 'group') && typeof id === 'string'
            ? { kind, id }
            : null;
    } catch {
        return null;
    }
};

export const acceptsDragged = (event: DragEvent) => event.dataTransfer.types.includes(DRAG_TYPE);

interface Props {
    kind: 'layer' | 'group' | 'shape' | 'component' | 'instance' | 'frame' | 'screen';
    name: string;
    icon?: ReactNode;
    /** Small controls after the name, as a screen's views. */
    chips?: ReactNode;
    /** What dragging the item moves. */
    dragged?: Dragged;
    selected?: boolean;
    active?: boolean;
    visible?: boolean;
    /** Names the row to open and close, for one holding rows; it has no chevron without one. */
    collapseId?: string;
    /** Whether the row starts open, until someone opens or closes it. */
    defaultOpen?: boolean;
    /** What pressing the name does; the name is plain text without it. */
    onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
    onDoubleClick?: MouseEventHandler<HTMLButtonElement>;
    /**
     * The row's actions, in its context menu. The ones named `hide` and `lock` also
     * show at the row's end on hover, and stay there while they are on.
     */
    menuActions?: ItemMenuAction[];
    /** More of the context menu, after the actions. */
    menuItems?: ExplorerMenuItem[];
    /** Renames the item; the name can't be edited without it. */
    onRename?: (name: string) => void;
    /** Takes a shape or group dropped on the item. */
    onDrop?: (dragged: Dragged) => void;
    /** The row's list item, for a list that draws only the rows in view. */
    rowRef?: Ref<HTMLLIElement>;
    /** The row's place in a list that draws only some rows, as `[position, size]` from 1. */
    place?: readonly [number, number];
    children?: ReactNode;
}

/** A row of the explorer's outline: its name, its hide and lock state, and the rows under it. */
export const ExplorerItem: FC<Props> = ({
    kind,
    name,
    icon,
    chips,
    dragged,
    selected = false,
    active = false,
    visible = true,
    collapseId,
    defaultOpen = true,
    onClick,
    onDoubleClick,
    menuActions = [],
    menuItems = [],
    onRename,
    onDrop,
    rowRef,
    place,
    children
}) => {
    const nameId = useId();
    const level = useContext(Level) + 1;
    const items = useContext(OpenItems);
    const cascade = useContext(Cascade);
    const [ownCascade, setOwnCascade] = useState<number | null>(null);
    const [dropTarget, setDropTarget] = useState(false);
    const [menu, setMenu] = useState<Point | null>(null);
    const [draft, setDraft] = useState<string | null>(null);
    const nameButton = useRef<HTMLButtonElement>(null);
    const item = useRef<HTMLLIElement>(null);
    // A search shows everything it finds, also in closed rows.
    const searching = useDocumentFilter().trim() !== '';
    const hasRows = collapseId !== undefined && Boolean(children);
    const open = !hasRows || searching || items.isOpen(collapseId, defaultOpen);
    const hide = menuActions.find((action) => action.id === 'hide');
    const lock = menuActions.find((action) => action.id === 'lock');

    useEffect(() => {
        if (cascade !== null && collapseId && !items.isOpen(collapseId, defaultOpen)) {
            items.setOpen({ [collapseId]: true });
        }
        // Each Option-click opens a row once; closing it later stays closed.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cascade]);

    useEffect(() => {
        if (ownCascade === null) {
            return;
        }
        const timer = setTimeout(() => setOwnCascade(null), CASCADE_MS);

        return () => clearTimeout(timer);
    }, [ownCascade]);

    const toggle = (deep: boolean) => {
        if (!collapseId) {
            return;
        }
        if (!deep) {
            items.setOpen({ [collapseId]: !open });
            return;
        }
        if (open) {
            // Closing every row under this one that is open now.
            const keys = [
                collapseId,
                ...[...(item.current?.querySelectorAll<HTMLElement>('[data-open-key]') ?? [])]
                    .map((row) => row.dataset.openKey!)
                    .filter(Boolean)
            ];

            items.setOpen(Object.fromEntries(keys.map((key) => [key, false])));
            return;
        }
        items.setOpen({ [collapseId]: true });
        setOwnCascade(Date.now());
    };
    const className = [
        (kind === 'component' || kind === 'instance') && styles.component,
        selected && styles.selected,
        active && !selected && styles.active,
        !visible && styles.hidden
    ]
        .filter(Boolean)
        .join(' ');
    const acceptsDrop = (event: DragEvent) => onDrop !== undefined && acceptsDragged(event);
    // A context menu could cover the name before a click, so the press selects.
    const handleNamePointerDown: PointerEventHandler<HTMLButtonElement> = (event) => {
        if (event.button !== 0) {
            return;
        }
        onClick?.(event as unknown as MouseEvent<HTMLButtonElement>);
    };
    const handleNameClick: MouseEventHandler<HTMLButtonElement> = (event) => {
        if (event.detail !== 0) {
            return;
        }
        onClick?.(event);
    };
    const openMenu = (position: Point) => {
        if (menuActions.length + menuItems.length > 0 || onRename) {
            setMenu(position);
        }
    };
    const startRename = () => {
        if (onRename) {
            setDraft(name);
        }
    };
    const finishRename = (save: boolean) => {
        const value = draft?.trim();

        setDraft(null);
        if (save && value && value !== name) {
            onRename?.(value);
        }
        // The name button comes back after this render.
        requestAnimationFrame(() => nameButton.current?.focus({ preventScroll: true }));
    };
    const handleNameKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
        if (event.key === 'Enter' || event.key === 'F2') {
            event.preventDefault();
            startRename();
        } else if (event.key === ' ') {
            event.preventDefault();
            if (hide && !hide.disabled) {
                hide.onRun();
            }
        } else if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
            event.preventDefault();
            const box = event.currentTarget.getBoundingClientRect();

            openMenu({ x: box.left + 24, y: box.bottom });
        }
    };
    const statusButton = (action: ItemMenuAction | undefined) =>
        action && (!action.disabled || action.pressed) ? (
            <button
                type="button"
                tabIndex={-1}
                className={styles.status}
                title={action.label}
                aria-label={action.label}
                aria-pressed={action.pressed}
                disabled={action.disabled}
                onClick={action.onRun}
            >
                <Icon icon={{ ...action.icon, size: 14 }} />
            </button>
        ) : null;
    const contextItems: ExplorerMenuItem[] = [
        ...(onRename
            ? [
                  {
                      id: 'rename',
                      label: 'Rename',
                      icon: { component: Pencil, size: 16 },
                      onRun: startRename
                  } satisfies ExplorerMenuItem
              ]
            : []),
        ...menuActions.map((action) => ({
            id: action.id,
            label: action.label,
            icon: action.icon,
            disabled: action.disabled,
            danger: action.id.startsWith('delete'),
            onRun: action.onRun
        })),
        ...(menuItems.length > 0 ? ['separator' as const, ...menuItems] : [])
    ];

    return (
        <li
            ref={(element) => {
                item.current = element;
                if (typeof rowRef === 'function') {
                    rowRef(element);
                } else if (rowRef) {
                    (rowRef as React.MutableRefObject<HTMLLIElement | null>).current = element;
                }
            }}
            className={className}
            role="treeitem"
            aria-level={level}
            aria-labelledby={nameId}
            aria-selected={selected}
            aria-expanded={hasRows ? open : undefined}
            aria-posinset={place?.[0]}
            aria-setsize={place?.[1]}
        >
            <div
                className={[styles.row, dropTarget && styles.dropTarget].filter(Boolean).join(' ')}
                style={{ '--level': level - 1 } as React.CSSProperties}
                data-open-key={hasRows && open ? collapseId : undefined}
                draggable={dragged !== undefined && draft === null}
                onContextMenu={(event) => {
                    event.preventDefault();
                    if (!selected && onClick) {
                        onClick(event as unknown as MouseEvent<HTMLButtonElement>);
                    }
                    openMenu({ x: event.clientX, y: event.clientY });
                }}
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
                        event.stopPropagation();
                        onDrop?.(dropped);
                    }
                }}
            >
                {hasRows && !searching ? (
                    <button
                        type="button"
                        tabIndex={-1}
                        className={styles.toggle}
                        data-open={open}
                        aria-label={`${open ? 'Collapse' : 'Expand'} ${name}`}
                        title={`${open ? 'Collapse' : 'Expand'} · Option-click for all rows inside`}
                        onClick={(event) => toggle(event.altKey)}
                    >
                        <Icon icon={CHEVRON} />
                    </button>
                ) : (
                    <span className={styles.toggleSpacer} aria-hidden="true" />
                )}
                {draft !== null ? (
                    <input
                        className={styles.rename}
                        aria-label={`Rename ${name}`}
                        ref={(input) => {
                            // Focus once, as the field appears, with the name selected to type over.
                            if (input && !input.dataset.focused) {
                                input.dataset.focused = 'true';
                                input.focus();
                                input.select();
                            }
                        }}
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        onBlur={() => finishRename(true)}
                        onKeyDown={(event) => {
                            event.stopPropagation();
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                finishRename(true);
                            } else if (event.key === 'Escape') {
                                event.preventDefault();
                                finishRename(false);
                            }
                        }}
                    />
                ) : onClick ? (
                    <button
                        ref={nameButton}
                        type="button"
                        className={styles.name}
                        data-explorer-row
                        aria-pressed={selected}
                        onPointerDown={handleNamePointerDown}
                        onClick={handleNameClick}
                        onDoubleClick={onDoubleClick ?? (onRename ? startRename : undefined)}
                        onKeyDown={handleNameKeyDown}
                        onKeyUp={(event) => {
                            // Space hides the row rather than pressing its name.
                            if (event.key === ' ') {
                                event.preventDefault();
                            }
                        }}
                    >
                        {icon}
                        <span id={nameId} className={styles.itemName}>
                            {name}
                        </span>
                    </button>
                ) : (
                    <span className={styles.label}>
                        {icon}
                        <span id={nameId} className={styles.itemName}>
                            {name}
                        </span>
                    </span>
                )}
                {chips}
                <span className={styles.statusButtons}>
                    {statusButton(hide)}
                    {statusButton(lock)}
                </span>
            </div>
            {children && open && (
                <Level.Provider value={level}>
                    <Cascade.Provider value={ownCascade ?? cascade}>
                        <ul role="group">{children}</ul>
                    </Cascade.Provider>
                </Level.Provider>
            )}
            {menu && (
                <ExplorerMenu
                    label={`${name} actions`}
                    position={menu}
                    items={contextItems}
                    onClose={() => setMenu(null)}
                />
            )}
        </li>
    );
};
