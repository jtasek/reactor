import React, { useState } from 'react';
import { useActions, useAppState } from 'src/app/hooks';
import { isReadOnly } from 'src/app/documentAccess';
import { isShapeLocked } from 'src/app/utils';
import { compatibleListField, dataListProblems, DEFAULT_LIST_GAP } from 'src/app/dataLists';
import { dataFields, dataRecords } from 'src/app/data';
import type { DataList as ListBinding } from 'src/app/dataTypes';
import { PropertyGroup } from './PropertyGroup';

/** A component instance supplies the item artwork; bindings never alter its source. */
export function DataList({ instanceId }: { instanceId: string }) {
    const { editData } = useActions();
    const [problem, setProblem] = useState('');
    const data = useAppState((state) => {
        const document = state.currentDocument;
        const instance = document.shapes[instanceId];
        if (instance?.type !== 'instance') {
            return null;
        }
        const component = document.components[instance.componentId];
        const list = instance.dataList;
        const fields = dataFields(document, list?.entityId ?? '');
        const props = component?.props ?? [];
        const propIds = new Set([
            ...props.map((prop) => prop.id),
            ...Object.keys(list?.fields ?? {})
        ]);

        return {
            documentId: document.id,
            template: component?.name ?? 'Missing component',
            list: list ? { ...list, fields: { ...list.fields } } : undefined,
            entities: Object.values(document.dataEntities).map(({ id, name }) => ({ id, name })),
            count: list ? dataRecords(document, list.entityId).length : 0,
            properties: [...propIds].map((id) => ({
                id,
                label: props.find((prop) => prop.id === id)?.label ?? `Unavailable property ${id}`,
                fields: fields
                    .filter((field) => compatibleListField(document, instance, id, field))
                    .map(({ id, name }) => ({ id, name }))
            })),
            problems: list ? dataListProblems(document, instance, list) : [],
            disabled:
                !component ||
                document.locked ||
                isReadOnly(state) ||
                isShapeLocked(document, instanceId) ||
                state.events.pointer.gesture.kind !== 'idle' ||
                Boolean(state.resetDocumentId)
        };
    });
    if (!data) {
        return null;
    }
    const update = (list: ListBinding | null) => {
        const result = editData({ kind: 'setList', documentId: data.documentId, instanceId, list });
        setProblem(result.applied ? '' : result.problem);
    };

    return (
        <section aria-label="Data list">
            <table>
                <PropertyGroup name="Repeat with data">
                    <tr>
                        <th scope="row">
                            <label htmlFor="list-entity">Entity</label>
                        </th>
                        <td>
                            <select
                                id="list-entity"
                                value={data.list?.entityId ?? ''}
                                disabled={data.disabled}
                                onChange={(event) =>
                                    update(
                                        event.target.value
                                            ? {
                                                  entityId: event.target.value,
                                                  fields: {},
                                                  gap: data.list?.gap ?? DEFAULT_LIST_GAP
                                              }
                                            : null
                                    )
                                }
                            >
                                <option value="">Do not repeat</option>
                                {data.list &&
                                    !data.entities.some(
                                        (entity) => entity.id === data.list!.entityId
                                    ) && (
                                        <option value={data.list.entityId}>
                                            Unavailable entity
                                        </option>
                                    )}
                                {data.entities.map((entity) => (
                                    <option key={entity.id} value={entity.id}>
                                        {entity.name}
                                    </option>
                                ))}
                            </select>
                        </td>
                    </tr>
                    {data.list && (
                        <>
                            <tr>
                                <th scope="row">Item template</th>
                                <td>{data.template}</td>
                            </tr>
                            <tr>
                                <th scope="row">
                                    <label htmlFor="list-gap">Item gap</label>
                                </th>
                                <td>
                                    <input
                                        id="list-gap"
                                        key={data.list.gap}
                                        type="number"
                                        min="0"
                                        defaultValue={data.list.gap}
                                        disabled={data.disabled}
                                        onBlur={(event) => {
                                            const gap = Number(event.target.value);
                                            if (
                                                !event.target.value.trim() ||
                                                !Number.isFinite(gap) ||
                                                gap < 0
                                            ) {
                                                event.target.value = String(data.list!.gap);
                                                setProblem(
                                                    'Item gap must be a non-negative number.'
                                                );

                                                return;
                                            }
                                            if (gap !== data.list!.gap) {
                                                update({ ...data.list!, gap });
                                            }
                                        }}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter') {
                                                event.currentTarget.blur();
                                            }
                                        }}
                                    />
                                </td>
                            </tr>
                            {data.properties.map((prop) => {
                                const value = data.list!.fields[prop.id] ?? '';

                                return (
                                    <tr key={prop.id}>
                                        <th scope="row">
                                            <label htmlFor={`list-${prop.id}`}>{prop.label}</label>
                                        </th>
                                        <td>
                                            <select
                                                id={`list-${prop.id}`}
                                                aria-label={`Data field for ${prop.label}`}
                                                value={value}
                                                disabled={data.disabled}
                                                onChange={(event) => {
                                                    const fields = { ...data.list!.fields };
                                                    if (event.target.value) {
                                                        fields[prop.id] = event.target.value;
                                                    } else {
                                                        delete fields[prop.id];
                                                    }
                                                    update({ ...data.list!, fields });
                                                }}
                                            >
                                                <option value="">Use template value</option>
                                                {value &&
                                                    !prop.fields.some(
                                                        (field) => field.id === value
                                                    ) && (
                                                        <option value={value}>
                                                            Unavailable or incompatible field
                                                        </option>
                                                    )}
                                                {prop.fields.map((field) => (
                                                    <option key={field.id} value={field.id}>
                                                        {field.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                    </tr>
                                );
                            })}
                        </>
                    )}
                </PropertyGroup>
            </table>
            {!data.entities.length && <p>Add an entity and sample records in Data View first.</p>}
            {data.list && (
                <p>
                    {data.count} items in Prototype. The canvas shows the item template. Unset
                    optional values use the template value.
                </p>
            )}
            {data.list && !data.properties.length && (
                <p>Expose component properties to connect fields.</p>
            )}
            {[...data.problems, ...(problem ? [problem] : [])].map((text, index) => (
                <p role="status" key={index}>
                    {text}
                </p>
            ))}
        </section>
    );
}
