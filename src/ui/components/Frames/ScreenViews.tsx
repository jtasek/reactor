import { useFrameName } from 'src/app/frameHooks';
import React, { createElement, type CSSProperties, type FC } from 'react';
import { componentSource, instanceBox } from 'src/app/componentSource';
import { projectScreenViews } from 'src/app/screenProjection';
import { themeColors } from 'src/app/themeColors';
import { boxCenter, getShapeBounds } from 'src/app/utils';
import { useAppState, useCameraScale, useCurrentDocument, useVariableContext } from 'src/app/hooks';
import { canEditThroughView } from 'src/app/screenViewEditing';
import type { Frame, Shape } from 'src/app/types';
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

/** Matches `.hit`'s stroke width in styles.css: a frame's edge grip, half of it inside. */
const FRAME_GRIP_WIDTH_PX = 12;

/**
 * Where an editable View takes presses: its viewport, less the inner half of its
 * own edge grip, which is drawn underneath and must still move the View.
 */
const ViewHitArea: FC<{ view: Frame }> = ({ view }) => {
    const scale = useCameraScale();
    const inset = FRAME_GRIP_WIDTH_PX / 2 / scale;

    return (
        <rect
            x={view.position.x + inset}
            y={view.position.y + inset}
            width={Math.max(0, view.size.width - 2 * inset)}
            height={Math.max(0, view.size.height - 2 * inset)}
            fill="transparent"
        />
    );
};

const ScreenView: FC<{
    item: ReturnType<typeof projectScreenViews>[number];
    editable: boolean;
}> = ({ item, editable }) => {
    const { view, projection, problem } = item;
    const name = useFrameName(view.id);

    if (!projection) {
        // Nothing here can be edited, so presses reach the canvas underneath.
        return problem ? (
            <text
                x={view.position.x + 8}
                y={view.position.y + 20}
                className={styles.label}
                pointerEvents="none"
            >
                {problem}
            </text>
        ) : null;
    }

    const { frames, shapes } = projection;

    return (
        <g
            aria-label={`Screen view ${name}`}
            data-screen-view={editable ? view.id : undefined}
            pointerEvents={editable ? undefined : 'none'}
        >
            {editable && <ViewHitArea view={view} />}
            {problem && (
                <text
                    x={view.position.x + 8}
                    y={view.position.y + 20}
                    className={styles.label}
                    pointerEvents="none"
                >
                    {problem}
                </text>
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
                    interactive={editable}
                />
            ))}
        </g>
    );
};

/** Optional placements of one screen share its source artwork and resolve layout per viewport. */
export const ScreenViews: FC<{ interactive?: boolean }> = ({ interactive = true }) => {
    const items = useAppState((state) =>
        state.currentDocument.editingComponentId
            ? []
            : projectScreenViews(state.currentDocument).map((item) => ({
                  item,
                  // A locked, hidden or read-only View lets presses through, as before.
                  editable:
                      interactive &&
                      item.projection !== null &&
                      canEditThroughView(state, item.view.id)
              }))
    );

    return (
        <g id="screen-views">
            {items.map(({ item, editable }) => (
                <ScreenView key={item.view.id} item={item} editable={editable} />
            ))}
        </g>
    );
};
