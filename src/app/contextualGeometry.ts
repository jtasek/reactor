import type { Document, Shape, VariableContext } from './types';
import { componentSource, instanceBox } from './componentSource';
import { applyInstanceOverrides } from './componentProps';
import { instanceModes } from './inheritedModes';
import { variableContext } from './variableModes';
import { resolveTemplate, resolveVariable } from './variableResolver';
import { accepts, bindableProperty } from './variables';
import { applyProperty } from './properties';
import { drawnBox } from './membership';
import { rectToBox } from './utils';
import { measureContextualText } from './textMeasurement';

/** Only supported properties participate; identity and editor state always stay authored. */
const GEOMETRY_KEYS = new Set([
    'width',
    'height',
    'fontSize',
    'wrapWidth',
    'text',
    'cornerRadius',
    'opacity'
]);

export function projectGeometry(
    source: Shape,
    document: Document,
    inherited: VariableContext,
    path = source.id,
    availableWidth?: number,
    ancestors: ReadonlySet<string> = new Set(),
    problems: Record<string, string> = {}
): Shape {
    const modes =
        source.type === 'instance' ? instanceModes(document, inherited, source) : inherited;
    const context = variableContext(document, modes);
    const shape = { ...source };

    for (const [key, id] of Object.entries(source.bindings ?? {})) {
        if (!GEOMETRY_KEYS.has(key)) {
            continue;
        }
        const variable = document.variables[id];
        const property = bindableProperty(key);

        if (!variable || !property || variable.type !== property.kind) {
            continue;
        }
        const value = resolveVariable(variable, document.variables, context);
        if (
            !accepts(property, value) ||
            ((key === 'width' || key === 'height') &&
                (typeof value !== 'number' ||
                    value <= 0 ||
                    (shape.sizing?.[key]?.mode ?? 'fixed') !== 'fixed'))
        ) {
            problems[source.id] =
                `${source.name}: ${key} mode value is invalid; using the authored value.`;
            continue;
        }
        if (key === 'text' && shape.type === 'text') {
            shape.value = String(value);
        } else {
            applyProperty(property, shape, value);
        }
        delete shape.bounds;
    }

    if (shape.type === 'text') {
        if (shape.template && !shape.bindings?.text) {
            const value = resolveTemplate(shape.template, document.variables, context);
            if (value.trim()) {
                shape.value = value;
            }
        }

        return measureContextualText(shape, JSON.stringify([path, context]), availableWidth);
    }

    if (shape.type !== 'instance') {
        return shape;
    }

    const component = document.components[shape.componentId];
    const original = componentSource(document, shape.componentId, ancestors);
    if (!component || !original) {
        return shape;
    }
    const next = new Set(ancestors).add(component.id);
    const members = original.shapes.map((member) => {
        const overridden = applyInstanceOverrides(member, shape, component, document, modes);
        const bindings = { ...overridden.bindings };
        component.props?.forEach((prop) => {
            if (prop.shapeId === member.id && shape.overrides[prop.id] !== undefined) {
                delete bindings[prop.key];
            }
        });

        return projectGeometry(
            { ...overridden, bindings },
            document,
            modes,
            `${path}/${member.id}`,
            availableWidth,
            next,
            problems
        );
    });
    const boxes = members.map(drawnBox);
    const left = Math.min(...boxes.map((box) => box.topLeft.x));
    const top = Math.min(...boxes.map((box) => box.topLeft.y));
    const right = Math.max(...boxes.map((box) => box.bottomRight.x));
    const bottom = Math.max(...boxes.map((box) => box.bottomRight.y));
    const projectedSource = {
        context: { modes, availableWidth },
        box: rectToBox({ x: left, y: top, width: right - left, height: bottom - top }),
        shapes: members,
        key: original.key
    };

    return {
        ...shape,
        projectedSource,
        bounds: shape.layoutSize
            ? rectToBox({ ...shape.position, ...shape.layoutSize })
            : instanceBox(shape, projectedSource)
    };
}
