import React, { FC, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Command, Icon as IconType, Point } from 'src/app/types';
import { useActions, useAppState, useControls } from 'src/app/hooks';
import {
    BringToFrontCommand,
    CloneCommand,
    CreateComponentCommand,
    DeleteCommand,
    HideCommand,
    LockCommand,
    NewLayerCommand,
    PasteCommand,
    SendToBackCommand,
    UnlockCommand
} from 'src/commands';
import { useRegisteredTools } from 'src/tools/components';
import { Icon } from '../Icon';
import { ObjectTypeSymbol, ObjectType } from '../ObjectTypeSymbol';
import styles from './styles.css';

type Submenu = 'layers' | 'arrange' | 'draw' | null;
const SUBMENU_TITLES = { layers: 'Move to layer', arrange: 'Arrange', draw: 'Draw shape' };

interface MenuTarget {
    name: string;
    type: ObjectType;
    ids: string[];
    rename?: { kind: 'component' | 'group' | 'shape'; id: string; readOnly: boolean };
}

interface RowProps {
    label: string;
    icon: IconType;
    onClick: () => void;
    disabled?: boolean;
    shortcut?: string;
    submenu?: boolean;
    checked?: boolean;
    danger?: boolean;
    component?: boolean;
}

const icon = (group: string, name: string): IconType => ({ group, name, size: 16 });

