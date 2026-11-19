import React, { type FC } from 'react';
import { sidesOf, withSides } from 'src/app/boxModel';
import { useActions, useCurrentDocument } from 'src/app/hooks';
import { isShapeLocked } from 'src/app/utils';
import { shapeGroup } from 'src/app/membership';
import { PropertyGroup } from './PropertyGroup';
import { SpacingRow, shownSides } from './SpacingFields';

/**
 * The margin of the selected shapes; a stack keeps it clear around each of them.
 * Shown while one of them is in a stack or has a margin.
 */
export const ShapeSpacing: FC<{ shapeIds: string[] }> = ({ shapeIds }) => {
    const document = useCurrentDocument();
    const { applyOperations } = useActions();
    const shapes = shapeIds.map((id) => document.shapes[id]).filter(Boolean);
    const editable = shapes.filter((shape) => !isShapeLocked(document, shape.id));

    // Margin only acts on a stack's own items, so other shapes show it once they have one.
    if (
        !shapes.some(
            (shape) =>
                shape.margin ||
                (document.frames[shape.parentFrameId ?? '']?.stack &&
                    !shapeGroup(document, shape.id))
        )
    ) {
        return null;
    }

    return (
        <PropertyGroup name="Spacing">
            <SpacingRow
                key={shapeIds.join()}
                box="margin"
                hint="Space kept clear around it in a stack, added to the gap and padding. Drag the bands on the canvas to change it."
                value={shownSides(shapes.map((shape) => sidesOf(shape.margin)))}
                disabled={Boolean(document.locked) || editable.length === 0}
                onChange={(changes) =>
                    applyOperations({
                        documentId: document.id,
                        by: { kind: 'person' },
                        operations: editable.map((shape) => ({
                            op: 'updateShape' as const,
                            shape: shape.id,
                            changes: { margin: withSides(shape.margin, changes) ?? null }
                        }))
                    })
                }
            />
        </PropertyGroup>
    );
};
