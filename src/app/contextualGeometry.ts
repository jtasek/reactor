import type { Document, Shape, VariableContext } from './types';
import { componentSource, instanceBox } from './componentSource';
import { componentOverrideValue, applyInstanceOverrides } from './componentProps';
import { instanceModes } from './inheritedModes';
import { variableContext } from './variableModes';
import { resolveTemplate, resolveVariable } from './variableResolver';
import { accepts, bindableProperty } from './variables';
import { applyProperty } from './properties';
import { drawnBox } from './membership';
import { rectToBox } from './utils';
import { measureContextualText } from './textMeasurement';
import { responsiveVariant, type VariantWidths } from './responsiveVariants';

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
    availableWidth?: number,
    ancestors: ReadonlySet<string> = new Set(),
    problems: Record<string, string> = {},
    widths: VariantWidths = {}
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

        return measureContextualText(shape, availableWidth);
    }

    if (shape.type !== 'instance') {
        return shape;
    }

    const selected = responsiveVariant(document, shape, widths);
    const selectedSource = componentSource(document, selected.componentId, ancestors);
    const decision =
        !selectedSource && shape.variantMode === 'auto' && !shape.variantId
            ? {
                  componentId: shape.componentId,
                  explanation: 'Auto · default source',
                  problem: 'Selected variant has missing or cyclic artwork. Repair its source.'
              }
            : selected;
    const selectedId = decision.componentId;
    if (decision.problem) {
        problems[source.id] = `${source.name}: ${decision.problem} Using the default source.`;
    }
    const component = document.components[selectedId];
    const original =
        selectedId === selected.componentId
            ? selectedSource
            : componentSource(document, selectedId, ancestors);
    if (!component || !original) {
        return shape;
    }
    const next = new Set(ancestors).add(component.id);
    const memberProblems: Record<string, string> = {};
    const members = original.shapes.map((member) => {
        const overridden = applyInstanceOverrides(member, shape, component, document, modes);
        const bindings = { ...overridden.bindings };
        component.props?.forEach((prop) => {
            if (
                prop.shapeId === member.id &&
                componentOverrideValue(shape, component, prop.id, document, modes) !== undefined
            ) {
                delete bindings[prop.key];
            }
        });

        return projectGeometry(
            { ...overridden, bindings },
            document,
            modes,
            availableWidth,
            next,
            memberProblems,
            {
                screen: widths.screen,
                screenProblem: widths.screenProblem,
                parentProblem:
                    'Component width depends on its artwork. Use Screen view width for nested responsive instances.'
            }
        );
    });
    if (Object.keys(memberProblems).length > 0) {
        problems[source.id] = [problems[source.id], ...Object.values(memberProblems)]
            .filter(Boolean)
            .join(' ');
    }
    const boxes = members.map(drawnBox);
    const left = Math.min(...boxes.map((box) => box.topLeft.x));
    const top = Math.min(...boxes.map((box) => box.topLeft.y));
    const right = Math.max(...boxes.map((box) => box.bottomRight.x));
    const bottom = Math.max(...boxes.map((box) => box.bottomRight.y));
    const projectedSource = {
        variant: decision,
        context: { modes, availableWidth, widths },
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
