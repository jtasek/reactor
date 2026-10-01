import React, { FC } from 'react';
import styles from './styles.css';
import { Dragged, OutlineItem } from './OutlineItem';
import {
    useActions,
    useControls,
    useGroup,
    useGroupSelected,
    useLayer,
    useOutline,
    useShape,
    useShownLayerId
} from 'src/app/hooks';

const ShapeItem: FC<{ shapeId: string }> = ({ shapeId }) => {
    const shape = useShape(shapeId);
    const { toggleShapeSelected, toggleShapeLocked, toggleShapeVisible } = useActions();

    return (
        <OutlineItem
            kind="shape"
            name={shape.name}
            dragged={{ kind: 'shape', id: shapeId }}
            selected={shape.selected}
            active={shape.active}
            locked={shape.locked}
            visible={shape.visible}
            onClick={() => toggleShapeSelected(shapeId)}
            onToggleLocked={() => toggleShapeLocked(shapeId)}
            onToggleVisible={() => toggleShapeVisible(shapeId)}
        />
    );
};

const GroupItem: FC<{ groupId: string; shapesIds: string[] }> = ({ groupId, shapesIds }) => {
    const group = useGroup(groupId);
    const selected = useGroupSelected(groupId);
    const { addShapesToGroup, toggleGroupSelected, toggleGroupLocked, toggleGroupVisible } =
        useActions();

    return (
        <OutlineItem
            kind="group"
            name={group.name}
            dragged={{ kind: 'group', id: groupId }}
            selected={selected}
            locked={group.locked}
            visible={group.visible}
            onClick={() => toggleGroupSelected(groupId)}
            onToggleLocked={() => toggleGroupLocked(groupId)}
            onToggleVisible={() => toggleGroupVisible(groupId)}
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

    return (
        <OutlineItem
            kind="layer"
            name={layer.name}
            shown={shown}
            locked={layer.locked}
            visible={layer.visible}
            onClick={() => showOnlyLayer(layerId)}
            onToggleLocked={() => toggleLayerLocked(layerId)}
            onToggleVisible={() => toggleLayerVisible(layerId)}
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