const MenuRow: FC<RowProps> = ({
    label,
    icon: rowIcon,
    onClick,
    disabled,
    shortcut,
    submenu,
    checked,
    danger,
    component
}) => (
    <button
        type="button"
        role={checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
        aria-checked={checked}
        data-submenu={submenu || undefined}
        className={`${styles.row}${danger ? ` ${styles.danger}` : ''}${component ? ` ${styles.component}` : ''}`}
        onClick={onClick}
        disabled={disabled}
    >
        <Icon icon={{ ...rowIcon, color: undefined, size: 16 }} />
        <span className={styles.rowLabel}>{label}</span>
        {shortcut && <span className={styles.trailing}>{shortcut}</span>}
        {submenu && (
            <span className={styles.trailing} aria-hidden="true">
                ›
            </span>
        )}
        {checked && (
            <span className={styles.trailing} aria-hidden="true">
                ✓
            </span>
        )}
    </button>
);

const Divider: FC = () => <div className={styles.divider} role="separator" />;

interface Props {
    position: Point;
    onPressOutside: () => void;
}

/** A compact, viewport-bound menu with submenus in the same glass surface. */
export const ContextMenu: FC<Props> = ({ position, onPressOutside }) => {
    const menu = useRef<HTMLDivElement>(null);
    const nameInput = useRef<HTMLInputElement>(null);
    const [placement, setPlacement] = useState(position);
    const [submenu, setSubmenu] = useState<Submenu>(null);
    const [editingName, setEditingName] = useState(false);
    const [draftName, setDraftName] = useState('');
    const { contextMenu, grid, guides } = useControls();
    const actions = useActions();
    const tools = useRegisteredTools().filter((tool) => tool.category === 'shapes');
    const target = useAppState((state): MenuTarget => {
        const document = state.currentDocument;
        const ids = document.selectedShapesIds;
        const moveIds = [
            ...new Set([
                ...ids,
                ...document.selectedGroupsIds.flatMap((id) => document.groups[id].shapesIds)
            ])
        ];
        const selectedComponent = state.selectedComponent;
        const component = selectedComponent && document.components[selectedComponent.componentId];
        const groupId = document.selectedGroupsIds[0];
        const group = groupId && document.groups[groupId];
        const shape = ids.length === 1 ? document.shapes[ids[0]] : null;

        if (contextMenu.target === 'canvas') {
            return { name: 'Canvas', type: 'surface' as ObjectType, ids: [] as string[] };
        }
        if (component) {
            return {
                name: component.name,
                type: 'component',
                ids: moveIds,
                rename: {
                    kind: 'component',
                    id: component.id,
                    readOnly: Boolean(component.library || component.locked || document.locked)
                }
            };
        }
        if (
            group &&
            document.selectedGroupsIds.length === 1 &&
            ids.every((id) => group.shapesIds.includes(id))
        ) {
            return {
                name: group.name,
                type: 'group',
                ids: moveIds,
                rename: { kind: 'group', id: group.id, readOnly: group.locked || document.locked }
            };
        }
        if (shape) {
            return {
                name: shape.name,
                type: shape.type as ObjectType,
                ids: moveIds,
                rename: { kind: 'shape', id: shape.id, readOnly: document.locked }
            };
        }

        return { name: `${ids.length} selected`, type: 'group' as ObjectType, ids: moveIds };
    });
    const layers = useAppState((state) =>
        Object.values(state.currentDocument.layers).map(({ id, name }) => ({ id, name }))
    );
    const enabled = useAppState((state) => ({
        clone: CloneCommand.canExecute({ state }),
        createComponent: CreateComponentCommand.canExecute({ state }),
        delete: DeleteCommand.canExecute({ state }),
        hide: HideCommand.canExecute({ state }),
        lock: LockCommand.canExecute({ state }),
        unlock: UnlockCommand.canExecute({ state }),
        front: BringToFrontCommand.canExecute({ state }),
        back: SendToBackCommand.canExecute({ state }),
        moveToLayer:
            state.currentDocument.editableSelectedShapesIds.length > 0 &&
            state.currentDocument.selectedShapesIds.every((id) =>
                Object.values(state.currentDocument.components).every(
                    (component) => !component.shapesIds.includes(id)
                )
            ),
        paste: PasteCommand.canExecute({ state }),
        newLayer: NewLayerCommand.canExecute({ state })
    }));

    useLayoutEffect(() => {
        const width = menu.current?.offsetWidth ?? 0;
        const height = menu.current?.offsetHeight ?? 0;
        const margin = 8;

        setPlacement({
            x: Math.max(margin, Math.min(position.x, window.innerWidth - width - margin)),
            y: Math.max(margin, Math.min(position.y, window.innerHeight - height - margin))
        });
        menu.current
            ?.querySelector<HTMLButtonElement>('[role="menuitem"], [role="menuitemcheckbox"]')
            ?.focus();
    }, [position, submenu]);

    useLayoutEffect(() => {
        if (editingName) {
            nameInput.current?.focus();
            nameInput.current?.select();
        }
    }, [editingName]);

    useEffect(() => {
        const handlePointerDown = (event: PointerEvent) => {
            if (event.target instanceof Node && menu.current?.contains(event.target)) {
                return;
            }

            // A press only dismisses the menu; it does not also draw or select.
            event.stopPropagation();
            onPressOutside();
        };

        document.addEventListener('pointerdown', handlePointerDown, true);

        return () => document.removeEventListener('pointerdown', handlePointerDown, true);
    }, [onPressOutside]);

    const run = (command: Command) => {
        onPressOutside();
        actions.runCommand(command);
    };
    const moveToLayer = (layerId: string | null) => {
        onPressOutside();
        actions.moveShapesToLayer({ shapeIds: target.ids, layerId });
    };
    const toggle = (controlId: 'grid' | 'guides') => {
        onPressOutside();
        actions.ui.toggleControlVisibility(controlId);
    };
    const title = submenu ? SUBMENU_TITLES[submenu] : target.name;
    const canRename = Boolean(target.rename && !target.rename.readOnly);
    const beginRename = () => {
        setDraftName(target.name);
        setEditingName(true);
    };
    const saveName = () => {
        const name = draftName.trim();

        if (!name || !target.rename || target.rename.readOnly) {
            setEditingName(false);
            return;
        }

        switch (target.rename.kind) {
            case 'component':
                actions.updateComponent({ id: target.rename.id, name });
                break;
            case 'group':
                actions.updateGroup({ id: target.rename.id, name });
                break;
            case 'shape':
                actions.setShapesProperty({
                    shapeIds: [target.rename.id],
                    key: 'name',
                    value: name
                });
                break;
        }
        setEditingName(false);
    };
    const renderName = () => {
        if (editingName) {
            return (
                <input
                    ref={nameInput}
                    className={styles.nameInput}
                    aria-label="Name"
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                    onBlur={saveName}
                    onKeyDown={(event) => {
                        event.stopPropagation();
                        if (event.key === 'Enter') {
                            event.preventDefault();
                            event.currentTarget.blur();
                        }
                        if (event.key === 'Escape') {
                            event.preventDefault();
                            setEditingName(false);
                        }
                    }}
                />
            );
        }
        if (canRename && !submenu) {
            return (
                <button type="button" className={styles.nameButton} onClick={beginRename}>
                    {title}
                </button>
            );
        }
        return <span>{title}</span>;
    };

    return (
        <div
            ref={menu}
            data-cy="context-menu"
            role="menu"
            tabIndex={-1}
            aria-label={`${target.name} actions`}
            className={styles.contextMenu}
            style={{ left: placement.x, top: placement.y }}
            onKeyDown={(event) => {
                event.stopPropagation();
                if (event.target instanceof HTMLInputElement) {
                    return;
                }
                if (event.key === 'Escape') {
                    event.preventDefault();
                    onPressOutside();
                    return;
                }
                if (event.key === 'ArrowLeft' && submenu) {
                    event.preventDefault();
                    setSubmenu(null);
                    return;
                }
                if (event.key === 'ArrowRight') {
                    event.preventDefault();
                    const active = document.activeElement;

                    if (active instanceof HTMLButtonElement && active.dataset.submenu) {
                        active.click();
                    }
                    return;
                }
                if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
                    return;
                }

                const items = [
                    ...(menu.current?.querySelectorAll<HTMLButtonElement>(
                        'button:not(:disabled)'
                    ) ?? [])
                ];
                const current = items.indexOf(document.activeElement as HTMLButtonElement);
                let next = 0;

                if (event.key === 'End') {
                    next = items.length - 1;
                } else if (event.key === 'ArrowDown') {
                    next = (current + 1) % items.length;
                } else if (event.key === 'ArrowUp') {
                    next = (current - 1 + items.length) % items.length;
                }

                event.preventDefault();
                items[next]?.focus();
            }}
        >
            <div
                className={styles.header}
                data-component={target.type === 'component' || target.type === 'instance'}
            >
                {submenu ? (
                    <button
                        className={styles.back}
                        type="button"
                        onClick={() => setSubmenu(null)}
                        aria-label="Back"
                    >
                        ‹
                    </button>
                ) : (
                    <ObjectTypeSymbol type={target.type} size={16} />
                )}
                {renderName()}
                {canRename && !submenu && !editingName && (
                    <button
                        type="button"
                        className={styles.editButton}
                        aria-label={`Rename ${target.type}`}
                        title={`Rename ${target.type}`}
                        onClick={beginRename}
                    >
                        <Icon icon={icon('image', 'edit')} />
                    </button>
                )}
            </div>
            <Divider />
            {submenu === 'layers' && (
                <>
                    <MenuRow
                        label="Surface"
                        icon={icon('action', 'view_agenda')}
                        onClick={() => moveToLayer(null)}
                    />
                    {layers.map((layer) => (
                        <MenuRow
                            key={layer.id}
                            label={layer.name}
                            icon={icon('action', 'view_agenda')}
                            onClick={() => moveToLayer(layer.id)}
                        />
                    ))}
                </>
            )}
            {submenu === 'arrange' && (
                <>
                    <MenuRow
                        label="Bring to front"
                        icon={BringToFrontCommand.icon!}
                        disabled={!enabled.front}
                        onClick={() => run(BringToFrontCommand)}
                    />
                    <MenuRow
                        label="Send to back"
                        icon={SendToBackCommand.icon!}
                        disabled={!enabled.back}
                        onClick={() => run(SendToBackCommand)}
                    />
                </>
            )}
            {submenu === 'draw' &&
                tools.map((tool) => (
                    <MenuRow
                        key={tool.id}
                        label={tool.name}
                        icon={tool.icon!}
                        onClick={() => {
                            onPressOutside();
                            actions.tools.activateTool(tool.id);
                        }}
                    />
                ))}
            {!submenu && contextMenu.target === 'selection' && (
                <>
                    <MenuRow
                        label="Duplicate"
                        icon={CloneCommand.icon!}
                        shortcut="⌘D"
                        disabled={!enabled.clone}
                        onClick={() => run(CloneCommand)}
                    />
                    <MenuRow
                        label="Create component"
                        icon={icon('content', 'add')}
                        component
                        disabled={!enabled.createComponent}
                        onClick={() => run(CreateComponentCommand)}
                    />
                    <Divider />
                    <MenuRow
                        label="Move to layer"
                        icon={icon('action', 'view_agenda')}
                        submenu
                        disabled={!enabled.moveToLayer}
                        onClick={() => setSubmenu('layers')}
                    />
                    <MenuRow
                        label="Arrange"
                        icon={BringToFrontCommand.icon!}
                        submenu
                        onClick={() => setSubmenu('arrange')}
                    />
                    <MenuRow
                        label="Hide"
                        icon={HideCommand.icon!}
                        disabled={!enabled.hide}
                        onClick={() => run(HideCommand)}
                    />
                    <MenuRow
                        label={enabled.unlock ? 'Unlock' : 'Lock'}
                        icon={enabled.unlock ? UnlockCommand.icon! : LockCommand.icon!}
                        disabled={!enabled.unlock && !enabled.lock}
                        onClick={() => run(enabled.unlock ? UnlockCommand : LockCommand)}
                    />
                    <Divider />
                    <MenuRow
                        label="Delete"
                        icon={DeleteCommand.icon!}
                        shortcut="⌫"
                        danger
                        disabled={!enabled.delete}
                        onClick={() => run(DeleteCommand)}
                    />
                </>
            )}
            {!submenu && contextMenu.target === 'canvas' && (
                <>
                    <MenuRow
                        label="Paste"
                        icon={PasteCommand.icon!}
                        shortcut="⌘V"
                        disabled={!enabled.paste}
                        onClick={() => run(PasteCommand)}
                    />
                    <MenuRow
                        label="Draw shape"
                        icon={icon('image', 'crop_square')}
                        submenu
                        onClick={() => setSubmenu('draw')}
                    />
                    <MenuRow
                        label="New layer"
                        icon={icon('content', 'add')}
                        disabled={!enabled.newLayer}
                        onClick={() => run(NewLayerCommand)}
                    />
                    <Divider />
                    <MenuRow
                        label="Show grid"
                        icon={icon('image', 'grid_on')}
                        checked={grid.visible}
                        onClick={() => toggle('grid')}
                    />
                    <MenuRow
                        label="Show guides"
                        icon={icon('image', 'straighten')}
                        checked={guides.visible}
                        onClick={() => toggle('guides')}
                    />
                </>
            )}
        </div>
    );
};

export const ConnectedContextMenu: FC = () => {
    const { contextMenu } = useControls();
    const { hideContextMenu } = useActions().ui;

    return <ContextMenu position={contextMenu.position} onPressOutside={hideContextMenu} />;
};
