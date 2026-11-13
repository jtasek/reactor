import { screenOwners, screenSourceShapes, screenViewName } from 'src/app/screenViews';
import { layoutDocument } from 'src/app/frameLayout';
import { projectContextualLayout } from 'src/app/contextualLayout';
import { projectScreen, projectScreenViews } from 'src/app/screenProjection';
import React, { FC, ReactNode, memo, useEffect, useLayoutEffect, useRef } from 'react';
import { useVariableContext } from 'src/app/hooks';
import { frameVisibility } from 'src/app/frameState';
import { themeColors } from 'src/app/themeColors';
import { SquareDashed } from 'lucide-react';
import type { Box, Document, Image, InstanceShape, Shape, VariableContext } from 'src/app/types';
import { instanceModes, resolveModes } from 'src/app/inheritedModes';
import { applyInstanceOverrides } from 'src/app/componentProps';
import { instanceComponent, instanceSource, instanceBox } from 'src/app/componentSource';
import { drawnBox, shownShapesIds } from 'src/app/membership';
import {
    assertNever,
    boxCenter,
    DEFAULT_TEXT_FONT_SIZE,
    getShapeBounds,
    rectToBox
} from 'src/app/utils';
import { useImageUrl } from 'src/app/imageHooks';
import styles from './styles.css';

/** The size of the mark drawn for an instance whose component is missing. */
const MISSING_INSTANCE_SIZE = 24;
const FRAME_LABEL_OFFSET = 8;
/** How far the marked changes' outline sits outside them, as a share of their size. */
const CHANGE_OUTLINE_MARGIN = 0.04;
/** How much surrounding artwork a view fitted to the changes keeps, as a share of their size. */
const CHANGE_CONTEXT = 0.75;
const MIN_CHANGE_CONTEXT = 48;

/** Draws `children` marked as changed, so the outline and fitting can find them. */
const Marked: FC<{ changed: boolean; children: ReactNode }> = ({ changed, children }) =>
    changed ? <g data-changed="">{children}</g> : <>{children}</>;

function unionBox(boxes: DOMRect[]) {
    const left = Math.min(...boxes.map((box) => box.x));
    const top = Math.min(...boxes.map((box) => box.y));
    const right = Math.max(...boxes.map((box) => box.x + box.width));
    const bottom = Math.max(...boxes.map((box) => box.y + box.height));

    return rectToBox({ x: left, y: top, width: right - left, height: bottom - top });
}

function grow(box: Box, share: number, minimum = 0): Box {
    const margin = Math.max(minimum, Math.max(box.width, box.height) * share);

    return rectToBox({
        x: box.topLeft.x - margin,
        y: box.topLeft.y - margin,
        width: box.width + margin * 2,
        height: box.height + margin * 2
    });
}

const imageFallback = (shape: Image) => (
    <rect
        x={shape.position.x}
        y={shape.position.y}
        width={shape.size.width}
        height={shape.size.height}
        fill="var(--field-background)"
        stroke="var(--text-color)"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
    />
);

const PreviewImage: FC<{ shape: Image; documentId: string }> = ({ shape, documentId }) => {
    const url = useImageUrl(shape.source, documentId);

    if (!url) {
        return imageFallback(shape);
    }

    return (
        <image
            x={shape.position.x}
            y={shape.position.y}
            width={shape.size.width}
            height={shape.size.height}
            href={url}
            preserveAspectRatio="xMidYMid meet"
        />
    );
};

function previewBox(document: Document, shape: Shape): Box {
    if (shape.type !== 'instance' || shape.bounds) {
        return drawnBox(shape);
    }

    const source = instanceSource(document, shape);
    const bounds = source
        ? instanceBox(shape, source)
        : rectToBox({
              x: shape.position.x,
              y: shape.position.y,
              width: MISSING_INSTANCE_SIZE,
              height: MISSING_INSTANCE_SIZE
          });

    return drawnBox({ ...shape, bounds });
}

