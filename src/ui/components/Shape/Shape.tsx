import { hasLayoutOffset } from 'src/app/frameLayout';
import React, { CSSProperties, FC, createElement, memo, useLayoutEffect, useRef } from 'react';
import { Active } from '../Active/Active';
import { Label } from '../Label';
import { Resizable } from '../Selectable/Resizable';
import { Selectable } from '../Selectable/Selectable';
import { getComponentByType } from 'src/tools/components';
import { TextEditor } from 'src/tools/components/Text';
import { SHAPE_PROPERTIES } from 'src/app/properties';
import { instanceComponentId } from 'src/app/componentSource';
import { Instance } from './Instance';
import type { Shape as ShapeType } from 'src/app/types';
import { useCurrentDocument } from 'src/app/hooks';
import { useArtworkModes } from 'src/app/modeHooks';
import { themeColors } from 'src/app/themeColors';
import { resolveVariable } from 'src/app/variableResolver';
import {
    DEFAULT_TEXT_FONT_SIZE,
    rectToBox,
    shapeGeometryKey,
    getShapeBounds,
    boxCenter
} from 'src/app/utils';
import {
    useActions,
    useAppState,
    useComponentSource,
    useMeasuringShape,
    useShape,
    useShapeLocked,
    useShapeVisible
} from 'src/app/hooks';

interface Props {
    shapeId: string;
    /** In a group selected as one, which draws the selection instead. */
    inSelectedGroup: boolean;
    /** In a group not double-clicked into, so the pointer does not highlight it alone. */
    inClosedGroup: boolean;
    minimap?: boolean;
    measurementOnly?: boolean;
}

