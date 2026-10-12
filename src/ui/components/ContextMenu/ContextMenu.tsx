import React, { FC, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Command, Icon as IconType, Point } from 'src/app/types';
import {
    useActions,
    useCommandEnabled,
    useControls,
    useCommandsEnabled,
    usePlacedCommands,
    useScopedCommands,
    useSelectionScope
} from 'src/app/hooks';
import {
    useCanMoveSelectionToLayer,
    useContextMenuTarget,
    useLayerChoices
} from 'src/app/contextMenuHooks';
import {
    BringToFrontCommand,
    CopyCommand,
    CreateComponentCommand,
    CutCommand,
    DeleteCommand,
    DetachInstanceCommand,
    HideCommand,
    LayerCommand,
    LockCommand,
    NewLayerCommand,
    PasteCommand,
    RemoveFromGroupCommand,
    ResetComponentOverridesCommand,
    SelectComponentSourceCommand,
    ShowAllCommand,
    UnlockCommand,
    ZoomInCommand,
    ZoomOutCommand,
    ZoomResetCommand
} from 'src/commands';
import { useRegisteredTools } from 'src/tools/components';
import { Icon } from '../Icon';
import { shortcutLabel, usesCommandKey } from '../CommandBar/shortcutLabel';
import { ObjectTypeSymbol } from '../ObjectTypeSymbol';
import styles from './styles.css';

type Submenu = 'layers' | 'align' | 'arrange' | 'draw' | null;
const SUBMENU_TITLES = {
    layers: 'Move to layer',
    align: 'Align',
    arrange: 'Arrange',
    draw: 'Draw shape'
};

/** The categories of the inspector's commands the Align submenu offers. */
const ALIGN_CATEGORIES = new Set(['align', 'space']);

const INSTANCE_COMMANDS = [
    SelectComponentSourceCommand,
    ResetComponentOverridesCommand,
    DetachInstanceCommand
];

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
const mac = usesCommandKey();

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

/** A row that runs `command`, showing its icon, shortcut and whether it can run now. */
const CommandRow: FC<{
    command: Command;
    label?: string;
    danger?: boolean;
    component?: boolean;
    onRun: (command: Command) => void;
}> = ({ command, label = command.name, danger, component, onRun }) => (
    <MenuRow
        label={label}
        icon={command.icon ?? icon('action', 'help')}
        shortcut={command.shortcut && shortcutLabel(command.shortcut, mac)}
        danger={danger}
        component={component}
        disabled={!useCommandEnabled(command)}
        onClick={() => onRun(command)}
    />
);

const Divider: FC = () => <div className={styles.divider} role="separator" />;

interface Props {
    position: Point;
    onPressOutside: () => void;
}