function paddedViewBox(box: Box): string {
    const { topLeft, width, height } = box;
    const padding = Math.max(16, Math.max(width, height) * 0.12);

    return `${topLeft.x - padding} ${topLeft.y - padding} ${width + padding * 2} ${height + padding * 2}`;
}

const PreviewInstance: FC<{
    document: Document;
    shape: InstanceShape;
    ancestors: ReadonlySet<string>;
    context: VariableContext;
}> = ({ document, shape, ancestors, context: theme }) => {
    const source = instanceSource(document, shape, ancestors);

    if (!source) {
        return (
            <rect
                x={shape.position.x}
                y={shape.position.y}
                width={MISSING_INSTANCE_SIZE}
                height={MISSING_INSTANCE_SIZE}
                fill="none"
                stroke="var(--text-color)"
                strokeDasharray="4 3"
                vectorEffect="non-scaling-stroke"
            />
        );
    }

    const component = instanceComponent(document, shape);
    const nextAncestors = new Set(ancestors).add(component?.id ?? shape.componentId);
    const offsetX = shape.position.x - source.box.topLeft.x;
    const offsetY = shape.position.y - source.box.topLeft.y;

    return (
        <g transform={`translate(${offsetX} ${offsetY})`}>
            {source.shapes.map((member) => {
                const painted = themeColors(member, document, theme);
                const resolved =
                    component && !shape.projectedSource
                        ? applyInstanceOverrides(painted, shape, component, document, theme)
                        : painted;

                if (!resolved.visible) {
                    return null;
                }

                return (
                    <PreviewShape
                        key={member.id}
                        document={document}
                        shape={resolved}
                        themed
                        context={theme}
                        ancestors={nextAncestors}
                    />
                );
            })}
        </g>
    );
};

function geometry(
    document: Document,
    shape: Shape,
    ancestors: ReadonlySet<string>,
    context: VariableContext
): ReactNode {
    const outline = {
        fill: shape.fill ?? 'none',
        stroke: shape.stroke ?? 'var(--text-color)',
        strokeWidth: 1,
        vectorEffect: 'non-scaling-stroke' as const
    };

    switch (shape.type) {
        case 'rectangle':
            return (
                <rect
                    x={shape.position.x}
                    y={shape.position.y}
                    width={shape.size.width}
                    height={shape.size.height}
                    rx={Math.min(
                        shape.cornerRadius ?? 0,
                        shape.size.width / 2,
                        shape.size.height / 2
                    )}
                    {...outline}
                />
            );
        case 'circle':
            return (
                <circle cx={shape.position.x} cy={shape.position.y} r={shape.radius} {...outline} />
            );
        case 'ellipse':
            return (
                <ellipse
                    cx={shape.position.x}
                    cy={shape.position.y}
                    rx={shape.radius.x}
                    ry={shape.radius.y}
                    {...outline}
                />
            );
        case 'line':
            return (
                <line
                    x1={shape.start.x}
                    y1={shape.start.y}
                    x2={shape.end.x}
                    y2={shape.end.y}
                    {...outline}
                />
            );
        case 'pen':
            return (
                <polyline
                    points={shape.points.map(({ x, y }) => `${x},${y}`).join(' ')}
                    {...outline}
                />
            );
        case 'text':
            return (
                <text
                    x={shape.position.x}
                    y={shape.position.y}
                    fontSize={shape.fontSize ?? DEFAULT_TEXT_FONT_SIZE}
                    fontWeight={shape.fontWeight}
                    fill={shape.fontColor ?? 'var(--text-color)'}
                >
                    {shape.textLayout
                        ? shape.textLayout.lines.map((line, index) => (
                              <tspan
                                  key={index}
                                  x={shape.position.x}
                                  y={shape.position.y + index * shape.textLayout!.lineHeight}
                              >
                                  {line}
                              </tspan>
                          ))
                        : shape.value}
                </text>
            );
        case 'image':
            return <PreviewImage shape={shape} documentId={document.id} />;
        case 'instance':
            return (
                <PreviewInstance
                    document={document}
                    shape={shape}
                    ancestors={ancestors}
                    context={context}
                />
            );
        default:
            return assertNever(shape);
    }
}

