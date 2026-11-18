import React, { type FC } from 'react';
import { TextEditor } from 'src/tools/components/Text';
import { SHAPE_PROPERTIES } from 'src/app/properties';
import { DEFAULT_TEXT_FONT_SIZE, getShapeBounds } from 'src/app/utils';
import type { Document, Shape } from 'src/app/types';

/** The field over a text shape as drawn, which changes the words of its authored shape. */
export const ShapeTextEditor: FC<{ shape: Shape; document: Document }> = ({ shape, document }) => {
    const authored = document.shapes[shape.id];

    if (shape.type !== 'text' || authored?.type !== 'text') {
        return null;
    }

    const fontSize = shape.fontSize ?? DEFAULT_TEXT_FONT_SIZE;

    return (
        <TextEditor
            shapeId={shape.id}
            position={shape.position}
            fontSize={fontSize}
            fontWeight={shape.fontWeight}
            width={Math.max(200, getShapeBounds(shape).width + fontSize * 4)}
            value={String(
                SHAPE_PROPERTIES.find((item) => item.key === 'text')?.read(authored, document) ??
                    shape.value
            )}
        />
    );
};
