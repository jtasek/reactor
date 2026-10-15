import type { Document } from 'src/app/types';
import { readEntity } from 'src/app/services/documentStorage';

/** What a shape keeps for the editor alone, or names elsewhere, as its ID. */
const EDITOR_FIELDS = new Set(['id', 'created', 'modified', 'createdBy', 'modifiedBy', 'order']);

/**
 * What a model is told of a document: its shapes in drawing order, groups,
 * variables with their values, and components with their props, each under its
 * ID, without what only the editor uses.
 */
export function documentContext(document: Document) {
    return {
        shapes: Object.fromEntries(
            document.shapesIds.map((id) => [
                id,
                Object.fromEntries(
                    Object.entries(readEntity('shapes', document.shapes[id])).filter(
                        ([field]) => !EDITOR_FIELDS.has(field)
                    )
                )
            ])
        ),
        groups: Object.fromEntries(
            Object.values(document.groups).map(({ id, name, shapesIds }) => [
                id,
                { name, shapes: shapesIds }
            ])
        ),
        variables: Object.fromEntries(
            Object.values(document.variables).map(({ id, name, type, values }) => [
                id,
                { name, type, value: values.default }
            ])
        ),
        components: Object.fromEntries(
            Object.values(document.components).map(({ id, name, props = [] }) => [
                id,
                { name, props: props.map((prop) => ({ id: prop.id, label: prop.label })) }
            ])
        )
    };
}
