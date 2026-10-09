import React, { FC } from 'react';
import { useActions, useAppState } from 'src/app/hooks';
import { componentPropValue } from 'src/app/componentProps';
import { SHAPE_PROPERTIES } from 'src/app/properties';
import { isHexColor } from 'src/app/utils';
import type { InstanceShape, PropertyValue } from 'src/app/types';

/** The values exposed by one source, shared across selected instances. */
export const InstanceProps: FC = () => {
    const actions = useActions();
    const data = useAppState((state) => {
        const document = state.currentDocument;
        const selected = document.selectedShapes.filter(
            (shape): shape is InstanceShape => shape.type === 'instance'
        );
        const componentId = selected[0]?.componentId;

        if (
            !componentId ||
            selected.length !== document.selectedShapes.length ||
            selected.some((shape) => shape.componentId !== componentId)
        ) {
            return null;
        }
        const component = document.components[componentId];

        if (!component) {
            return null;
        }

        return {
            ids: selected.map((shape) => shape.id),
            rows: (component.props ?? []).flatMap((prop) => {
                const property = SHAPE_PROPERTIES.find((item) => item.key === prop.key);

                if (!property) {
                    return [];
                }
                const values = selected.map((shape) =>
                    componentPropValue(shape, component, prop.id, document)
                );
                const bindings = selected.map((shape) => shape.overrides[prop.id]);
                const binding = bindings[0];

                return [
                    {
                        prop,
                        kind: property.kind,
                        value: values[0],
                        mixed: values.some((value) => value !== values[0]),
                        overridden: selected.some((shape) => prop.id in shape.overrides),
                        variableId:
                            binding &&
                            typeof binding === 'object' &&
                            bindings.every(
                                (item) =>
                                    typeof item === 'object' &&
                                    item.variableId === binding.variableId
                            )
                                ? binding.variableId
                                : ''
                    }
                ];
            }),
            variables: Object.values(document.variables)
        };
    });

    if (!data || data.rows.length === 0) {
        return null;
    }

    const set = (propId: string, value: PropertyValue) =>
        actions.setInstanceOverride({ instanceIds: data.ids, propId, value });

    return (
        <section aria-label="Component properties">
            <h3>Component</h3>
            {data.rows.map(({ prop, kind, value, mixed, overridden, variableId }) => (
                <div key={prop.id}>
                    <label htmlFor={`component-prop-${prop.id}`}>{prop.label}</label>
                    {kind === 'boolean' ? (
                        <input
                            id={`component-prop-${prop.id}`}
                            type="checkbox"
                            checked={value === true && !mixed}
                            onChange={(event) => set(prop.id, event.target.checked)}
                        />
                    ) : kind === 'color' ? (
                        <>
                            <input
                                id={`component-prop-${prop.id}`}
                                type="color"
                                value={
                                    typeof value === 'string' && isHexColor(value)
                                        ? value
                                        : '#000000'
                                }
                                onChange={(event) => set(prop.id, event.target.value)}
                            />
                            <button type="button" onClick={() => set(prop.id, '')}>
                                None
                            </button>
                            {mixed && <span>Mixed</span>}
                        </>
                    ) : (
                        <input
                            id={`component-prop-${prop.id}`}
                            type={kind === 'number' ? 'number' : 'text'}
                            value={mixed ? '' : String(value ?? '')}
                            placeholder={mixed ? 'Mixed' : undefined}
                            onChange={(event) => {
                                const next =
                                    kind === 'number'
                                        ? Number(event.target.value)
                                        : event.target.value;
                                set(prop.id, next);
                            }}
                        />
                    )}
                    <select
                        aria-label={`Variable for ${prop.label}`}
                        value={variableId}
                        onChange={(event) =>
                            actions.bindInstanceOverride({
                                instanceIds: data.ids,
                                propId: prop.id,
                                variableId: event.target.value
                            })
                        }
                    >
                        <option value="">Variable</option>
                        {data.variables
                            .filter((variable) => variable.type === kind)
                            .map((variable) => (
                                <option key={variable.id} value={variable.id}>
                                    {variable.name}
                                </option>
                            ))}
                    </select>
                    <button
                        type="button"
                        disabled={!overridden}
                        onClick={() =>
                            actions.resetInstanceOverrides({
                                instanceIds: data.ids,
                                propId: prop.id
                            })
                        }
                    >
                        Reset
                    </button>
                </div>
            ))}
        </section>
    );
};