/** A compact, viewport-bound menu with submenus in the same glass surface. */
export const ContextMenu: FC<Props> = ({ position, onPressOutside }) => {
    const menu = useRef<HTMLDivElement>(null);
    // Escape gives focus back to where it was, so the keyboard carries on from there.
    const opener = useRef(document.activeElement);
    const nameInput = useRef<HTMLInputElement>(null);
    const [placement, setPlacement] = useState(position);
    const [submenu, setSubmenu] = useState<Submenu>(null);
    const [editingName, setEditingName] = useState(false);
    const [draftName, setDraftName] = useState('');
    const { contextMenu, grid, guides, rulers } = useControls();
    const actions = useActions();
    const tools = useRegisteredTools().filter((tool) => tool.category === 'shapes');
    const target = useContextMenuTarget();
    const layers = useLayerChoices();
    const canMoveToLayer = useCanMoveSelectionToLayer();
    const canUnlock = useCommandEnabled(UnlockCommand);
    // The selection's commands come from the registry, in menu order: arranging ones in
    // their own submenu and Delete last, apart from the rest.
    const scoped = useScopedCommands(useSelectionScope());
    const arranging = scoped.filter((command) => command.category === 'arrange');
    const general = scoped.filter(
        (command) => command.category !== 'arrange' && command !== DeleteCommand
    );
    const aligning = usePlacedCommands('inspector').filter(({ category }) =>
        ALIGN_CATEGORIES.has(category)
    );
    const canAlign = useCommandsEnabled(aligning).some(Boolean);
    const canRemoveFromGroup = useCommandEnabled(RemoveFromGroupCommand);
    const showsInstanceCommands = useCommandsEnabled(INSTANCE_COMMANDS).some(Boolean);

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
    const toggle = (controlId: 'grid' | 'guides' | 'rulers') => {
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
                // Tab leaves the menu as Escape does, rather than moving focus behind it.
                if (event.key === 'Escape' || event.key === 'Tab') {
                    event.preventDefault();
                    onPressOutside();
                    if (opener.current instanceof HTMLElement) {
                        opener.current.focus({ preventScroll: true });
                    }
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
                    <CommandRow command={LayerCommand} label="New layer" onRun={run} />
                    <Divider />
                    <MenuRow
                        label="Canvas"
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
            {submenu === 'align' &&
                aligning.map((command) => (
                    <CommandRow key={command.id} command={command} onRun={run} />
                ))}
            {submenu === 'arrange' &&
                arranging.map((command) => (
                    <CommandRow key={command.id} command={command} onRun={run} />
                ))}
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
                    <CommandRow command={CutCommand} onRun={run} />
                    <CommandRow command={CopyCommand} onRun={run} />
                    <CommandRow command={PasteCommand} onRun={run} />
                    <Divider />
                    {general.map((command) => (
                        <CommandRow
                            key={command.id}
                            command={command}
                            component={command === CreateComponentCommand}
                            onRun={run}
                        />
                    ))}
                    {canRemoveFromGroup && (
                        <CommandRow command={RemoveFromGroupCommand} onRun={run} />
                    )}
                    {showsInstanceCommands && (
                        <>
                            <Divider />
                            {INSTANCE_COMMANDS.map((command) => (
                                <CommandRow key={command.id} command={command} onRun={run} />
                            ))}
                        </>
                    )}
                    <Divider />
                    <MenuRow
                        label="Move to layer"
                        icon={icon('action', 'view_agenda')}
                        submenu
                        disabled={!canMoveToLayer}
                        onClick={() => setSubmenu('layers')}
                    />
                    <MenuRow
                        label="Align"
                        icon={icon('editor', 'format_align_left')}
                        submenu
                        disabled={!canAlign}
                        onClick={() => setSubmenu('align')}
                    />
                    {arranging.length > 0 && (
                        <MenuRow
                            label="Arrange"
                            icon={BringToFrontCommand.icon!}
                            submenu
                            onClick={() => setSubmenu('arrange')}
                        />
                    )}
                    <CommandRow command={HideCommand} onRun={run} />
                    <CommandRow command={canUnlock ? UnlockCommand : LockCommand} onRun={run} />
                    {scoped.includes(DeleteCommand) && (
                        <>
                            <Divider />
                            <CommandRow command={DeleteCommand} danger onRun={run} />
                        </>
                    )}
                </>
            )}
            {!submenu && contextMenu.target === 'canvas' && (
                <>
                    <CommandRow command={PasteCommand} onRun={run} />
                    <MenuRow
                        label="Draw shape"
                        icon={icon('image', 'crop_square')}
                        submenu
                        onClick={() => setSubmenu('draw')}
                    />
                    <CommandRow command={NewLayerCommand} onRun={run} />
                    <CommandRow command={ShowAllCommand} onRun={run} />
                    <Divider />
                    <CommandRow command={ZoomInCommand} onRun={run} />
                    <CommandRow command={ZoomOutCommand} onRun={run} />
                    <CommandRow command={ZoomResetCommand} onRun={run} />
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
                    <MenuRow
                        label="Show rulers"
                        icon={icon('editor', 'border_top')}
                        checked={rulers.visible}
                        onClick={() => toggle('rulers')}
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
