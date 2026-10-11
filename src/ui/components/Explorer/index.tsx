import React, { FC, MouseEvent, useState } from 'react';
import styles from './styles.css';
import { CollapsedItems, Dragged, ExplorerItem } from './ExplorerItem';
import { SearchBoxContainer } from '../SearchBox';
import { hideAction, lockAction, toggleAction, useItemCommandActions } from '../ItemMenu';
import { Icon } from '../Icon';
import { ObjectTypeSymbol } from '../ObjectTypeSymbol';
import { SourceItem } from './SourceItem';
import { sceneLayers } from 'src/app/componentTree';
import { byDrawingOrder } from 'src/app/drawOrder';
import type { CommandScope } from 'src/app/types';
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
    useOutline,
    useShape,
    useShapeLocked,
    useShapesIds,
    useSourceSelected,
    useScopedCommands,
    useShownLayerId
} from 'src/app/hooks';

const RootItem: FC<{
    scope: Extract<CommandScope, 'layers' | 'components'>;
    name: string;
    children: React.ReactNode;
}> = ({ scope, name, children }) => {
    const commands = useScopedCommands(scope);
    const enabled = useCommandsEnabled(commands);
    const { runCommand } = useActions();

    return (
        <ExplorerItem
            kind="root"
            name={name}
            collapseId={`root:${scope}`}
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
                    <Icon icon={{ group: 'action', name: 'help', ...command.icon, size: 16 }} />
                </button>
            ))}
        >
            {children}
        </ExplorerItem>
    );
};

const ShapeItem: FC<{ shapeId: string; sourceId?: string }> = ({ shapeId, sourceId }) => {
    const shape = useShape(shapeId);
    const sourceSelected = useSourceSelected(sourceId ?? null);
    const {
        selectShape,
        unselectShapes,
        toggleShapeSelected,
        toggleShapeLocked,
        toggleShapeVisible,
        selectComponentChild
    } = useActions();
    const commands = useItemCommandActions([shapeId], useShapeLocked(shapeId) || !shape.visible);

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
            visible={shape.visible}
            onClick={handleSelect}
            menuActions={[
                hideAction(!shape.visible, () => toggleShapeVisible(shapeId)),
                lockAction(shape.locked, () => toggleShapeLocked(shapeId)),
                ...commands(useScopedCommands('shape'))
            ]}
        />
    );
};