const PreviewShape: FC<{
    themed?: boolean;
    document: Document;
    shape: Shape;
    ancestors: ReadonlySet<string>;
    context?: VariableContext;
    viewId?: string;
}> = ({ document, shape, ancestors, themed = false, context, viewId }) => {
    const simulation = useVariableContext(document.id);
    const inherited =
        context ??
        resolveModes(document, { simulation, viewId, frameId: shape.parentFrameId }).modes;
    const theme = shape.type === 'instance' ? instanceModes(document, inherited, shape) : inherited;
    const painted = themed ? shape : themeColors(shape, document, theme);
    const bounds = shape.type === 'instance' ? previewBox(document, shape) : getShapeBounds(shape);
    const center = boxCenter(bounds);
    const transform = shape.rotation
        ? `rotate(${shape.rotation} ${center.x} ${center.y})`
        : undefined;

    return (
        <g opacity={shape.opacity} transform={transform}>
            {geometry(document, painted, ancestors, theme)}
        </g>
    );
};

export interface ThumbnailChanges {
    /** What to outline: the IDs of added or changed shapes and frames. */
    ids: ReadonlySet<string>;
    /** Where deleted items were. */
    removed: Box[];
}

export const DocumentThumbnail: FC<{
    document: Document;
    /** Outlines these changes. */
    changes?: ThumbnailChanges;
    /** Fits the view to the outlined changes, with some artwork around them, instead of everything. */
    fitChanges?: boolean;
}> = ({ document: sourceDocument, changes, fitChanges = false }) => {
    const simulation = useVariableContext(sourceDocument.id);
    const document = layoutDocument(
        sourceDocument,
        projectContextualLayout(sourceDocument, { simulation })
    );
    const svgRef = useRef<SVGSVGElement>(null);
    const contentRef = useRef<SVGGElement>(null);
    const outlineRef = useRef<SVGRectElement>(null);
    const fitChangesRef = useRef(fitChanges);
    fitChangesRef.current = fitChanges;
    const changed = (id: string) => changes?.ids.has(id) ?? false;
    const shown = shownShapesIds({ ...document, shownLayerId: undefined }, null);
    const sourceShapes = screenSourceShapes(document);
    const shapes = document.shapesIds
        .filter((id) => shown.has(id) && !sourceShapes.has(id))
        .map((id) => document.shapes[id]);

    /**
     * Fits the view to what is drawn. An SVG that is not displayed yet, such as one
     * in a dialog about to open, measures as empty, so it is measured again once shown.
     */
    const measure = () => {
        const content = contentRef.current;
        const outline = outlineRef.current;

        if (!content) {
            return;
        }

        try {
            const drawn = content.getBBox();

            if (drawn.width === 0 && drawn.height === 0) {
                return;
            }

            const marked = [...content.querySelectorAll<SVGGraphicsElement>('[data-changed]')]
                .map((element) => element.getBBox())
                .filter((box) => box.width > 0 || box.height > 0);
            const changedBox = marked.length > 0 ? unionBox(marked) : undefined;

            if (outline) {
                if (changedBox) {
                    const ring = grow(changedBox, CHANGE_OUTLINE_MARGIN, 2);
                    outline.setAttribute('x', String(ring.topLeft.x));
                    outline.setAttribute('y', String(ring.topLeft.y));
                    outline.setAttribute('width', String(ring.width));
                    outline.setAttribute('height', String(ring.height));
                    outline.removeAttribute('visibility');
                } else {
                    outline.setAttribute('visibility', 'hidden');
                }
            }

            const fitted =
                fitChangesRef.current && changedBox
                    ? grow(changedBox, CHANGE_CONTEXT, MIN_CHANGE_CONTEXT)
                    : rectToBox(drawn);
            svgRef.current?.setAttribute('viewBox', paddedViewBox(fitted));
        } catch {
            // An SVG that is not yet renderable has no measurable box.
        }
    };
    const measureRef = useRef(measure);
    measureRef.current = measure;

    useLayoutEffect(measure);
    useEffect(() => {
        const svg = svgRef.current;

        if (!svg || typeof ResizeObserver === 'undefined') {
            return;
        }

        const observer = new ResizeObserver(() => measureRef.current());
        observer.observe(svg);

        return () => observer.disconnect();
    });

    const owners = screenOwners(document.frames);
    const visible = frameVisibility(document);
    const frames = Object.values(document.frames).filter(
        (frame) => !owners.get(frame.id) && visible(frame.id)
    );
    const views = projectScreenViews(sourceDocument, simulation).flatMap(({ view, projection }) =>
        projection ? [{ ...projection, viewId: view.id }] : []
    );

    if (shapes.length === 0 && frames.length === 0) {
        return (
            <div className={styles.thumbnailEmpty}>
                <SquareDashed size={20} strokeWidth={1.5} aria-hidden="true" />
                <span>Empty canvas</span>
            </div>
        );
    }

    const boxes = [
        ...shapes.map((shape) => previewBox(document, shape)),
        ...frames.map((frame) => rectToBox({ ...frame.position, ...frame.size }))
    ];
    const left = Math.min(...boxes.map((box) => box.topLeft.x));
    const top = Math.min(...boxes.map((box) => box.topLeft.y));
    const right = Math.max(...boxes.map((box) => box.bottomRight.x));
    const bottom = Math.max(...boxes.map((box) => box.bottomRight.y));
    const initialBox = rectToBox({ x: left, y: top, width: right - left, height: bottom - top });

    return (
        <svg
            ref={svgRef}
            className={styles.thumbnailSvg}
            role="img"
            aria-label={`Preview of ${document.name}`}
            viewBox={paddedViewBox(initialBox)}
            preserveAspectRatio="xMidYMid meet"
        >
            <g ref={contentRef}>
                {frames.map((frame) => (
                    <g key={frame.id} {...(changed(frame.id) ? { 'data-changed': '' } : {})}>
                        <rect
                            x={frame.position.x}
                            y={frame.position.y}
                            width={frame.size.width}
                            height={frame.size.height}
                            fill="none"
                            stroke="var(--text-secondary-color)"
                            vectorEffect="non-scaling-stroke"
                        />
                        <text
                            x={frame.position.x}
                            y={frame.position.y - FRAME_LABEL_OFFSET}
                            fill="var(--text-secondary-color)"
                            fontSize="var(--canvas-label-size)"
                        >
                            {screenViewName(document, frame)}
                        </text>
                    </g>
                ))}
                {shapes.map((shape) => (
                    <Marked key={shape.id} changed={changed(shape.id)}>
                        <PreviewShape document={document} shape={shape} ancestors={new Set()} />
                    </Marked>
                ))}
                {views.flatMap((view) =>
                    view.frames.map((frame) => (
                        <rect
                            key={`${view.viewId}:${frame.id}`}
                            {...(changed(frame.id) ? { 'data-changed': '' } : {})}
                            x={frame.position.x}
                            y={frame.position.y}
                            width={frame.size.width}
                            height={frame.size.height}
                            fill="none"
                            stroke="var(--text-secondary-color)"
                            vectorEffect="non-scaling-stroke"
                        />
                    ))
                )}
                {views.flatMap((view) =>
                    view.shapes.map((shape) => (
                        <Marked key={`${view.viewId}:${shape.id}`} changed={changed(shape.id)}>
                            <PreviewShape
                                document={document}
                                shape={shape}
                                ancestors={new Set()}
                                viewId={view.viewId}
                            />
                        </Marked>
                    ))
                )}
                {changes?.removed.map((box, index) => (
                    <rect
                        key={`removed-${index}`}
                        data-changed=""
                        x={box.topLeft.x}
                        y={box.topLeft.y}
                        width={box.width}
                        height={box.height}
                        fill="none"
                        stroke="none"
                    />
                ))}
            </g>
            {changes && (
                <rect
                    ref={outlineRef}
                    className={styles.changeOutline}
                    visibility="hidden"
                    fill="none"
                    vectorEffect="non-scaling-stroke"
                    data-change-outline=""
                />
            )}
        </svg>
    );
};

