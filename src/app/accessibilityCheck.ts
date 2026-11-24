import { projectPreview, type PreviewSession } from 'src/preview/project';
import {
    adjustedColor,
    auditScreen,
    type AuditContrast,
    type AuditProblem,
    type AuditReport,
    type AuditWhen
} from 'src/preview/accessibilityAudit';
import type { AccessibilityRules } from 'src/preview/accessibilityRules';
import type { PreviewDrawing } from 'src/shared/previewProtocol';
import type { Operation, UpdateShape, UpdateVariable } from './operations';
import type { Document, Shape, VariableContext } from './types';
import type { ViewportPreset } from './services/viewportPresets';
import { ordered, sizesDimension } from './variableModes';
import { boundVariable } from './editorVariables';
import { variableDefinition } from './variableResolver';
import { instanceComponentId } from './componentSource';
import { effectiveRoleSettings } from './componentRoles';

/** The modes, by dimension, and the viewport sizes a check and a download cover. */
export interface ContextChoice {
    modes: Record<string, string[]>;
    sizes: string[];
}

/** One combination: a mode of each chosen dimension at one viewport size. */
export interface CheckContext {
    id: string;
    name: string;
    /** Mode names by dimension name, for the exported page's pickers. */
    labels: Record<string, string>;
    modes: VariableContext;
    size: ViewportPreset;
}

export interface CheckedContext {
    context: CheckContext;
    drawing?: PreviewDrawing;
    screens: { id: string; name: string; report: AuditReport }[];
    /** Why this context could not be drawn. */
    problem?: string;
}

export interface Fix {
    /** What the fix does, in words. */
    text: string;
    operations: Operation[];
}

export interface AccessibilityIssue {
    id: string;
    problem: AuditProblem;
    screenId: string;
    screenName: string;
    /** Names of the contexts it shows in. */
    contexts: string[];
    /** The shape on the page to show, when there is one. */
    shapeId?: string;
    message: string;
    fix?: Fix;
    /** What to do when no change can be proposed. */
    advice?: string;
}

/** Dimensions a person picks modes of; the Sizes dimension follows the viewport width. */
export const choiceDimensions = (document: Pick<Document, 'dimensions'>) => {
    const sizes = sizesDimension(document.dimensions)?.id;

    return ordered(document.dimensions).filter(({ id }) => id !== sizes);
};

/** Every mode and every preset size. */
export function defaultChoice(
    document: Pick<Document, 'dimensions'>,
    presets: readonly ViewportPreset[]
): ContextChoice {
    return {
        modes: Object.fromEntries(
            choiceDimensions(document).map((dimension) => [
                dimension.id,
                ordered(dimension.modes).map(({ id }) => id)
            ])
        ),
        sizes: presets.map(({ id }) => id)
    };
}

/** Each combination of the chosen modes and sizes, or why there are none to check. */
export function checkContexts(
    document: Pick<Document, 'dimensions'>,
    presets: readonly ViewportPreset[],
    choice: ContextChoice,
    rules: AccessibilityRules
): { contexts: CheckContext[] } | { problem: string } {
    const sizes = presets.filter(({ id }) => choice.sizes.includes(id));
    if (!sizes.length) {
        return { problem: 'Choose at least one size.' };
    }
    let combinations: { modes: Record<string, string>; labels: Record<string, string> }[] = [
        { modes: {}, labels: {} }
    ];
    for (const dimension of choiceDimensions(document)) {
        // A dimension added since the choice was made counts with all its modes.
        const modes = ordered(dimension.modes).filter(
            ({ id }) => !choice.modes[dimension.id] || choice.modes[dimension.id].includes(id)
        );
        if (!modes.length) {
            return { problem: `Choose at least one ${dimension.name} mode.` };
        }
        combinations = combinations.flatMap((combination) =>
            modes.map((mode) => ({
                modes: { ...combination.modes, [dimension.id]: mode.id },
                labels: { ...combination.labels, [dimension.name]: mode.name }
            }))
        );
    }
    const count = combinations.length * sizes.length;
    if (count > rules.maxContexts) {
        return {
            problem: `That is ${count} combinations of modes and sizes; choose at most ${rules.maxContexts}.`
        };
    }

    return {
        contexts: combinations.flatMap((combination) =>
            sizes.map((size) => ({
                id: JSON.stringify([combination.modes, size.id]),
                name: [...Object.values(combination.labels), size.name].join(' · '),
                labels: combination.labels,
                modes: combination.modes,
                size
            }))
        )
    };
}