const GroupItem: FC<{
    groupId: string;
    shapesIds: string[];
}> = ({ groupId, shapesIds }) => {
    const group = useGroup(groupId);
    const selected = useGroupSelected(groupId);
    const {
        addShapesToGroup,
        unselectShapes,
        toggleGroupSelected,
        toggleGroupLocked,
        toggleGroupVisible
    } = useActions();
    const commands = useItemCommandActions(group.shapesIds, group.locked);

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
            collapseId={groupId}
            selected={selected}
            visible={group.visible}
            onClick={handleSelect}
            menuActions={[
                hideAction(!group.visible, () => toggleGroupVisible(groupId)),
                lockAction(group.locked, () => toggleGroupLocked(groupId)),
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
    /** The shapes a dragged shape or group stands for. */
    shapesOf: (dragged: Dragged) => string[];
}

const LayerContents: FC<Pick<LayerProps, 'groups' | 'shapesIds'>> = ({ groups, shapesIds }) => {
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
                    <GroupItem key={item.id} groupId={item.id} shapesIds={item.shapesIds} />
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
            collapseId={groups.length + shapesIds.length > 0 ? layerId : undefined}
            shown={shown}
            selected={layer.selected}
            visible={layer.visible}
            onClick={() => selectExplorerLayer(layerId)}
            menuActions={[
                toggleAction(
                    'highlight',
                    shown,
                    {
                        on: { label: 'Show all layers', group: 'toggle', icon: 'star' },
                        off: { label: 'Highlight layer', group: 'toggle', icon: 'star_border' }
                    },
                    () => showOnlyLayer(layerId)
                ),
                hideAction(!layer.visible, () => toggleLayerVisible(layerId)),
                lockAction(layer.locked, () => toggleLayerLocked(layerId)),
                {
                    id: 'delete-layer',
                    label: 'Delete layer',
                    icon: { group: 'action', name: 'delete', size: 16 },
                    disabled: layer.locked || documentLocked,
                    onRun: () => removeLayer(layerId)
                },
                ...commands(useScopedCommands('layer'))
            ]}
            onDrop={(dragged) => moveShapesToLayer({ shapeIds: shapesOf(dragged), layerId })}
        >
            <LayerContents groups={groups} shapesIds={shapesIds} />
        </ExplorerItem>
    );
};

/** Scene layers and component definitions have separate, stable homes. */
export const Explorer: FC = () => {
    const { layers, found } = useOutline();
    const document = useCurrentDocument();
    const components = useComponents() ?? {};
    const filter = useDocumentFilter().trim().toLowerCase();
    const drawOrder = new Map(useShapesIds().map((id, index) => [id, index]));
    const scene = sceneLayers(found, document).filter(
        ({ layerId, groups, shapesIds }) =>
            !filter ||
            (layerId !== null && document.layers[layerId]?.name.toLowerCase().includes(filter)) ||
            groups.length > 0 ||
            shapesIds.length > 0
    );
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
    const handleSurfaceSelect = () => selectExplorerLayer(null);

    if (!explorer.visible) {
        return null;
    }

    const shapesOf = ({ kind, id }: Dragged) =>
        kind === 'shape'
            ? [id]
            : layers.flatMap(({ groups }) =>
                  groups
                      .filter(({ groupId }) => groupId === id)
                      .flatMap(({ shapesIds }) => shapesIds)
              );

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
                <SearchBoxContainer />
                {shownLayerId && (
                    <button
                        type="button"
                        className={styles.showAll}
                        onClick={() => showAllLayers()}
                    >
                        Show all layers
                    </button>
                )}
                {filter && scene.length === 0 && sources.length === 0 ? (
                    <p className={styles.empty}>No shapes match</p>
                ) : (
                    <ul>
                        {(!filter || scene.length > 0) && (
                            <RootItem scope="layers" name="Layers">
                                {scene.map(({ layerId, groups, shapesIds }) =>
                                    layerId === null ? (
                                        <ExplorerItem
                                            key="surface"
                                            kind="layer"
                                            name="Surface"
                                            icon={<ObjectTypeSymbol type="surface" />}
                                            selected={document.surfaceSelected ?? false}
                                            onClick={handleSurfaceSelect}
                                            collapseId={
                                                groups.length + shapesIds.length > 0
                                                    ? 'surface'
                                                    : undefined
                                            }
                                            onDrop={(dragged) =>
                                                moveShapesToLayer({
                                                    shapeIds: shapesOf(dragged),
                                                    layerId: null
                                                })
                                            }
                                        >
                                            <LayerContents groups={groups} shapesIds={shapesIds} />
                                        </ExplorerItem>
                                    ) : (
                                        <LayerItem
                                            key={layerId}
                                            layerId={layerId}
                                            groups={groups}
                                            shapesIds={shapesIds}
                                            shapesOf={shapesOf}
                                        />
                                    )
                                )}
                                {!filter && !scene.some(({ layerId }) => layerId === null) && (
                                    <ExplorerItem
                                        kind="layer"
                                        name="Surface"
                                        icon={<ObjectTypeSymbol type="surface" />}
                                        selected={document.surfaceSelected ?? false}
                                        onClick={handleSurfaceSelect}
                                        onDrop={(dragged) =>
                                            moveShapesToLayer({
                                                shapeIds: shapesOf(dragged),
                                                layerId: null
                                            })
                                        }
                                    />
                                )}
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
