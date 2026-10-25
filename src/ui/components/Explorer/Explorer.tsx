import { screenOwners } from 'src/app/screenViews';
import React, { FC, MouseEvent, useState } from 'react';
import { Frame as FrameIcon, CircleHelp, Star, Trash2 } from 'lucide-react';
import styles from './styles.css';
import { CollapsedItems, Dragged, ExplorerItem } from './ExplorerItem';
import { SearchBoxContainer } from '../SearchBox';
import { hideAction, lockAction, toggleAction, useItemCommandActions } from '../ItemMenu';
import { Icon } from '../Icon';
import { ObjectTypeSymbol } from '../ObjectTypeSymbol';
import { SourceItem } from './SourceItem';
import { byDrawingOrder } from 'src/app/drawOrder';
import type { CommandScope } from 'src/app/types';
import type { explorerTree } from 'src/app/explorerTree';
import { isShapeLocked } from 'src/app/utils';
import {
    useExplorerTree,
    useExplorerLayers,
    useExplorerView,
    useFrameRows,
    useSelectedFrameId,
    useShapesFrameState
} from 'src/app/frameHooks';
import {
    useActions,
    useComponents,
    useCommandsEnabled,
    useControls,
    useCurrentDocument,
    useDocumentFilter,
    useGroup,
    useGroupSelected,
    useLayer,
    useShape,
    useShapeLocked,
    useShapesIds,
    useScopedCommands,
    useShownLayerId
} from 'src/app/hooks';
import { useSourceSelected } from 'src/app/componentHooks';

const RootItem: FC<{
    scope?: Extract<CommandScope, 'layers' | 'components'>;
    name: string;
    icon?: React.ReactNode;
    selected?: boolean;
    onClick?: () => void;
    onDrop?: (dragged: Dragged) => void;
    children: React.ReactNode;
}> = ({ scope, name, icon, selected, onClick, onDrop, children }) => {
    const commands = useScopedCommands(scope ?? null);
    const enabled = useCommandsEnabled(commands);
    const { runCommand } = useActions();

    return (
        <ExplorerItem
            kind="root"
            name={name}
            icon={icon}
            selected={selected}
            onClick={onClick}
            onDrop={onDrop}
            collapseId={`root:${name}`}
            rootButtons={commands.map((command, index) => (
                <button
                    key={command.id}
                    type="button"
                    className={styles.rootAction}
                    data-scope={scope}
                    title={command.description ?? command.name}
                    aria-label={command.name}
                    disabled={!enabled[index]}
                    onClick={() => runCommand(command)}
                >
                    <Icon icon={{ component: CircleHelp, ...command.icon, size: 16 }} />
                </button>
            ))}
        >
            {children}
        </ExplorerItem>
    );
};

const ShapeItem: FC<{ shapeId: string; sourceId?: string }> = ({ shapeId, sourceId }) => {
    const shape = useShape(shapeId);
    const inherited = useShapesFrameState([shapeId]);
    const sourceSelected = useSourceSelected(sourceId ?? null);
    const {
        selectShape,
        unselectShapes,
        toggleShapeSelected,
        toggleShapeLocked,
        toggleShapeVisible,
        selectComponentChild
    } = useActions();
    const commands = useItemCommandActions(
        [shapeId],
        useShapeLocked(shapeId) || !shape.visible || inherited.hidden
    );

    const handleSelect = ({ shiftKey }: MouseEvent<HTMLButtonElement>) => {
        if (shiftKey) {
            toggleShapeSelected(shapeId);

            return;
        }
        if (sourceId) {
            selectComponentChild({ componentId: sourceId, shapeId });

            return;
        }
        unselectShapes();
        selectShape(shapeId);
    };

    return (
        <ExplorerItem
            kind={shape.type === 'instance' ? 'instance' : 'shape'}
            name={shape.name}
            icon={<ObjectTypeSymbol type={shape.type} />}
            dragged={sourceId ? undefined : { kind: 'shape', id: shapeId }}
            selected={shape.selected && !sourceSelected}
            active={shape.active}
            visible={shape.visible && !inherited.hidden}
            onClick={handleSelect}
            menuActions={[
                {
                    ...hideAction(!shape.visible, () => toggleShapeVisible(shapeId)),
                    disabled: inherited.locked
                },
                {
                    ...lockAction(shape.locked, () => toggleShapeLocked(shapeId)),
                    disabled: inherited.locked
                },
                ...commands(useScopedCommands('shape'))
            ]}
        />
    );
};

