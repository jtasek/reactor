import type { Document } from 'src/app/types';
import { editedBindings } from 'src/app/variables';
import type { ProposedOperation } from './operations';

const quoted = (text: string) => `“${text}”`;

const modesDescription = (
    operation: { dimensionId?: string | null; modeValues?: Record<string, string | number | null> },
    document: Document
) => {
    const dimension = operation.dimensionId
        ? document.dimensions[operation.dimensionId]
        : undefined;
    const assigned =
        operation.dimensionId === undefined
            ? ''
            : operation.dimensionId === null
              ? '; base value only'
              : `; vary by ${dimension?.name ?? operation.dimensionId}`;
    const values = Object.entries(operation.modeValues ?? {}).map(
        ([id, value]) => `${dimension?.modes[id]?.name ?? id}: ${value ?? 'use base'}`
    );
    return assigned + (values.length ? `; modes: ${values.join(', ')}` : '');
};

/** What a shape is called in a proposal: its type and name, or the ID the model gave. */
const shapeLabel = (document: Document, id: string) => {
    const shape = document.shapes[id];

    return shape ? `${shape.type} ${quoted(shape.name)}` : quoted(id);
};

const variableLabel = (document: Document, id: string) => {
    const variable = document.variables[id];

    return variable
        ? `${variable.type} variable ${quoted(variable.name)}`
        : `variable ${quoted(id)}`;
};

/** A frame's name, from the document or from a frame an earlier call of the batch adds. */
const frameName = (document: Document, batch: readonly ProposedOperation[], id: string) =>
    document.frames[id]?.name ??
    batch.find(
        (operation): operation is Extract<ProposedOperation, { op: 'addFrame' }> =>
            operation.op === 'addFrame' && operation.key === id
    )?.frame.name ??
    id;

/**
 * One line saying what a proposed operation adds, changes or deletes in
 * `document`, for the person reviewing the proposal. `batch` is the whole
 * proposal, so records it adds are named rather than shown by key.
 */
