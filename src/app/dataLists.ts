import type { Document, InstanceShape, PropertyValue } from './types';
import type { DataField, DataList, DataRecord } from './dataTypes';
import { acceptsComponentValue, resolveComponentProp, exposableProperties } from './componentProps';
import { dataValueProblem } from './data';
import { instanceComponent } from './componentSource';
import { escapeTemplate } from './variables';

export const DEFAULT_LIST_GAP = 8;

export function compatibleListField(
    document: Document,
    instance: InstanceShape,
    propId: string,
    field: DataField
) {
    const component = document.components[instance.componentId];
    const resolved = resolveComponentProp(component, propId, document);

    return Boolean(
        resolved &&
        component.shapesIds.includes(resolved.prop.shapeId) &&
        exposableProperties(resolved.source, document).some(
            (property) => property.key === resolved.prop.key
        ) &&
        (resolved.property.kind === field.type ||
            (resolved.property.kind === 'color' && field.type === 'text'))
    );
}

export function dataListProblems(
    document: Document,
    instance: InstanceShape,
    list: DataList
): string[] {
    if (!document.dataEntities[list.entityId]) {
        return ['The list entity is unavailable. Choose an entity or remove the binding.'];
    }

    return Object.entries(list.fields).flatMap(([propId, fieldId]) => {
        const field = document.dataFields[fieldId];

        return field?.entityId === list.entityId &&
            compatibleListField(document, instance, propId, field)
            ? []
            : [`List mapping ${propId} refers to a missing or incompatible field or property.`];
    });
}

/** Sample strings are literal content, never expressions or variable templates. */
export function recordOverrides(
    document: Document,
    instance: InstanceShape,
    record: DataRecord
): Record<string, PropertyValue | { variableId: string }> {
    const overrides = { ...instance.overrides };
    const component = instanceComponent(document, instance);
    for (const [propId, fieldId] of Object.entries(instance.dataList!.fields)) {
        const field = document.dataFields[fieldId];
        const value = record.values[fieldId];
        const resolved = resolveComponentProp(component, propId, document);
        const problem = dataValueProblem(field, value);
        if (problem) {
            throw new Error(`Record ${record.id}: ${problem}`);
        }
        if (value === null || value === undefined) {
            continue;
        }
        if (
            !resolved ||
            !component?.shapesIds.includes(resolved.prop.shapeId) ||
            !exposableProperties(resolved.source, document).some(
                (property) => property.key === resolved.prop.key
            ) ||
            !acceptsComponentValue(resolved.property, value)
        ) {
            throw new Error(
                `Record ${record.id}: ${field.name} is incompatible with the item property.`
            );
        }
        overrides[propId] =
            resolved.property.kind === 'text' ? escapeTemplate(String(value)) : value;
    }

    return overrides;
}