const GroupItem: FC<{
    groupId: string;
    shapesIds: string[];
    contextId: string;
}> = ({ groupId, shapesIds, contextId }) => {
    const group = useGroup(groupId);
    const inherited = useShapesFrameState(group.shapesIds);
    const selected = useGroupSelected(groupId);
    const {
        addShapesToGroup,
        unselectShapes,
        toggleGroupSelected,
        toggleGroupLocked,
        toggleGroupVisible
    } = useActions();
    const commands = useItemCommandActions(
        group.shapesIds,
        group.locked || inherited.locked || inherited.hidden
    );

    const handleSelect = ({ shiftKey }: MouseEvent<HTMLButtonElement>) => {
        if (!shiftKey) {
            unselectShapes();
        }
        toggleGroupSelected(groupId);
    };

    return (
        <ExplorerItem
            kind="group"
            name={group.name}
            icon={<ObjectTypeSymbol type="group" />}
            dragged={{ kind: 'group', id: groupId }}
            collapseId={`${contextId}:group:${groupId}`}
            selected={selected}
            visible={group.visible && !inherited.hidden}
            onClick={handleSelect}
            menuActions={[
                {
                    ...hideAction(!group.visible, () => toggleGroupVisible(groupId)),
                    disabled: inherited.locked
                },
                {
                    ...lockAction(group.locked, () => toggleGroupLocked(groupId)),
                    disabled: inherited.locked
                },
                ...commands(useScopedCommands('group'))
            ]}
            onDrop={({ kind, id }) => {
                // Only shapes join a group; a group dropped on a group stays as it is.
                if (kind === 'shape') {
                    addShapesToGroup({ shapeIds: [id], groupId });
                }
            }}
        >
            {shapesIds.map((shapeId) => (
                <ShapeItem key={shapeId} shapeId={shapeId} />
            ))}
        </ExplorerItem>
    );
};

interface LayerProps {
    layerId: string | null;
    groups: { groupId: string; shapesIds: string[] }[];
    shapesIds: string[];
    contextId: string;
    /** The shapes a dragged shape or group stands for. */
    shapesOf: (dragged: Dragged) => string[];
}

const ObjectContents: FC<Pick<LayerProps, 'groups' | 'shapesIds' | 'contextId'>> = ({
    groups,
    shapesIds,
    contextId
}) => {
    const drawOrder = new Map(useShapesIds().map((id, index) => [id, index]));
    const items = [
        ...groups.map((group) => ({
            kind: 'group' as const,
            id: group.groupId,
            shapesIds: [...group.shapesIds].sort(
                (a, b) => (drawOrder.get(b) ?? -1) - (drawOrder.get(a) ?? -1)
            ),
            rank: Math.max(...group.shapesIds.map((id) => drawOrder.get(id) ?? -1))
        })),
        ...shapesIds.map((id) => ({
            kind: 'shape' as const,
            id,
            rank: drawOrder.get(id) ?? -1
        }))
    ].sort((a, b) => b.rank - a.rank);

    return (
        <>
            {items.map((item) =>
                item.kind === 'group' ? (
                    <GroupItem
                        key={item.id}
                        groupId={item.id}
                        shapesIds={item.shapesIds}
                        contextId={contextId}
                    />
                ) : (
                    <ShapeItem key={item.id} shapeId={item.id} />
                )
            )}
        </>
    );
};

