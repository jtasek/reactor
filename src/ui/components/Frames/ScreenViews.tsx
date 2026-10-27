import {
    useFrameName,
    useScreenShapeTransformable,
    useScreenViewContainers
} from 'src/app/frameHooks';
import React, { createElement, type CSSProperties, type FC } from 'react';
import { componentSource, instanceBox } from 'src/app/componentSource';
import { projectScreenViews } from 'src/app/screenProjection';
import { themeColors } from 'src/app/themeColors';
import { useArtworkModes } from 'src/app/modeHooks';
import { boxCenter, getShapeBounds } from 'src/app/utils';
import {
    useAppState,
    useGesture,
    useShapesInSelectedGroupsIds,
    useCameraScale,
    useCurrentDocument
} from 'src/app/hooks';
import {
    canEditThroughView,
    componentScreenViews,
    componentScreenView,
    projectComponentView
} from 'src/app/screenViewEditing';
import type { Frame, Shape } from 'src/app/types';
import { getComponentByType } from 'src/tools/components';
import { Label } from '../Label';
import { Handles } from '../Selectable/Resizable';
import { Instance } from '../Shape/Instance';
import { ScreenViewContainerSelection } from './ScreenViewContainerSelection';
import styles from './styles.css';

const ProjectedSelectionControls: FC<{ shape: Shape; viewId: string; placedOffset: boolean }> = ({
    shape,
    viewId,
    placedOffset
}) => {
    const editable = useScreenShapeTransformable(viewId, shape.id, placedOffset);
    const grouped = useShapesInSelectedGroupsIds();
    const gesture = useGesture();
    const ownsGesture = 'screenView' in gesture && gesture.screenView?.address.viewId === viewId;

    if (grouped.includes(shape.id)) {
        return null;
    }

    return (
        <>
            {editable && (
                <Handles
                    box={getShapeBounds(shape)}
                    rotation={shape.rotation ?? 0}
                    owner={{ shapeId: shape.id }}
                    activeHandle={
                        ownsGesture && gesture.kind === 'resizing' && gesture.shapeId === shape.id
                            ? gesture.handle
                            : undefined
                    }
                    rotateActive={
                        ownsGesture && gesture.kind === 'rotating' && gesture.shapeId === shape.id
                    }
                    resizeHandles={shape.type !== 'instance'}
                />
            )}
            <Label shape={shape} />
        </>
    );
};

const ProjectedShape: FC<{
    shape: Shape;
    viewId: string;
    interactive: boolean;
    placedOffset: boolean;
    inSelectedContainer: boolean;
}> = ({ shape, viewId, interactive, placedOffset, inSelectedContainer }) => {
    const document = useCurrentDocument();
    const context = useArtworkModes(shape, viewId);
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
            style={
                {
                    '--shape-fill': painted.fill,
                    '--shape-stroke': painted.stroke
                } as CSSProperties
            }
        >
            <g opacity={painted.opacity}>
                {painted.type === 'instance' ? (
                    <>
                        <Instance instance={painted} source={source} context={context} />
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
            </g>
            {interactive && shape.selected && !inSelectedContainer && (
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
            {interactive && shape.selected && !inSelectedContainer && (
                <ProjectedSelectionControls
                    shape={shape}
                    viewId={viewId}
                    placedOffset={placedOffset}
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
    focused: boolean;
}> = ({ item, editable, focused }) => {
    const { view, projection, problem } = item;
    const name = useFrameName(view.id);
    const selections = useScreenViewContainers(view.id, projection, editable);
    const contained = new Set(selections.flatMap((selection) => selection.shapeIds));

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

    const { frames, shapes, layoutOffsets } = projection;

    return (
        <g
            aria-label={`Screen view ${name}`}
            data-screen-view={editable ? view.id : undefined}
            pointerEvents={editable ? undefined : 'none'}
        >
            {editable && <ViewHitArea view={view} />}
            {focused && (
                <g pointerEvents="none">
                    <rect
                        className={styles.edge}
                        x={view.position.x}
                        y={view.position.y}
                        width={view.size.width}
                        height={view.size.height}
                    />
                    <text className={styles.label} x={view.position.x} y={view.position.y - 8}>
                        {name}
                    </text>
                </g>
            )}
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
                    placedOffset={layoutOffsets.has(shape.id)}
                    inSelectedContainer={contained.has(shape.id)}
                />
            ))}
            {selections.map((selection) => (
                <ScreenViewContainerSelection
                    key={
                        'groupId' in selection.owner
                            ? `group:${selection.owner.groupId}`
                            : `component:${selection.owner.componentId}`
                    }
                    {...selection}
                    viewId={view.id}
                />
            ))}
        </g>
    );
};

/** Optional placements of one screen share its source artwork and resolve layout per viewport. */
export const ScreenViews: FC<{ interactive?: boolean }> = ({ interactive = true }) => {
    const items = useAppState((state) => {
        if (state.currentDocument.editingComponentId && !state.events.pointer.screenView) {
            return [];
        }
        const views = componentScreenViews(state);
        const focused = componentScreenView(state, views) !== null;

        return state.currentDocument.editingComponentId && !focused
            ? []
            : views.map((item) => {
                  const component =
                      focused && item.projection
                          ? projectComponentView(state, item.projection)
                          : null;

                  return {
                      item:
                          component && item.projection
                              ? {
                                    ...item,
                                    projection: {
                                        ...item.projection,
                                        componentRotation: component.transform.rotation,
                                        shapes: [
                                            ...item.projection.shapes.filter(
                                                (shape) =>
                                                    shape.id !== component.transform.instanceId
                                            ),
                                            ...component.shapes
                                        ]
                                    }
                                }
                              : item,
                      focused,
                      // A locked, hidden or read-only View lets presses through, as before.
                      editable:
                          interactive &&
                          item.projection !== null &&
                          canEditThroughView(state, item.view.id)
                  };
              });
    });

    return (
        <g id="screen-views">
            {items.map(({ item, editable, focused }) => (
                <ScreenView key={item.view.id} item={item} editable={editable} focused={focused} />
            ))}
        </g>
    );
};
