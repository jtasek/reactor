import React, { createElement, type CSSProperties, type FC } from 'react';
import { componentSource, instanceBox } from 'src/app/componentSource';
import { projectScreenViews } from 'src/app/screenProjection';
import { themeColors } from 'src/app/themeColors';
import { boxCenter, getShapeBounds } from 'src/app/utils';
import { useAppState, useCurrentDocument, useVariableContext } from 'src/app/hooks';
import { isReadOnly } from 'src/app/documentAccess';
import type { Shape } from 'src/app/types';
import { getComponentByType } from 'src/tools/components';
import { Instance } from '../Shape/Instance';
import styles from './styles.css';

const ProjectedShape: FC<{
    shape: Shape;
    viewId: string;
    interactive: boolean;
}> = ({ shape, viewId, interactive }) => {
    const document = useCurrentDocument();
    const context = useVariableContext();
    const painted = themeColors(shape, document, context);
    const source =
        painted.type === 'instance' ? componentSource(document, painted.componentId) : null;
    const bounds =
        painted.type === 'instance' && source
            ? instanceBox(painted, source)
            : getShapeBounds(shape);
    const center = boxCenter(bounds);
    const transform = shape.rotation
        ? `rotate(${shape.rotation} ${center.x} ${center.y})`
        : undefined;
    const Primitive =
        painted.type === 'instance'
            ? null
            : (getComponentByType(painted.type) as FC<Omit<Shape, 'key'>>);
    const { key, ...props } = painted;

    return (
        <g
            data-screen-view={viewId}
            data-shape-id={shape.id}
            transform={transform}
            opacity={painted.opacity}
            style={
                {
                    '--shape-fill': painted.fill,
                    '--shape-stroke': painted.stroke
                } as CSSProperties
            }
        >
            {painted.type === 'instance' ? (
                <>
                    <Instance instance={painted} source={source} />
                    <rect
                        data-view-instance-hit
                        x={bounds.topLeft.x}
                        y={bounds.topLeft.y}
                        width={bounds.width}
                        height={bounds.height}
                        fill="transparent"
                    />
                </>
            ) : (
                Primitive && createElement(Primitive, { ...props, key, selected: false })
            )}
            {interactive && shape.selected && (
                <rect
                    x={bounds.topLeft.x}
                    y={bounds.topLeft.y}
                    width={bounds.width}
                    height={bounds.height}
                    fill="none"
                    stroke="var(--selection-color)"
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="none"
                />
            )}
        </g>
    );
};

const ScreenView: FC<{
    item: ReturnType<typeof projectScreenViews>[number];
    interactive: boolean;
    readOnly: boolean;
}> = ({ item, interactive, readOnly }) => {
    const { view, projection, problem } = item;

    if (!projection) {
        return (
            <g
                data-screen-view={view.id}
                pointerEvents={readOnly || !interactive ? 'none' : undefined}
            >
                {interactive && !readOnly && (
                    <rect
                        x={view.position.x}
                        y={view.position.y}
                        width={view.size.width}
                        height={view.size.height}
                        fill="transparent"
                    />
                )}
                {problem && (
                    <text x={view.position.x + 8} y={view.position.y + 20} className={styles.label}>
                        {problem}
                    </text>
                )}
            </g>
        );
    }

    const { screen, frames, shapes } = projection;

    return (
        <g
            aria-label={`View of ${screen.name}`}
            data-screen-view={view.id}
            pointerEvents={readOnly || !interactive ? 'none' : undefined}
        >
            {interactive && !readOnly && (
                <rect
                    x={view.position.x}
                    y={view.position.y}
                    width={view.size.width}
                    height={view.size.height}
                    fill="transparent"
                />
            )}
            {frames.map((frame) => (
                <g key={frame.id} pointerEvents="none">
                    <rect
                        className={styles.edge}
                        x={frame.position.x}
                        y={frame.position.y}
                        width={frame.size.width}
                        height={frame.size.height}
                    />
                    <text className={styles.label} x={frame.position.x} y={frame.position.y - 8}>
                        {frame.name}
                    </text>
                </g>
            ))}
            {shapes.map((shape) => (
                <ProjectedShape
                    key={shape.id}
                    shape={shape}
                    viewId={view.id}
                    interactive={interactive && !readOnly}
                />
            ))}
        </g>
    );
};

/** Optional placements of one screen share its source artwork and resolve layout per viewport. */
export const ScreenViews: FC<{ interactive?: boolean }> = ({ interactive = true }) => {
    const { items, readOnly } = useAppState((state) => ({
        items: state.currentDocument.editingComponentId
            ? []
            : projectScreenViews(state.currentDocument),
        readOnly: isReadOnly(state)
    }));

    return (
        <g id="screen-views">
            {items.map((item) => (
                <ScreenView
                    key={item.view.id}
                    item={item}
                    interactive={interactive}
                    readOnly={readOnly}
                />
            ))}
        </g>
    );
};