export const Shape = memo((props: Props) => {
    const {
        shapeId,
        inSelectedGroup,
        inClosedGroup,
        minimap = false,
        measurementOnly = false
    } = props;
    const shape = useShape(shapeId);
    const document = useCurrentDocument();
    const theme = useArtworkModes(shape);
    const painted = themeColors(shape, document, theme);
    const visible = useShapeVisible(shapeId);
    const locked = useShapeLocked(shapeId);
    const { setShapeBounds, activateShape, deactivateShape } = useActions();
    const measuring = useMeasuringShape(shapeId);
    const measuredGeometry = useRef<string | null>(null);
    const groupRef = useRef<SVGGElement>(null);
    // The component of this shape's type, which takes this shape's fields.
    const baseSource = useComponentSource(
        shape.type === 'instance' ? instanceComponentId(document, shape) : null
    );
    const source = shape.type === 'instance' ? (shape.projectedSource ?? baseSource) : baseSource;
    const variableKey = useAppState((state) => {
        if (shape.type !== 'instance') {
            return '';
        }
        const values = Object.values(shape.overrides).flatMap((override) => {
            if (typeof override !== 'object') {
                return [];
            }
            const variable = state.currentDocument.variables[override.variableId];

            return variable ? [resolveVariable(variable, state.currentDocument.variables)] : [];
        });

        return JSON.stringify(values);
    });
    const Component =
        shape.type === 'instance'
            ? null
            : (getComponentByType(shape.type) as FC<Omit<ShapeType, 'key'>>);
    const authored = useAppState((state) => state.currentDocument.shapes[shapeId]);
    const editingText = useAppState(
        (state) =>
            state.editingText?.documentId === state.currentDocumentId &&
            state.editingText.shapeId === shapeId
    );
    const inLayout = hasLayoutOffset(document, [shapeId]);
    // Measured in context; the DOM box would mix contexts and must not be stored.
    const contextual =
        shape.type === 'text'
            ? Boolean(shape.textLayout)
            : shape.type === 'instance' && Boolean(shape.projectedSource);
    const geometryKey = `${shapeGeometryKey(authored)}:${source?.key ?? ''}:${variableKey}`;

    // Measure the actual rendered geometry so the selection box, handles and
    // label match exactly. getBBox returns local (canvas) coordinates, so it is
    // unaffected by the camera pan/zoom transform on ancestor groups. Keyed on
    // the geometry only, so toggling `selected` during a marquee drag does not
    // trigger a costly reflow. Re-measure when a hidden shape is shown again, as
    // its geometry may have changed while it was not rendered. A gesture that
    // keeps bounds itself puts measuring off until it ends, and then only the
    // shapes it changed are measured.
    useLayoutEffect(() => {
        if (!visible) {
            measuredGeometry.current = null;

            return;
        }

        if (contextual || !measuring || measuredGeometry.current === geometryKey) {
            return;
        }

        const node = groupRef.current;

        if (!node) {
            return;
        }

        try {
            const bounds = rectToBox(node.getBBox());
            setShapeBounds({ id: shapeId, bounds });
            measuredGeometry.current = geometryKey;
        } catch {
            // getBBox throws for elements that are not yet renderable; ignore.
        }
    }, [contextual, geometryKey, shapeId, setShapeBounds, measuring, visible]);

    if (!Component && shape.type !== 'instance') {
        console.error(`Component ${shape.type} not found`);
        return null;
    }

    // Hidden by its own flag or by a hidden group or layer.
    if (!visible) {
        return null;
    }

    if (measurementOnly) {
        return (
            <g ref={groupRef} visibility="hidden" pointerEvents="none" aria-hidden="true">
                {shape.type === 'instance' ? (
                    <Instance instance={shape} source={source} context={theme} />
                ) : (
                    Component && createElement(Component, { ...painted, selected: false })
                )}
            </g>
        );
    }

    if (minimap && shape.type === 'instance') {
        return (
            <rect
                x={shape.position.x}
                y={shape.position.y}
                width={source?.box.width ?? 24}
                height={source?.box.height ?? 24}
                fill="none"
                stroke="currentColor"
            />
        );
    }

    // The selection overlays (box, resize handles, label) are only relevant for
    // a selected shape. Gating them here — rather than letting each overlay
    // early-return null — keeps unselected shapes from mounting Resizable, whose
    // usePointer() subscription would otherwise re-render every shape on every
    // pointer frame during a drag.
    // A rotation is applied as a group transform around the box center so the
    // shape and all of its overlays (selection box, handles, label) rotate
    // together while the stored geometry stays axis-aligned.
    const center = boxCenter(getShapeBounds(shape));
    const transform = shape.rotation
        ? `rotate(${shape.rotation} ${center.x} ${center.y})`
        : undefined;
    const { key, ...paintedProps } = painted;

    return (
        <g transform={transform}>
            <g
                ref={groupRef}
                // The field drawn over it shows the words while they change.
                opacity={editingText ? 0 : shape.opacity}
                style={
                    {
                        pointerEvents: 'all',
                        '--shape-fill': painted.fill,
                        '--shape-stroke': painted.stroke
                    } as CSSProperties
                }
                onPointerEnter={() => activateShape(shapeId)}
                onPointerLeave={() => deactivateShape(shapeId)}
            >
                {shape.type === 'instance' ? (
                    <Instance instance={shape} source={source} context={theme} />
                ) : (
                    Component && createElement(Component, { ...paintedProps, key })
                )}
            </g>
            {editingText && shape.type === 'text' && authored?.type === 'text' && (
                <TextEditor
                    shapeId={shapeId}
                    position={shape.position}
                    fontSize={shape.fontSize ?? DEFAULT_TEXT_FONT_SIZE}
                    width={Math.max(
                        200,
                        getShapeBounds(shape).width + (shape.fontSize ?? DEFAULT_TEXT_FONT_SIZE) * 4
                    )}
                    value={String(
                        SHAPE_PROPERTIES.find((item) => item.key === 'text')?.read(
                            authored,
                            document
                        ) ?? shape.value
                    )}
                />
            )}
            {shape.active && !shape.selected && !inClosedGroup && (
                <Active key={`active-${shape.type}-${shape.id}`} shape={shape} />
            )}
            {shape.selected && !inSelectedGroup && (
                <>
                    <Selectable key={`selectable-${shape.type}-${shape.id}`} shape={shape} />
                    {/* Locked shapes stay selectable but cannot be resized or rotated. */}
                    {!locked && !inLayout && (
                        <Resizable key={`resizable-${shape.type}-${shape.id}`} shape={shape} />
                    )}
                    <Label key={`label-${shape.type}-${shape.id}`} shape={shape} />
                </>
            )}
        </g>
    );
});

Shape.displayName = 'Shape';
