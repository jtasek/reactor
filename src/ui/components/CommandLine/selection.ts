import type { Document, Shape } from 'src/app/types';
import type { Context } from 'src/app';
import type { UpdateShape } from 'src/app/operations';
import { SHAPE_PROPERTIES, canEdit, applyProperty } from 'src/app/properties';
import { isShapeVisible } from 'src/app/utils';
import { translateShape } from 'src/app/geometry';
import { componentSourceNudge } from 'src/app/componentViewTransform';
import { editableScreenView } from 'src/app/screenViewEditing';
import { unbind, unbindMovedProperties } from 'src/app/variables';
import { readParameters } from './creation';

export const SELECTION_PATTERN = /^(?:move\s+\w+\s*=|[a-z-]+=)/i;
export const SELECTION_HELP =
    'Edit selection: w=240 h=48 · r=12 · move x=16 y=-8. Radius rounds rectangles or sizes circles.';
export const SHARED_ARTWORK_HELP = 'Edits in this view change the shared Screen artwork.';

/** Compile the complete selection before committing a single undoable batch. */
export function selectionOperations(input: string, state: Context['state']): UpdateShape[] {
    const moving = /^move\s/i.test(input.trim());
    const values = readParameters(` ${input.trim().replace(/^move\s+/i, '')}`);
    const allowed = moving ? ['x', 'y'] : ['width', 'height', 'radius'];
    const entries = Object.entries(values).map(([key, text]) => {
        if (!allowed.includes(key)) {
            throw new Error(`Unknown parameter ${key}. Available: ${allowed.join(', ')}.`);
        }

        const value = Number(text);
        if (
            !text.trim() ||
            !Number.isFinite(value) ||
            (!moving && (value < 0 || (key !== 'radius' && value === 0)))
        ) {
            throw new Error(
                `${key} must be a ${moving ? '' : key === 'radius' ? 'non-negative ' : 'positive '}finite number.`
            );
        }

        return [key, value] as const;
    });
    if (moving && entries.every(([, value]) => value === 0)) {
        throw new Error('Move needs a non-zero x or y.');
    }
    const document = state.currentDocument;
    const ids = document.selectedShapesIds;
    if (!ids.length || document.selectedFrameId) {
        throw new Error('Select shapes to edit. Frame editing is available in the Inspector.');
    }

    const address = state.events.pointer.screenView;
    const placed = address ? editableScreenView(state, address) : null;
    if (address && !placed) {
        throw new Error('This Screen view is unavailable for editing.');
    }

    const shown = new Set(placed?.projection.shapes.map(({ id }) => id));
    // Turned views round to whole pixels, as arrow-key nudges do.
    const delta = componentSourceNudge(
        { x: Number(values.x ?? 0), y: Number(values.y ?? 0) },
        placed?.component
    );

    return ids.map((id) => {
        const source = document.shapes[id];
        if (
            !source ||
            !isShapeVisible(document, id) ||
            !document.editableSelectedShapesIds.includes(id) ||
            (placed && !shown.has(id))
        ) {
            throw new Error('Every selected shape must be visible and editable.');
        }
        if (moving && placed?.projection.layoutOffsets.has(id)) {
            throw new Error('Stack layout controls the selection’s position.');
        }

        if (source.type === 'image' && 'width' in values && 'height' in values) {
            throw new Error(
                `${source.name} keeps its proportions. Set its width or its height, not both.`
            );
        }

        const copy = JSON.parse(JSON.stringify(source)) as Shape;
        if (moving) {
            for (const key of ['x', 'y']) {
                const property = SHAPE_PROPERTIES.find((item) => item.key === key)!;
                if (!canEdit(property, source, document)) {
                    throw new Error('Stack layout controls the selection’s position.');
                }
            }
            translateShape(copy, delta);
            unbindMovedProperties(copy, delta);
        } else {
            // Apply dimensions before rounding, independent of parameter order.
            for (const [key, value] of [...entries].sort(
                ([a], [b]) => Number(a === 'radius') - Number(b === 'radius')
            )) {
                resizeProperty(copy, source, document, key, value);
            }
        }

        const fields = moving
            ? ['position', 'start', 'end', 'points']
            : [
                  ...new Set(
                      entries.map(([key]) =>
                          key === 'radius'
                              ? source.type === 'rectangle'
                                  ? 'cornerRadius'
                                  : 'radius'
                              : 'size'
                      )
                  )
              ];
        const changes = Object.fromEntries(
            fields.filter((key) => key in copy).map((key) => [key, copy[key as keyof Shape]])
        );

        return {
            op: 'updateShape',
            shape: id,
            changes: { ...changes, bindings: copy.bindings ?? {} }
        };
    });
}

function resizeProperty(
    copy: Shape,
    source: Shape,
    document: Document,
    key: string,
    value: number
) {
    if (key === 'radius' && copy.type === 'circle' && value === 0) {
        throw new Error('Circle radius must be positive.');
    }
    if (key === 'radius' && copy.type === 'circle') {
        copy.radius = value;
        unbind(copy, 'x');
        unbind(copy, 'y');

        return;
    }

    const property = SHAPE_PROPERTIES.find(
        (item) => item.key === (key === 'radius' ? 'cornerRadius' : key)
    )!;
    if (property.read(source, document) === undefined || !canEdit(property, source, document)) {
        throw new Error(
            `${key} cannot be edited on ${source.name}. Check its shape type, sizing and locks in the Inspector.`
        );
    }
    applyProperty(property, copy, value);
    unbind(copy, property.key);
}
