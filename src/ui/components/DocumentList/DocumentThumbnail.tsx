import { screenOwners, screenSourceShapes, screenViewName } from 'src/app/screenViews';
import { layoutDocument } from 'src/app/frameLayout';
import { projectScreenViews } from 'src/app/screenProjection';
import React, { FC, ReactNode, useLayoutEffect, useRef } from 'react';
import { useVariableContext } from 'src/app/hooks';
import { isFrameVisible } from 'src/app/frameState';
import { themeColors } from 'src/app/themeColors';
import { SquareDashed } from 'lucide-react';
import type { Box, Document, Image, InstanceShape, Shape } from 'src/app/types';
import { applyInstanceOverrides } from 'src/app/componentProps';
import { componentSource, instanceBox } from 'src/app/componentSource';
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

    const source = componentSource(document, shape.componentId);
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
}> = ({ document, shape, ancestors }) => {
    const theme = useVariableContext(document.id);
    const source = componentSource(document, shape.componentId, ancestors);

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

    const component = document.components[shape.componentId];
    const nextAncestors = new Set(ancestors).add(shape.componentId);
    const offsetX = shape.position.x - source.box.topLeft.x;
    const offsetY = shape.position.y - source.box.topLeft.y;

    return (
        <g transform={`translate(${offsetX} ${offsetY})`}>
            {source.shapes.map((member) => {
                const painted = themeColors(member, document, theme);
                const resolved = component
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
                        ancestors={nextAncestors}
                    />
                );
            })}
        </g>
    );
};

function geometry(document: Document, shape: Shape, ancestors: ReadonlySet<string>): ReactNode {
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
                    fill={shape.fontColor ?? 'var(--text-color)'}
                >
                    {shape.value}
                </text>
            );
        case 'image':
            return <PreviewImage shape={shape} documentId={document.id} />;
        case 'instance':
            return <PreviewInstance document={document} shape={shape} ancestors={ancestors} />;
        default:
            return assertNever(shape);
    }
}

const PreviewShape: FC<{
    themed?: boolean;
    document: Document;
    shape: Shape;
    ancestors: ReadonlySet<string>;
}> = ({ document, shape, ancestors, themed = false }) => {
    const theme = useVariableContext(document.id);
    const painted = themed ? shape : themeColors(shape, document, theme);
    const bounds = shape.type === 'instance' ? previewBox(document, shape) : getShapeBounds(shape);
    const center = boxCenter(bounds);
    const transform = shape.rotation
        ? `rotate(${shape.rotation} ${center.x} ${center.y})`
        : undefined;

    return (
        <g opacity={shape.opacity} transform={transform}>
            {geometry(document, painted, ancestors)}
        </g>
    );
};

export const DocumentThumbnail: FC<{ document: Document }> = ({ document: sourceDocument }) => {
    const document = layoutDocument(sourceDocument);
    const svgRef = useRef<SVGSVGElement>(null);
    const contentRef = useRef<SVGGElement>(null);
    const shown = shownShapesIds({ ...document, shownLayerId: undefined }, null);
    const sourceShapes = screenSourceShapes(document);
    const shapes = document.shapesIds
        .filter((id) => shown.has(id) && !sourceShapes.has(id))
        .map((id) => document.shapes[id]);

    useLayoutEffect(() => {
        const content = contentRef.current;

        if (!content) {
            return;
        }

        try {
            const bounds = rectToBox(content.getBBox());
            svgRef.current?.setAttribute('viewBox', paddedViewBox(bounds));
        } catch {
            // An SVG that is not yet renderable has no measurable box.
        }
    });

    const owners = screenOwners(document.frames);
    const frames = Object.values(document.frames).filter(
        (frame) => !owners.get(frame.id) && isFrameVisible(document, frame.id)
    );
    const views = projectScreenViews(sourceDocument).flatMap(({ view, projection }) =>
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
                    <g key={frame.id}>
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
                    <PreviewShape
                        key={shape.id}
                        document={document}
                        shape={shape}
                        ancestors={new Set()}
                    />
                ))}
                {views.flatMap((view) =>
                    view.frames.map((frame) => (
                        <rect
                            key={`${view.viewId}:${frame.id}`}
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
                        <PreviewShape
                            key={`${view.viewId}:${shape.id}`}
                            document={document}
                            shape={shape}
                            ancestors={new Set()}
                        />
                    ))
                )}
            </g>
        </svg>
    );
};
