import {
    useFrameName,
    useScreenShapeTransformable,
    useScreenViewContainers
} from 'src/app/frameHooks';
import React, { createElement, memo, useMemo, type CSSProperties, type FC } from 'react';
import { instanceSource, instanceBox } from 'src/app/componentSource';
import { projectScreenViews } from 'src/app/screenProjection';
import { themeColors } from 'src/app/themeColors';
import { artworkModes } from 'src/app/modeHooks';
import { boxCenter, getShapeBounds } from 'src/app/utils';
import {
    useAppState,
    useGesture,
    useShapesInSelectedGroupsIds,
    useCameraScale
} from 'src/app/hooks';
import {
    canEditThroughView,
    componentScreenViews,
    componentScreenView,
    projectComponentView
} from 'src/app/screenViewEditing';
import type { Box, Frame, Point, Shape } from 'src/app/types';
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
            <Label shape={{ ...shape, selected: true }} />
        </>
    );
};

interface ProjectedShapeProps {
    shape: Shape;
    viewId: string;
    interactive: boolean;
    placedOffset: boolean;
    inSelectedContainer: boolean;
}

/** Selection changes update controls without rebuilding the component's artwork. */
const ProjectedSelection: FC<ProjectedShapeProps & { bounds: Box }> = ({
    shape,
    viewId,
    interactive,
    placedOffset,
    inSelectedContainer,
    bounds
}) => {
    const selected = useAppState((state) => state.currentDocument.shapes[shape.id]?.selected);

    if (!interactive || !selected || inSelectedContainer) {
        return null;
    }

    return (
        <>
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
            <ProjectedSelectionControls shape={shape} viewId={viewId} placedOffset={placedOffset} />
        </>
    );
};

const ProjectedShape = memo(
    function ProjectedShape({
        shape,
        viewId,
        interactive,
        placedOffset,
        inSelectedContainer
    }: ProjectedShapeProps) {
        const state = useAppState((state) => state);
        const document = state.currentDocument;
        const context = artworkModes(state, shape, viewId).modes;
        const painted = themeColors(shape, document, context);
        const source = painted.type === 'instance' ? instanceSource(document, painted) : null;
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
                <g opacity={painted.opacity} data-guide-outline="">
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
                <ProjectedSelection
                    shape={shape}
                    bounds={bounds}
                    viewId={viewId}
                    interactive={interactive}
                    placedOffset={placedOffset}
                    inSelectedContainer={inSelectedContainer}
                />
            </g>
        );
    },
    (previous, next) =>
        previous.viewId === next.viewId &&
        previous.interactive === next.interactive &&
        previous.placedOffset === next.placedOffset &&
        previous.inSelectedContainer === next.inSelectedContainer &&
        // Ordinary views reuse immutable geometry; focused editing still creates snapshots.
        (previous.shape === next.shape ||
            JSON.stringify(previous.shape) === JSON.stringify(next.shape))
);

/** Matches `.hit`'s stroke width in styles.css: a frame's edge grip, half of it inside. */
const FRAME_GRIP_WIDTH_PX = 12;

/**
 * Where an editable View takes presses: its viewport, less the inner half of its
 * own edge grip, which is drawn underneath and must still move the View.
 */
const ViewHitArea: FC<{ view: Frame; position: Point }> = ({ view, position }) => {
    const scale = useCameraScale();
    const inset = FRAME_GRIP_WIDTH_PX / 2 / scale;

    return (
        <rect
            x={position.x + inset}
            y={position.y + inset}
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
    relative: boolean;
}> = ({ item, editable, focused, relative }) => {
    const { view, projection, problem } = item;
    const name = useFrameName(view.id);
    const position = relative ? VIEW_ORIGIN : view.position;
    const selections = useScreenViewContainers(view.id, projection, editable);
    const contained = new Set(selections.flatMap((selection) => selection.shapeIds));

    const frameOutlines = useMemo(
        () =>
            projection?.frames.map((frame) => (
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
            )),
        [projection?.frames]
    );

    if (!projection) {
        // Nothing here can be edited, so presses reach the canvas underneath.
        return problem ? (
            <ScreenViewPlacement id={view.id} relative={relative} name={name} editable={false}>
                <text
                    x={position.x + 8}
                    y={position.y + 20}
                    className={styles.label}
                    pointerEvents="none"
                >
                    {problem}
                </text>
            </ScreenViewPlacement>
        ) : null;
    }

    const { shapes, layoutOffsets } = projection;

    return (
        <ScreenViewPlacement id={view.id} relative={relative} name={name} editable={editable}>
            {editable && <ViewHitArea view={view} position={position} />}
            {focused && (
                <g pointerEvents="none">
                    <rect
                        className={styles.edge}
                        x={position.x}
                        y={position.y}
                        width={view.size.width}
                        height={view.size.height}
                    />
                    <text className={styles.label} x={position.x} y={position.y - 8}>
                        {name}
                    </text>
                </g>
            )}
            {problem && (
                <text
                    x={position.x + 8}
                    y={position.y + 20}
                    className={styles.label}
                    pointerEvents="none"
                >
                    {problem}
                </text>
            )}
            {frameOutlines}
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
        </ScreenViewPlacement>
    );
};

const VIEW_ORIGIN: Point = { x: 0, y: 0 };

/** Only this wrapper tracks placement; its content keeps the same layout while dragged. */
const ScreenViewPlacement: FC<{
    id: string;
    relative: boolean;
    name: string;
    editable: boolean;
    children: React.ReactNode;
}> = ({ id, relative, name, editable, children }) => {
    const position = useAppState((state) =>
        relative ? state.currentDocument.frames[id]?.position : null
    );

    return (
        <g
            aria-label={`Screen view ${name}`}
            data-screen-view={editable ? id : undefined}
            pointerEvents={editable ? undefined : 'none'}
            transform={position ? `translate(${position.x} ${position.y})` : undefined}
        >
            {children}
        </g>
    );
};

/** Optional placements of one screen share its source artwork and resolve layout per viewport. */
export const ScreenViews: FC<{ interactive?: boolean }> = ({ interactive = true }) => {
    const items = useAppState((state) => {
        if (state.currentDocument.editingComponentId && !state.events.pointer.screenView) {
            return [];
        }
        // Focused component controls use absolute canvas coordinates. Ordinary view
        // content is local to its SVG placement and does not depend on drag position.
        const relative = !state.currentDocument.editingComponentId;
        const views = componentScreenViews(state, relative ? VIEW_ORIGIN : undefined);
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
                      relative,
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
            {items.map(({ item, editable, focused, relative }) => (
                <ScreenView
                    key={item.view.id}
                    item={item}
                    editable={editable}
                    focused={focused}
                    relative={relative}
                />
            ))}
        </g>
    );
};