/** A Prototype session seen in one context: its modes, at its size, with Auto layouts. */
export function contextSession(
    document: Pick<Document, 'dimensions'>,
    session: PreviewSession,
    context: CheckContext
): PreviewSession {
    const sizes = sizesDimension(document.dimensions)?.id;
    const kept = Object.fromEntries(Object.entries(session.modes).filter(([id]) => id !== sizes));

    return {
        ...session,
        modes: { ...kept, ...context.modes },
        viewport: { ...context.size.size },
        layoutId: undefined,
        layoutMode: 'auto',
        scope: 'all-screens'
    };
}

/** Draws every screen in each context, as the Prototype and a download do, and audits it. */
export function checkAccessibility(
    document: Document,
    session: PreviewSession,
    contexts: readonly CheckContext[],
    rules: AccessibilityRules
): CheckedContext[] {
    return contexts.map((context) => {
        try {
            const drawing = projectPreview(
                document,
                {},
                [],
                contextSession(document, session, context),
                {}
            );

            return {
                context,
                drawing,
                screens: drawing.screens.map((screen) => ({
                    id: screen.id,
                    name: screen.name,
                    report: auditScreen(screen, rules, undefined, drawing.states)
                }))
            };
        } catch (error) {
            return {
                context,
                screens: [],
                problem: error instanceof Error ? error.message : String(error)
            };
        }
    });
}

/** Shape IDs along a node key, outermost first, without the screen and line parts. */
const keyShapes = (key: string) =>
    key
        .split('/')
        .slice(1)
        .filter((part) => !/^(line-\d+|art)$/.test(part));

const shapeOf = (document: Document, key: string): Shape | undefined => {
    const id = keyShapes(key).at(-1);

    return id ? document.shapes[id] : undefined;
};

const pageShape = (document: Document, key: string) => {
    const id = keyShapes(key)[0];

    return id && document.shapes[id] ? id : undefined;
};

const quoted = (text: string) => `“${text.length > 40 ? `${text.slice(0, 39)}…` : text}”`;

function whenText(document: Document, when: AuditWhen | undefined) {
    if (!when) {
        return '';
    }

    return 'variant' in when
        ? ` in its ${document.components[when.variant]?.name ?? 'other'} variant`
        : ' once shown';
}

function describe(document: Document, problem: AuditProblem) {
    switch (problem.kind) {
        case 'contrast':
            return `${quoted(problem.text)}${whenText(document, problem.when)} has contrast ${problem.ratio}:1 on ${problem.background}; it needs ${problem.required}:1.`;
        case 'name':
            return problem.name
                ? `The ${problem.role} ${quoted(problem.visible)}${whenText(document, problem.when)} is named ${quoted(problem.name)}, which doesn't include the text it shows.`
                : `A${problem.role === 'input' ? 'n input' : ' button'}${whenText(document, problem.when)} has no name.`;
        case 'focusOrder':
            return `Tab goes from ${quoted(problem.after)} back to ${quoted(problem.name)}, which comes earlier on the page.`;
    }
}

/** Where a text's color comes from: the variable mode value it reads, or its own color. */
type ColorSource =
    | { kind: 'variable'; variable: string; mode: string; name: string; modeName?: string }
    | { kind: 'shape'; shape: string; name: string };

