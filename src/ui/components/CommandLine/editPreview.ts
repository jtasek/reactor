import type { Context } from 'src/app';
import type { Document, Frame, Shape } from 'src/app/types';
import { editorHelpers } from 'src/app/editorHelpers';
import { untracked } from 'src/app/untracked';
import { SHAPE_PROPERTIES } from 'src/app/properties';
import { FRAME_NUMBER_KEYS, frameNumber } from 'src/app/frameVariables';
import { shapeGeometryKey } from 'src/app/utils';
import { takesEditorInput } from 'src/events/input';
import { parameterLabel } from './parameters';
import { SELECTION_PATTERN, selectionOperations } from './selection';

export interface EditPreview {
    problem?: string;
    items: { name: string; changes: string[] }[];
}

/** Stage the same operations as Apply, without writing or starting an undo batch. */
export function previewEdit(input: string, state: Context['state']): EditPreview | undefined {
    if (!SELECTION_PATTERN.test(input.trim())) {
        return undefined;
    }
    try {
        if (!takesEditorInput(state) || state.currentDocument.locked) {
            throw new Error('Selection editing is unavailable right now.');
        }
        const operations = selectionOperations(input, state);
        const document = state.currentDocument;
        const result = editorHelpers().operations.stageBatch(
            untracked(document),
            operations,
            () => 'preview-only'
        );
        if (!result.valid) {
            return { problem: result.problem, items: [] };
        }
        const items = result.staged.updatedShapes.map(({ id, fields }) => {
            const before = document.shapes[id];
            const after = { ...before, ...fields } as Shape;
            if (after.type !== 'text' && shapeGeometryKey(before) !== shapeGeometryKey(after)) {
                delete after.bounds;
            }

            return { name: before.name, changes: shapeChanges(before, after, document) };
        });
        for (const after of result.staged.updatedFrames) {
            const before = document.frames[after.id];
            items.push({ name: before.name, changes: frameChanges(before, after, document) });
        }

        return { items: items.filter(({ changes }) => changes.length > 0) };
    } catch (error) {
        return {
            problem: error instanceof Error ? error.message : 'Could not validate this edit.',
            items: []
        };
    }
}

const display = (value: unknown) => (value === undefined || value === '' ? 'None' : String(value));
const difference = (label: string, before: unknown, after: unknown) =>
    before === after ? [] : [`${label}: ${display(before)} → ${display(after)}`];

function bindingChanges(before: Shape | Frame, after: Shape | Frame, document: Document) {
    return [
        ...new Set([...Object.keys(before.bindings ?? {}), ...Object.keys(after.bindings ?? {})])
    ].flatMap((key) => {
        const oldId = before.bindings?.[key];
        const newId = after.bindings?.[key];
        if (oldId === newId) {
            return [];
        }
        const label = parameterLabel(key);
        if (!newId) {
            return [`${label}: Remove binding to ${document.variables[oldId!]?.name ?? oldId}`];
        }

        return [`${label}: Bind to ${document.variables[newId]?.name ?? newId}`];
    });
}

function shapeChanges(before: Shape, after: Shape, document: Document) {
    const keys = [
        'x',
        'y',
        'width',
        'height',
        'cornerRadius',
        'fill',
        'stroke',
        'fontColor',
        'text',
        'fontSize'
    ];
    const changes = SHAPE_PROPERTIES.filter(
        ({ key }) =>
            keys.includes(key) &&
            !(before.type === 'text' && ['x', 'y', 'width', 'height'].includes(key))
    ).flatMap((property) =>
        difference(property.label, property.read(before, document), property.read(after, document))
    );
    if (before.type === 'text' && after.type === 'text') {
        changes.push(
            ...difference('X', before.position.x, after.position.x),
            ...difference('Y', before.position.y, after.position.y)
        );
    }
    if (before.type === 'circle' && after.type === 'circle') {
        changes.push(...difference('Radius', before.radius, after.radius));
    }

    return [...changes, ...bindingChanges(before, after, document)];
}

function frameChanges(before: Frame, after: Frame, document: Document) {
    return [
        ...FRAME_NUMBER_KEYS.flatMap((key) =>
            difference(parameterLabel(key), frameNumber(before, key), frameNumber(after, key))
        ),
        ...difference('X', before.position.x, after.position.x),
        ...difference('Y', before.position.y, after.position.y),
        ...bindingChanges(before, after, document)
    ];
}
