import React, { FC } from 'react';
import styles from './styles.css';
import { Dragged, OutlineItem } from './OutlineItem';
import { commandAction, toggleAction } from '../ItemMenu';
import type { Command } from 'src/app/types';
import {
    BringToFrontCommand,
    CloneCommand,
    DeleteCommand,
    SendToBackCommand,
    UngroupCommand,
    UnlayerCommand
} from 'src/commands';
import {
    useActions,
    useControls,
    useGroup,
    useGroupSelected,
    useLayer,
    useOutline,
    useShape,
    useShapeLocked,
    useShownLayerId
} from 'src/app/hooks';

const hidden = (isHidden: boolean, onRun: () => void) =>
    toggleAction(
        'hide',
        isHidden,
        {
            on: { label: 'Show', icon: 'visibility_off' },
            off: { label: 'Hide', icon: 'visibility' }
        },
        onRun
    );

const locked = (isLocked: boolean, onRun: () => void) =>
    toggleAction(
        'lock',
        isLocked,
        {
            on: { label: 'Unlock', icon: 'lock_outline' },
            off: { label: 'Lock', icon: 'lock_open' }
        },
        onRun
    );

const useCommandActions = (shapeIds: string[], disabled: boolean) => {
    const { runCommandOn } = useActions();

    return (...commands: Command[]) =>
        commands.map((command) =>
            commandAction(
                command,
                () => runCommandOn({ shapeIds, commandId: command.id }),
                disabled
            )
        );
};

const ShapeItem: FC<{ shapeId: string }> = ({ shapeId }) => {
    const shape = useShape(shapeId);
    const { toggleShapeSelected, toggleShapeLocked, toggleShapeVisible } = useActions();
    const commands = useCommandActions([shapeId], useShapeLocked(shapeId) || !shape.visible);

    return (
        <OutlineItem
            kind="shape"
            name={shape.name}
            dragged={{ kind: 'shape', id: shapeId }}
            selected={shape.selected}
            active={shape.active}
            visible={shape.visible}
            onClick={() => toggleShapeSelected(shapeId)}
            menuActions={[
                hidden(!shape.visible, () => toggleShapeVisible(shapeId)),
                locked(shape.locked, () => toggleShapeLocked(shapeId))
            ]}
            moreMenuActions={commands(
                CloneCommand,
                DeleteCommand,
                BringToFrontCommand,
                SendToBackCommand
            )}
        />
    );
};

const GroupItem: FC<{ groupId: string; shapesIds: string[] }> = ({ groupId, shapesIds }) => {
    const group = useGroup(groupId);
    const selected = useGroupSelected(groupId);
    const { addShapesToGroup, toggleGroupSelected, toggleGroupLocked, toggleGroupVisible } =
        useActions();
    const commands = useCommandActions(group.shapesIds, group.locked);

    return (
        <OutlineItem
            kind="group"
            name={group.name}
            dragged={{ kind: 'group', id: groupId }}
            selected={selected}
            visible={group.visible}
            onClick={() => toggleGroupSelected(groupId)}
            menuActions={[
                hidden(!group.visible, () => toggleGroupVisible(groupId)),
                locked(group.locked, () => toggleGroupLocked(groupId))
            ]}
            moreMenuActions={commands(UngroupCommand, CloneCommand, DeleteCommand)}
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
        </OutlineItem>
    );
};

interface LayerProps {
    layerId: string | null;
    groups: { groupId: string; shapesIds: string[] }[];
    shapesIds: string[];
    /** The shapes a dragged shape or group stands for. */
    shapesOf: (dragged: Dragged) => string[];
}

const LayerContents: FC<Pick<LayerProps, 'groups' | 'shapesIds'>> = ({ groups, shapesIds }) => (
    <>
        {groups.map((group) => (
            <GroupItem key={group.groupId} {...group} />
        ))}
        {shapesIds.map((shapeId) => (
            <ShapeItem key={shapeId} shapeId={shapeId} />
        ))}
    </>
);

const LayerItem: FC<LayerProps & { layerId: string }> = ({
    layerId,
    groups,
    shapesIds,
    shapesOf
}) => {
    const layer = useLayer(layerId);
    const shown = useShownLayerId() === layerId;
    const { moveShapesToLayer, showOnlyLayer, toggleLayerLocked, toggleLayerVisible } =
        useActions();
    const commands = useCommandActions(layer.shapesIds, layer.locked);

    return (
        <OutlineItem
            kind="layer"
            name={layer.name}
            shown={shown}
            visible={layer.visible}
            onClick={() => showOnlyLayer(layerId)}
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
                hidden(!layer.visible, () => toggleLayerVisible(layerId)),
                locked(layer.locked, () => toggleLayerLocked(layerId)),
                ...commands(UnlayerCommand)
            ]}
            onDrop={(dragged) => moveShapesToLayer({ shapeIds: shapesOf(dragged), layerId })}
        >
            <LayerContents groups={groups} shapesIds={shapesIds} />
        </OutlineItem>
    );
};

/**
 * The document as a tree: layers, the groups on them and their shapes. Pressing
 * a layer's name shows only that layer on this screen; dragging a shape or a
 * group onto a layer or a group moves it there.
 */
export const Outline: FC = () => {
    const layers = useOutline();
    const shownLayerId = useShownLayerId();
    const { outline } = useControls();
    const { moveShapesToLayer, showAllLayers } = useActions();

    if (!outline.visible || layers.length === 0) {
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
        <section className={styles.outline} aria-label="Outline">
            <h3>Outline</h3>
            {shownLayerId && (
                <button type="button" className={styles.showAll} onClick={() => showAllLayers()}>
                    Show all layers
                </button>
            )}
            <ul>
                {layers.map(({ layerId, groups, shapesIds }) =>
                    layerId === null ? (
                        <OutlineItem
                            key="no-layer"
                            kind="layer"
                            name="No layer"
                            onDrop={(dragged) =>
                                moveShapesToLayer({ shapeIds: shapesOf(dragged), layerId: null })
                            }
                        >
                            <LayerContents groups={groups} shapesIds={shapesIds} />
                        </OutlineItem>
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
            </ul>
        </section>
    );
};
