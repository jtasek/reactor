import React from 'react';
import { NavBarList } from './NavBarList';
import { NavBarListItem } from './NavBarListItem';
import { useActions, useShape, useShapesIds } from 'src/app/hooks';

const ShapesListItem = ({ shapeId }: { shapeId: string }) => {
    const shape = useShape(shapeId);
    const { toggleShapeSelected, toggleShapeLocked, toggleShapeVisible } = useActions();

    return (
        <NavBarListItem
            key={shapeId}
            id={shapeId}
            name={shape.name}
            selected={shape.selected}
            active={shape.active}
            locked={shape.locked}
            visible={shape.visible}
            onClick={toggleShapeSelected}
            onToggleLocked={toggleShapeLocked}
            onToggleVisible={toggleShapeVisible}
        />
    );
};

export const ShapesList = () => {
    const shapesIds = useShapesIds();

    if (shapesIds.length === 0) {
        return null;
    }

    return (
        <NavBarList name="Shapes">
            {shapesIds.map((shapeId: string) => (
                <ShapesListItem key={shapeId} shapeId={shapeId} />
            ))}
        </NavBarList>
    );
};
