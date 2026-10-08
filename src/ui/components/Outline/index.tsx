import React, { FC } from 'react';
import styles from './styles.css';
import { Dragged, OutlineItem } from './OutlineItem';
import { SearchBoxContainer } from '../SearchBox';
import { hideAction, lockAction, toggleAction, useItemCommandActions } from '../ItemMenu';
import {
    useActions,
    useControls,
    useGroup,
    useGroupSelected,
    useLayer,
    useOutline,
    useShape,
    useShapeLocked,
    useScopedCommands,
    useShownLayerId
} from 'src/app/hooks';

const ShapeItem: FC<{ shapeId: string }> = ({ shapeId }) => {
    const shape = useShape(shapeId);
    const { toggleShapeSelected, toggleShapeLocked, toggleShapeVisible } = useActions();
    const commands = useItemCommandActions([shapeId], useShapeLocked(shapeId) || !shape.visible);

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
                hideAction(!shape.visible, () => toggleShapeVisible(shapeId)),
                lockAction(shape.locked, () => toggleShapeLocked(shapeId)),
                ...commands(useScopedCommands('shape'))
            ]}
        />
    );
};

const GroupItem: FC<{ groupId: string; shapesIds: string[] }> = ({ groupId, shapesIds }) => {
    const group = useGroup(groupId);
    const selected = useGroupSelected(groupId);
    const { addShapesToGroup, toggleGroupSelected, toggleGroupLocked, toggleGroupVisible } =
        useActions();
    const commands = useItemCommandActions(group.shapesIds, group.locked);

    return (
        <OutlineItem
            kind="group"
            name={group.name}
            dragged={{ kind: 'group', id: groupId }}
            selected={selected}
            visible={group.visible}
            onClick={() => toggleGroupSelected(groupId)}
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
    const commands = useItemCommandActions(layer.shapesIds, layer.locked);

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
                hideAction(!layer.visible, () => toggleLayerVisible(layerId)),
                lockAction(layer.locked, () => toggleLayerLocked(layerId)),
                ...commands(useScopedCommands('layer'))
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
    const { layers, found } = useOutline();
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
            <SearchBoxContainer />
            {shownLayerId && (
                <button type="button" className={styles.showAll} onClick={() => showAllLayers()}>
                    Show all layers
                </button>
            )}
            {found.length === 0 ? (
                <p>No shapes match</p>
            ) : (
                <ul>
                    {found.map(({ layerId, groups, shapesIds }) =>
                        layerId === null ? (
                            <OutlineItem
                                key="no-layer"
                                kind="layer"
                                name="No layer"
                                onDrop={(dragged) =>
                                    moveShapesToLayer({
                                        shapeIds: shapesOf(dragged),
                                        layerId: null
                                    })
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
            )}
        </section>
    );
};