/** One Screen's artwork as a viewport draws it, and where each of its shapes lies. */
export interface ScreenDrawing {
    viewId?: string;
    x: number;
    y: number;
    width: number;
    height: number;
    shapes: Shape[];
    boxes: Record<string, Box>;
}

/** Lays the document out once for any number of Screen drawings. */
export const drawingDocument = (document: Document, simulation: VariableContext = {}) =>
    layoutDocument(document, projectContextualLayout(document, { simulation }));

/** A Screen as its first placed view shows it, or at its own size when it has none. */
export function drawScreen(
    source: Document,
    laidOut: Document,
    screenId: string,
    simulation: VariableContext = {}
): ScreenDrawing | undefined {
    const screen = source.frames[screenId];
    const view = Object.values(source.frames)
        .filter((frame) => frame.kind === 'view' && frame.screenId === screenId && frame.visible)
        .sort((a, b) => a.id.localeCompare(b.id))[0];
    const viewport = view ?? (screen && { position: screen.position, size: screen.size });
    const projection = viewport && projectScreen(source, screenId, viewport, simulation);

    if (!projection || projection.exceedsNodeLimit) {
        return undefined;
    }

    return {
        viewId: view?.id,
        ...viewport.position,
        ...viewport.size,
        shapes: projection.shapes,
        boxes: Object.fromEntries(
            projection.shapes.map((shape) => [shape.id, previewBox(laidOut, shape)])
        )
    };
}