export function describeOperation(
    operation: ProposedOperation,
    document: Document,
    batch: readonly ProposedOperation[] = []
): string {
    const frameLabel = (id: string) => quoted(frameName(document, batch, id));
    /** An entity's name, from the document or from an entity an earlier call of the batch adds. */
    const entityName = (id: string) =>
        document.dataEntities[id]?.name ??
        batch.find(
            (each): each is Extract<ProposedOperation, { op: 'addEntity' }> =>
                each.op === 'addEntity' && each.key === id
        )?.name ??
        id;

    switch (operation.op) {
        case 'addEntity': {
            const count = operation.records?.length ?? 0;
            const types = operation.fields.map((field) => `${field.name} (${field.type})`);

            return `Add entity ${quoted(operation.name)} with ${types.join(', ')}${count ? ` and ${count} ${count === 1 ? 'record' : 'records'}` : ''}`;
        }
        case 'addRecords': {
            const count = operation.records.length;

            return `Add ${count} ${count === 1 ? 'record' : 'records'} to ${quoted(entityName(operation.entity))}`;
        }
        case 'addFrame': {
            const frame = operation.frame;
            const kind =
                frame.kind === 'view'
                    ? 'page size'
                    : frame.kind === 'screen'
                      ? 'page'
                      : frame.screenLayout
                        ? 'separate design'
                        : 'frame';
            const owner = frame.screenId ?? (frame.screenLayout ? frame.parentFrameId : undefined);
            const rules = Object.values(frame.responsiveLayouts ?? {}).map(
                (rule) => `${rule.minWidth}px → ${frameLabel(rule.layoutId)}`
            );

            return `Add ${kind} ${quoted(frame.name)} (${frame.size.width} × ${frame.size.height})${owner ? ` for ${frameLabel(owner)}` : ''}${rules.length ? `; automatic designs: ${rules.join(', ')}` : ''}`;
        }
        case 'updateFrame': {
            const frame = document.frames[operation.frame];
            const { responsiveLayouts, ...changes } = operation.changes;
            const fields = Object.keys(changes);

            if (responsiveLayouts !== undefined) {
                fields.push(
                    responsiveLayouts === null || Object.keys(responsiveLayouts).length === 0
                        ? 'remove automatic design rules'
                        : `automatic designs: ${Object.values(responsiveLayouts)
                              .map((rule) => `${rule.minWidth}px → ${frameLabel(rule.layoutId)}`)
                              .join(', ')}`
                );
            }

            return `Change ${quoted(frame?.name ?? operation.frame)}: ${fields.join('; ')}`;
        }
        case 'addVariable':
            return `Add ${operation.type} variable ${quoted(operation.name)}: ${operation.alias === undefined ? String(operation.value) : `follow ${variableLabel(document, operation.alias)}`}${operation.darkValue === undefined ? '' : `; Dark: ${operation.darkValue}`}${modesDescription(operation, document)}`;
        case 'addShape': {
            const { shape } = operation;
            const named = shape.name ? ` ${quoted(shape.name)}` : '';
            const placed = shape.parentFrameId ? ` in ${frameLabel(shape.parentFrameId)}` : '';

            const repeats =
                shape.type === 'instance' && shape.dataList
                    ? ` repeated over ${quoted(entityName(shape.dataList.entityId))}`
                    : '';

            return shape.type === 'text'
                ? `Add text${named}${placed}: ${quoted(shape.value)}`
                : `Add ${shape.type}${named}${placed}${repeats}`;
        }
        case 'addGroup':
            return `Group ${operation.shapes.length} shapes as ${quoted(operation.name)}`;
        case 'updateVariable': {
            const { name, value, alias, darkValue } = operation;
            const renamed = name === undefined ? '' : ` to ${quoted(name)}`;
            const valued = value === undefined ? '' : `: ${String(value)}`;
            const dark = darkValue === undefined ? '' : `; Dark: ${darkValue ?? 'use Light'}`;

            const following =
                typeof alias === 'string'
                    ? `; follow ${variableLabel(document, alias)}`
                    : alias === null ||
                        ((value !== undefined ||
                            darkValue !== undefined ||
                            operation.modeValues !== undefined ||
                            operation.dimensionId !== undefined) &&
                            document.variables[operation.variable]?.alias !== undefined)
                      ? '; stops following its source'
                      : '';
            return `Change ${variableLabel(document, operation.variable)}${renamed}${valued}${dark}${modesDescription(operation, document)}${following}`;
        }
        case 'deleteVariable':
            return `Delete ${variableLabel(document, operation.variable)}`;
        case 'updateShape': {
            const { changes } = operation;
            const texted =
                'value' in changes && typeof changes.value === 'string'
                    ? [`text ${quoted(changes.value)}`]
                    : [];
            const fields = Object.keys(changes)
                .filter((field) => field !== 'value')
                .map((field) =>
                    field !== 'dataList'
                        ? field
                        : changes.dataList
                          ? `repeat over ${quoted(entityName(changes.dataList.entityId))}`
                          : 'stop repeating over records'
                );
            const changed = `Change ${shapeLabel(document, operation.shape)}: ${[...texted, ...fields].join(', ')}`;
            const shape = document.shapes[operation.shape];
            const unfollowed = shape
                ? editedBindings(shape, Object.keys(changes))
                      .filter((key) => !changes.bindings || !(key in changes.bindings))
                      .map((key) => shape.bindings![key])
                : [];

            return unfollowed.length === 0
                ? changed
                : `${changed}; stops following ${[...new Set(unfollowed)]
                      .map((id) => variableLabel(document, id))
                      .join(', ')}`;
        }
        case 'deleteShapes':
            return operation.shapes.length === 1
                ? `Delete ${shapeLabel(document, operation.shapes[0])}`
                : `Delete ${operation.shapes.length} shapes: ${operation.shapes
                      .map((id) => shapeLabel(document, id))
                      .join(', ')}`;
        case 'deleteGroup': {
            const group = document.groups[operation.group];

            return `Ungroup ${quoted(group ? group.name : operation.group)}`;
        }
    }
}
