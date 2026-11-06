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
    const component = instanceComponent(document, instance);
    if (!component) {
        return false;
    }
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
        return ['The bound entity is unavailable. Choose an entity or remove the binding.'];
    }

    return Object.entries(list.fields).flatMap(([propId, fieldId]) => {
        const field = document.dataFields[fieldId];

        return field?.entityId === list.entityId &&
            compatibleListField(document, instance, propId, field)
            ? []
            : [`Data mapping ${propId} refers to a missing or incompatible field or property.`];
    });
}

/** How many repeated lists use an entity or one of its fields; Data View warns before deleting. */
export function listsUsing(document: Document, target: { entityId?: string; fieldId?: string }) {
    return Object.values(document.shapes).filter(
        (shape) =>
            shape.type === 'instance' &&
            shape.dataList &&
            (shape.dataList.entityId === target.entityId ||
                (target.fieldId !== undefined &&
                    Object.values(shape.dataList.fields).includes(target.fieldId)))
    ).length;
}

/**
 * Sample strings are literal content, never expressions or variable templates. A mapping or
 * value that can't be shown leaves the template value in place and is reported, so one
 * unfinished record or stale mapping never stops the whole Prototype.
 */
export function recordOverrides(
    document: Document,
    instance: InstanceShape,
    record: DataRecord,
    row: number
): { overrides: Record<string, PropertyValue | { variableId: string }>; problems: string[] } {
    const overrides = { ...instance.overrides };
    const problems: string[] = [];
    const component = instanceComponent(document, instance);
    for (const [propId, fieldId] of Object.entries(instance.dataList!.fields)) {
        const field = document.dataFields[fieldId];
        const resolved = component && resolveComponentProp(component, propId, document);
        if (
            field?.entityId !== instance.dataList!.entityId ||
            !resolved ||
            !component.shapesIds.includes(resolved.prop.shapeId) ||
            !exposableProperties(resolved.source, document).some(
                (property) => property.key === resolved.prop.key
            )
        ) {
            problems.push(
                `Data mapping ${propId} refers to a missing or incompatible field or property; bound properties show the component value.`
            );
            continue;
        }
        const value = record.values[fieldId];
        const problem = dataValueProblem(field, value);
        if (problem) {
            problems.push(`Row ${row}: ${problem} The item shows the template value.`);
            continue;
        }
        if (value === null || value === undefined) {
            continue;
        }
        if (!acceptsComponentValue(resolved.property, value)) {
            problems.push(
                `Row ${row}: ${field.name} is incompatible with the item property; the item shows the template value.`
            );
            continue;
        }
        overrides[propId] =
            resolved.property.kind === 'text' ? escapeTemplate(String(value)) : value;
    }

    return { overrides, problems };
}