function colorSource(
    document: Document,
    entry: AuditContrast,
    context: CheckContext
): ColorSource | undefined {
    const shape = shapeOf(document, entry.key);
    if (shape?.type !== 'text') {
        return undefined;
    }
    const bound = boundVariable(shape, 'fontColor', document);
    if (!bound) {
        // An instance override drew another color; changing the source wouldn't fix it.
        return (shape.fontColor ?? '#000000').toLowerCase() === entry.color
            ? { kind: 'shape', shape: shape.id, name: shape.name }
            : undefined;
    }
    const definition = variableDefinition(bound, document.variables);
    if (definition.type !== 'color') {
        return undefined;
    }
    const chosen = definition.dimensionId ? context.modes[definition.dimensionId] : undefined;
    const same = (mode: string) => definition.values[mode]?.toLowerCase() === entry.color;
    const mode =
        chosen && Object.hasOwn(definition.values, chosen) && same(chosen)
            ? chosen
            : !chosen && same('default')
              ? 'default'
              : Object.keys(definition.values).find(same);
    if (!mode) {
        return undefined;
    }
    const dimension = document.dimensions[definition.dimensionId ?? ''];

    return {
        kind: 'variable',
        variable: definition.id,
        mode,
        name: definition.name,
        modeName: mode === 'default' ? undefined : dimension?.modes[mode]?.name
    };
}

const sourceId = (source: ColorSource) =>
    source.kind === 'variable'
        ? `variable:${source.variable}:${source.mode}`
        : `shape:${source.shape}`;

/** A fix for each text color that fails somewhere: the closest color that passes everywhere it is used. */
function contrastFixes(document: Document, checked: readonly CheckedContext[]) {
    const uses = new Map<
        string,
        { source: ColorSource; color: string; entries: AuditContrast[] }
    >();
    const failing = new Set<string>();
    const sources = new Map<string, string>();
    for (const { context, screens } of checked) {
        for (const { report } of screens) {
            for (const entry of report.contrast) {
                const source = colorSource(document, entry, context);
                if (!source) {
                    continue;
                }
                const id = sourceId(source);
                sources.set(`${context.id}\n${entry.key}`, id);
                const use = uses.get(id) ?? { source, color: entry.color, entries: [] };
                use.entries.push(entry);
                uses.set(id, use);
                if (entry.ratio < entry.required) {
                    failing.add(id);
                }
            }
        }
    }
    const fixes = new Map<string, { source: ColorSource; color: string }>();
    for (const id of failing) {
        const { source, color, entries } = uses.get(id)!;
        const next = adjustedColor(color, entries);
        if (next) {
            fixes.set(id, { source, color: next });
        }
    }

    return { fixes, sourceOf: (context: string, key: string) => sources.get(`${context}\n${key}`) };
}

function contrastFix(source: ColorSource, color: string): Fix {
    if (source.kind === 'shape') {
        return {
            text: `Change ${source.name}'s text color to ${color}.`,
            operations: [{ op: 'updateShape', shape: source.shape, changes: { fontColor: color } }]
        };
    }

    return {
        text: `Change ${source.name}${source.modeName ? ` in ${source.modeName}` : ''} to ${color}.`,
        operations: [
            source.mode === 'default'
                ? { op: 'updateVariable', variable: source.variable, value: color }
                : {
                      op: 'updateVariable',
                      variable: source.variable,
                      modeValues: { [source.mode]: color }
                  }
        ]
    };
}

function nameFix(document: Document, problem: AuditProblem & { kind: 'name' }): Fix | undefined {
    const shape = shapeOf(document, problem.key);
    if (shape?.type !== 'instance' || !problem.visible) {
        return undefined;
    }
    const component = document.components[instanceComponentId(document, shape)];
    const propId = component && effectiveRoleSettings(component, shape).props.label;
    if (propId && component.props?.some(({ id }) => id === propId)) {
        return {
            text: `Set ${shape.name}'s Label to ${quoted(problem.visible)}.`,
            operations: [
                {
                    op: 'updateShape',
                    shape: shape.id,
                    changes: { overrides: { ...shape.overrides, [propId]: problem.visible } }
                }
            ]
        };
    }

    // Without a linked label, a control is named after its layer.
    return {
        text: `Rename ${shape.name} to ${quoted(problem.visible)}.`,
        operations: [{ op: 'updateShape', shape: shape.id, changes: { name: problem.visible } }]
    };
}

const ADVICE = {
    contrast: 'Change the text or background color in the component it comes from.',
    contrastEverywhere:
        'No one color reads on every background it is drawn on here. Bind it to a color variable with a value for each mode.',
    name: 'Link the component’s Label to a text property and give it words.',
    focusOrder:
        'Tab follows the layer order: move the later control below the earlier one in Layers.'
};