const LayerItem: FC<LayerProps & { layerId: string }> = ({
    layerId,
    groups,
    shapesIds,
    contextId,
    shapesOf
}) => {
    const layer = useLayer(layerId);
    const documentLocked = useCurrentDocument().locked;
    const shown = useShownLayerId() === layerId;
    const {
        moveShapesToLayer,
        removeLayer,
        showOnlyLayer,
        selectExplorerLayer,
        toggleLayerLocked,
        toggleLayerVisible
    } = useActions();
    const commands = useItemCommandActions(layer.shapesIds, layer.locked);

    return (
        <ExplorerItem
            kind="layer"
            name={layer.name}
            icon={<ObjectTypeSymbol type="layer" />}
            collapseId={
                groups.length + shapesIds.length > 0 ? `${contextId}:layer:${layerId}` : undefined
            }
            shown={shown}
            selected={layer.selected}
            visible={layer.visible}
            onClick={() => selectExplorerLayer(layerId)}
            menuActions={[
                toggleAction(
                    'highlight',
                    shown,
                    {
                        on: { label: 'Show all layers', component: Star, fill: 'currentColor' },
                        off: { label: 'Highlight layer', component: Star }
                    },
                    () => showOnlyLayer(layerId)
                ),
                hideAction(!layer.visible, () => toggleLayerVisible(layerId)),
                lockAction(layer.locked, () => toggleLayerLocked(layerId)),
                {
                    id: 'delete-layer',
                    label: 'Delete layer',
                    icon: { component: Trash2, size: 16 },
                    disabled: layer.locked || documentLocked,
                    onRun: () => removeLayer(layerId)
                },
                ...commands(useScopedCommands('layer'))
            ]}
            onDrop={(dragged) => moveShapesToLayer({ shapeIds: shapesOf(dragged), layerId })}
        >
            <ObjectContents groups={groups} shapesIds={shapesIds} contextId={contextId} />
        </ExplorerItem>
    );
};

const noObjects: ReturnType<typeof explorerTree> = {
    canvas: { groups: [], shapesIds: [] },
    frames: []
};

