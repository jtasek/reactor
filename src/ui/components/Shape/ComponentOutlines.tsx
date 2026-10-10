import React, { FC } from 'react';
import { useAppState } from 'src/app/hooks';
import { componentSource } from 'src/app/componentSource';

/** Names a source while one of its shapes is selected. */
export const ComponentOutlines: FC = () => {
    const outlines = useAppState((state) => {
        const document = state.currentDocument;

        return Object.values(document.components).flatMap((component) => {
            if (
                component.library ||
                !component.shapesIds.some((id) => document.shapes[id]?.selected)
            ) {
                return [];
            }
            const source = componentSource(document, component.id);

            return source ? [{ id: component.id, name: component.name, box: source.box }] : [];
        });
    });

    return (
        <g pointerEvents="none">
            {outlines.map(({ id, name, box }) => (
                <g key={id}>
                    <rect
                        x={box.topLeft.x}
                        y={box.topLeft.y}
                        width={box.width}
                        height={box.height}
                        fill="none"
                        stroke="var(--primary-action-color)"
                        strokeDasharray="5 4"
                    />
                    <text
                        x={box.topLeft.x}
                        y={box.topLeft.y - 6}
                        fill="var(--primary-action-color)"
                    >
                        {name}
                    </text>
                </g>
            ))}
        </g>
    );
};