/** The problems of every context, each once with the contexts it shows in and a fix when one is known. */
export function accessibilityIssues(
    document: Document,
    checked: readonly CheckedContext[]
): AccessibilityIssue[] {
    const { fixes, sourceOf } = contrastFixes(document, checked);
    const issues = new Map<string, AccessibilityIssue>();
    for (const { context, screens } of checked) {
        for (const screen of screens) {
            for (const problem of screen.report.problems) {
                const source =
                    problem.kind === 'contrast' ? sourceOf(context.id, problem.key) : undefined;
                // Texts that fail for one color source and one reason are one issue.
                const id = JSON.stringify(
                    problem.kind === 'contrast'
                        ? [problem.kind, problem.key, source ?? problem.color, problem.when]
                        : [problem.kind, problem.key, 'when' in problem ? problem.when : undefined]
                );
                const known = issues.get(id);
                if (known) {
                    if (!known.contexts.includes(context.name)) {
                        known.contexts.push(context.name);
                    }
                    continue;
                }
                const contrast = source ? fixes.get(source) : undefined;
                const fix =
                    problem.kind === 'contrast'
                        ? contrast && contrastFix(contrast.source, contrast.color)
                        : problem.kind === 'name'
                          ? nameFix(document, problem)
                          : undefined;
                issues.set(id, {
                    id,
                    problem,
                    screenId: screen.id,
                    screenName: screen.name,
                    contexts: [context.name],
                    shapeId: pageShape(document, problem.key),
                    message: describe(document, problem),
                    ...(fix
                        ? { fix }
                        : {
                              advice:
                                  problem.kind === 'contrast' && source
                                      ? ADVICE.contrastEverywhere
                                      : ADVICE[problem.kind]
                          })
                });
            }
        }
    }

    return [...issues.values()];
}

/** Every known fix as one batch, with one operation per changed record. */
export function fixOperations(issues: readonly AccessibilityIssue[]): Operation[] {
    const variables = new Map<string, UpdateVariable>();
    const shapes = new Map<string, UpdateShape>();
    for (const operation of issues.flatMap(({ fix }) => fix?.operations ?? [])) {
        if (operation.op === 'updateVariable') {
            const known = variables.get(operation.variable);
            variables.set(operation.variable, {
                ...known,
                ...operation,
                ...(known?.modeValues || operation.modeValues
                    ? { modeValues: { ...known?.modeValues, ...operation.modeValues } }
                    : {})
            });
        } else if (operation.op === 'updateShape') {
            const known = shapes.get(operation.shape);
            shapes.set(operation.shape, {
                ...operation,
                changes: { ...known?.changes, ...operation.changes } as UpdateShape['changes']
            });
        }
    }

    return [...variables.values(), ...shapes.values()];
}

/** What the AI is told: each problem, where it shows, and the change the check would make. */
export function accessibilityContext(issues: readonly AccessibilityIssue[]) {
    return {
        fixes: fixOperations(issues),
        problems: issues.map((issue) => ({
            problem: issue.message,
            kind: issue.problem.kind,
            page: issue.screenName,
            contexts: issue.contexts,
            ...(issue.shapeId ? { shape: issue.shapeId } : {}),
            ...(issue.fix ? { fix: issue.fix.text } : { advice: issue.advice })
        }))
    };
}

export const ISSUE_PRIORITIES = ['must', 'should', 'nice'] as const;
export type IssuePriority = (typeof ISSUE_PRIORITIES)[number];

/**
 * Must have: what stops someone using the page (Tab going backwards, text below the large-text
 * contrast). Should have: the rest of the start state. Nice to have: what only a variant or a
 * hidden state shows.
 */
export function issuePriority(
    { problem }: AccessibilityIssue,
    rules: AccessibilityRules
): IssuePriority {
    if (
        problem.kind === 'focusOrder' ||
        (problem.kind === 'contrast' && problem.ratio < rules.largeTextContrast)
    ) {
        return 'must';
    }

    return problem.when ? 'nice' : 'should';
}