export const Explorer: FC = () => {
    const frames = useFrameRows();
    const selectedFrameId = useSelectedFrameId();
    const { editFrame, setExplorerView } = useActions();
    const view = useExplorerView();
    const tree = useExplorerTree(view === 'objects') ?? noObjects;
    const layers = useExplorerLayers(view === 'layers') ?? [];
    const document = useCurrentDocument();
    const components = useComponents() ?? {};
    const filter = useDocumentFilter().trim().toLowerCase();
    const frameContents = new Map(tree.frames.map((frame) => [frame.id, frame]));
    const shownFrames = frames.flatMap((frame) => {
        const contents = frameContents.get(frame.id);

        return contents ? [{ ...frame, ...contents }] : [];
    });
    const owners = screenOwners(document.frames);
    // Only root screens are definitions; nested screens stay in their parent's branch.
    const screens = frames
        .filter((frame) => owners.get(frame.id) === frame.id)
        .map((screen) => ({
            ...screen,
            viewCount: frames.filter((view) => view.kind === 'view' && view.screenId === screen.id)
                .length
        }));
    const frameItem = (frame: (typeof shownFrames)[number], viewId?: string): React.ReactNode => (
        <ExplorerItem
            key={`frame:${frame.id}`}
            kind="frame"
            name={frame.name}
            badge={
                frame.kind === 'view'
                    ? 'Screen view'
                    : frame.kind === 'screen'
                      ? 'Screen'
                      : undefined
            }
            secondary={
                frame.kind === 'view'
                    ? `${document.frames[frame.screenId ?? '']?.name ?? 'Missing screen'} · ${frame.size.width} × ${frame.size.height}`
                    : undefined
            }
            icon={<FrameIcon size={16} aria-hidden="true" />}
            selected={selectedFrameId === frame.id}
            visible={frame.shown}
            collapseId={`frame:${viewId ?? frame.id}:${frame.id}`}
            onClick={() => editFrame({ kind: 'select', id: frame.id })}
            onDrop={
                frame.locked || frame.inheritedLock
                    ? undefined
                    : (dragged) =>
                          moveIntoFrame(
                              dragged,
                              frame.kind === 'view' ? (frame.screenId ?? frame.id) : frame.id
                          )
            }
            menuActions={[
                {
                    ...hideAction(!frame.visible, () =>
                        editFrame({ kind: 'toggle', id: frame.id, flag: 'visible' })
                    ),
                    disabled: frame.inheritedLock
                },
                {
                    ...lockAction(frame.locked, () =>
                        editFrame({ kind: 'toggle', id: frame.id, flag: 'locked' })
                    ),
                    disabled: frame.inheritedLock
                }
            ]}
        >
            {shownFrames
                .filter(
                    (child) =>
                        owners.get(child.id) !== child.id &&
                        child.parentFrameId === (frame.kind === 'view' ? frame.screenId : frame.id)
                )
                .map((child) => frameItem(child, viewId ?? frame.id))}
            <ObjectContents
                {...(frame.kind === 'view'
                    ? (frameContents.get(frame.screenId ?? '')?.contents ?? {
                          groups: [],
                          shapesIds: []
                      })
                    : frame.contents)}
                contextId={`frame:${viewId ?? frame.id}:${frame.id}`}
            />
        </ExplorerItem>
    );
    const drawOrder = new Map(useShapesIds().map((id, index) => [id, index]));
    const scene = tree.canvas;
    const hasCanvasObjects = scene.groups.length + scene.shapesIds.length > 0;
    const sources = Object.values(components).flatMap((component) => {
        const member = (id: string) => component.sourceShapes?.[id] ?? document.shapes[id];
        const members = component.shapesIds.filter((id) => member(id));

        members.sort((a, b) => {
            if (!component.library) {
                return (drawOrder.get(b) ?? -1) - (drawOrder.get(a) ?? -1);
            }
            const first = member(a);
            const second = member(b);

            return first && second ? byDrawingOrder(second, first) : 0;
        });
        const matching = members.filter((id) => member(id)?.name.toLowerCase().includes(filter));

        if (filter && !component.name.toLowerCase().includes(filter) && matching.length === 0) {
            return [];
        }

        return [
            {
                component,
                shapesIds:
                    !filter || component.name.toLowerCase().includes(filter) ? members : matching
            }
        ];
    });
    const shownLayerId = useShownLayerId();
    const { explorer } = useControls();
    const { moveShapesToLayer, selectExplorerLayer, showAllLayers } = useActions();
    const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
    const handleCanvasSelect = () => selectExplorerLayer(null);

    if (!explorer.visible) {
        return null;
    }

    const shapesOf = ({ kind, id }: Dragged) =>
        kind === 'shape' ? [id] : (document.groups[id]?.shapesIds ?? []);
    // Same as the Parent picker: a group moves whole, positions stay where they are.
    const moveIntoFrame = (dragged: Dragged, parentFrameId: string | null) => {
        const ids = shapesOf(dragged).filter(
            (id) =>
                !isShapeLocked(document, id) &&
                (document.shapes[id]?.parentFrameId ?? null) !== parentFrameId
        );

        if (ids.length > 0) {
            editFrame({ kind: 'reparentShapes', ids, parentFrameId });
        }
    };

    return (
        <CollapsedItems.Provider
            value={{
                collapsed,
                toggle: (collapseId) => {
                    const next = new Set(collapsed);

                    if (!next.delete(collapseId)) {
                        next.add(collapseId);
                    }
                    setCollapsed(next);
                }
            }}
        >
            <section className={styles.explorer} aria-label="Explorer">
                <div className={styles.views} role="group" aria-label="Explorer view">
                    <button
                        type="button"
                        aria-pressed={view === 'objects'}
                        onClick={() => setExplorerView('objects')}
                    >
                        Objects
                    </button>
                    <button
                        type="button"
                        aria-pressed={view === 'layers'}
                        onClick={() => setExplorerView('layers')}
                    >
                        Layers
                    </button>
                </div>
                <SearchBoxContainer
                    label={view === 'objects' ? 'Search objects' : 'Search layers and objects'}
                />
                {shownLayerId && (
                    <button
                        type="button"
                        className={styles.showAll}
                        onClick={() => showAllLayers()}
                    >
                        Show all layers
                    </button>
                )}
                {view === 'layers' ? (
                    <>
                        <p className={styles.hint}>
                            Global layers organize objects across all screens.
                        </p>
                        {filter && layers.length === 0 ? (
                            <p className={styles.empty}>No layers or objects match</p>
                        ) : (
                            <ul>
                                <RootItem
                                    scope="layers"
                                    name="Global layers"
                                    icon={<ObjectTypeSymbol type="layer" />}
                                >
                                    {layers
                                        .filter((layer) => layer.layerId !== null)
                                        .map((layer) => (
                                            <LayerItem
                                                key={layer.layerId}
                                                {...layer}
                                                layerId={layer.layerId!}
                                                contextId="layers"
                                                shapesOf={shapesOf}
                                            />
                                        ))}
                                </RootItem>
                                {(!filter || layers.some((layer) => layer.layerId === null)) && (
                                    <RootItem
                                        name="No layer"
                                        selected={document.surfaceSelected ?? false}
                                        onClick={handleCanvasSelect}
                                        onDrop={(dragged) =>
                                            moveShapesToLayer({
                                                shapeIds: shapesOf(dragged),
                                                layerId: null
                                            })
                                        }
                                    >
                                        {layers
                                            .filter((layer) => layer.layerId === null)
                                            .map((layer) => (
                                                <ObjectContents
                                                    key="unlayered"
                                                    {...layer}
                                                    contextId="layers"
                                                />
                                            ))}
                                    </RootItem>
                                )}
                            </ul>
                        )}
                    </>
                ) : filter &&
                  !hasCanvasObjects &&
                  sources.length === 0 &&
                  shownFrames.length === 0 ? (
                    <p className={styles.empty}>No objects match</p>
                ) : (
                    <ul>
                        {(!filter || hasCanvasObjects || shownFrames.length > 0) && (
                            <RootItem
                                name="Canvas"
                                icon={<ObjectTypeSymbol type="surface" />}
                                selected={document.surfaceSelected ?? false}
                                onClick={handleCanvasSelect}
                                onDrop={(dragged) => moveIntoFrame(dragged, null)}
                            >
                                {shownFrames
                                    .filter(
                                        (frame) =>
                                            frame.parentFrameId === undefined &&
                                            !owners.get(frame.id)
                                    )
                                    .map((frame) => frameItem(frame))}
                                <ObjectContents {...scene} contextId="canvas" />
                            </RootItem>
                        )}
                        {screens.length > 0 && (
                            <RootItem name="Screens">
                                {screens
                                    .filter(
                                        (screen) =>
                                            !filter || screen.name.toLowerCase().includes(filter)
                                    )
                                    .map((screen) => (
                                        <ExplorerItem
                                            key={screen.id}
                                            kind="frame"
                                            name={screen.name}
                                            badge="Screen"
                                            icon={<FrameIcon size={16} aria-hidden="true" />}
                                            secondary={`${screen.viewCount} Screen ${screen.viewCount === 1 ? 'view' : 'views'}`}
                                            selected={selectedFrameId === screen.id}
                                            visible={screen.shown}
                                            onDrop={
                                                screen.locked || screen.inheritedLock
                                                    ? undefined
                                                    : (dragged) => moveIntoFrame(dragged, screen.id)
                                            }
                                            menuActions={[
                                                {
                                                    ...hideAction(!screen.visible, () =>
                                                        editFrame({
                                                            kind: 'toggle',
                                                            id: screen.id,
                                                            flag: 'visible'
                                                        })
                                                    ),
                                                    disabled: screen.inheritedLock
                                                },
                                                {
                                                    ...lockAction(screen.locked, () =>
                                                        editFrame({
                                                            kind: 'toggle',
                                                            id: screen.id,
                                                            flag: 'locked'
                                                        })
                                                    ),
                                                    disabled: screen.inheritedLock
                                                }
                                            ]}
                                            onClick={() =>
                                                editFrame({ kind: 'select', id: screen.id })
                                            }
                                        />
                                    ))}
                            </RootItem>
                        )}
                        {(!filter || sources.length > 0) && (
                            <RootItem scope="components" name="Components">
                                {sources.map(({ component, shapesIds }) => (
                                    <SourceItem
                                        key={component.id}
                                        componentId={component.id}
                                        shapesIds={shapesIds}
                                    >
                                        {shapesIds.map((shapeId) =>
                                            component.library ? (
                                                <ExplorerItem
                                                    key={shapeId}
                                                    kind={
                                                        component.sourceShapes?.[shapeId]?.type ===
                                                        'instance'
                                                            ? 'instance'
                                                            : 'shape'
                                                    }
                                                    name={
                                                        component.sourceShapes?.[shapeId]?.name ??
                                                        shapeId
                                                    }
                                                    icon={
                                                        component.sourceShapes?.[shapeId] && (
                                                            <ObjectTypeSymbol
                                                                type={
                                                                    component.sourceShapes[shapeId]
                                                                        .type
                                                                }
                                                            />
                                                        )
                                                    }
                                                />
                                            ) : (
                                                <ShapeItem
                                                    key={shapeId}
                                                    shapeId={shapeId}
                                                    sourceId={component.id}
                                                />
                                            )
                                        )}
                                    </SourceItem>
                                ))}
                            </RootItem>
                        )}
                    </ul>
                )}
            </section>
        </CollapsedItems.Provider>
    );
};
