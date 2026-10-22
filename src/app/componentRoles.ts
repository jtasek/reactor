import type {
    Component,
    ComponentRole,
    Document,
    InstanceShape,
    PropertyValue,
    RoleSettings
} from './types';
import { componentPropValue, resolveComponentProp } from './componentProps';

interface RoleProperty {
    key: string;
    label: string;
    kind: 'text' | 'boolean';
    required?: boolean;
}

/** Initial preview contract. Values reuse exposed properties and their existing overrides. */
export const ROLE_PROPERTIES: Record<ComponentRole, RoleProperty[]> = {
    text: [{ key: 'content', label: 'Content', kind: 'text', required: true }],
    input: [
        { key: 'label', label: 'Label', kind: 'text', required: true },
        { key: 'value', label: 'Value', kind: 'text' },
        { key: 'placeholder', label: 'Placeholder', kind: 'text' },
        { key: 'disabled', label: 'Disabled', kind: 'boolean' }
    ],
    button: [
        { key: 'label', label: 'Label', kind: 'text', required: true },
        { key: 'disabled', label: 'Disabled', kind: 'boolean' }
    ],
    list: [{ key: 'label', label: 'Label', kind: 'text', required: true }],
    image: [{ key: 'alt', label: 'Alternative text', kind: 'text', required: true }]
};

export const effectiveRoleSettings = (
    component: Component,
    instance?: InstanceShape
): RoleSettings => instance?.interaction ?? component.interaction ?? { role: 'none', props: {} };

/** Read-only semantic projection for the Inspector and future preview/export consumers. */
export function resolveComponentRole(
    document: Document,
    component: Component,
    instance?: InstanceShape
) {
    const settings = effectiveRoleSettings(component, instance);
    const props: Record<string, PropertyValue> = {};
    const problems: string[] = [];

    if (settings.role === 'none') {
        return { role: settings.role, props, problems };
    }
    const fields = ROLE_PROPERTIES[settings.role];
    for (const field of fields) {
        const propId = settings.props[field.key];
        if (!propId) {
            if (field.required) {
                problems.push(`Link ${field.label.toLowerCase()} to an exposed text property.`);
            }
            continue;
        }
        const resolved = resolveComponentProp(component, propId, document);
        if (!resolved || resolved.property.kind !== field.kind) {
            problems.push(
                `${field.label} refers to a missing or incompatible exposed property. Choose another property.`
            );
            continue;
        }
        const value = instance
            ? componentPropValue(instance, component, propId, document)
            : resolved.property.read(resolved.source, document);
        if (typeof value !== (field.kind === 'text' ? 'string' : 'boolean')) {
            problems.push(`${field.label} has an incompatible value.`);
            continue;
        }
        props[field.key] = value!;
    }
    Object.keys(settings.props).forEach((key) => {
        if (!fields.some((field) => field.key === key)) {
            problems.push(
                `The ${settings.role} role does not use the linked property "${key}". Change its role settings to remove it.`
            );
        }
    });

    return { role: settings.role, props, problems };
}