/** A Screen's artwork, letterboxed into whatever box holds it. */
export const ScreenThumbnail = memo(function ScreenThumbnail({
    document,
    drawing,
    label,
    outlined,
    controls
}: {
    document: Document;
    drawing: ScreenDrawing;
    label: string;
    /** A shape to outline, as the control a selected link belongs to. */
    outlined?: string;
    /** Shapes to lay a pointer target over, for whoever holds the picture to style and use. */
    controls?: readonly string[];
}) {
    const outline = outlined === undefined ? undefined : drawing.boxes[outlined];

    return (
        <svg
            className={styles.thumbnailSvg}
            role="img"
            aria-label={label}
            viewBox={`${drawing.x} ${drawing.y} ${drawing.width} ${drawing.height}`}
            preserveAspectRatio="xMidYMid meet"
        >
            <rect
                x={drawing.x}
                y={drawing.y}
                width={drawing.width}
                height={drawing.height}
                fill="var(--surface)"
            />
            {drawing.shapes.map((shape) => (
                <PreviewShape
                    key={shape.id}
                    document={document}
                    shape={shape}
                    ancestors={new Set()}
                    viewId={drawing.viewId}
                />
            ))}
            {controls?.map((id) => {
                const box = drawing.boxes[id];

                return (
                    box && (
                        <rect
                            key={id}
                            data-thumbnail-control={id}
                            x={box.topLeft.x}
                            y={box.topLeft.y}
                            width={box.width}
                            height={box.height}
                            fill="transparent"
                            vectorEffect="non-scaling-stroke"
                            rx={4}
                        />
                    )
                );
            })}
            {outline && (
                <rect
                    data-thumbnail-outline=""
                    pointerEvents="none"
                    x={outline.topLeft.x}
                    y={outline.topLeft.y}
                    width={outline.width}
                    height={outline.height}
                    fill="color-mix(in srgb, var(--selection-color) 12%, transparent)"
                    stroke="var(--selection-color)"
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                    rx={4}
                />
            )}
        </svg>
    );
});
