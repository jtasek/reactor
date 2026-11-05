import { variantActionCheck, prototypeTargetCheck } from 'src/app/interactiveVariants';
import { projectGeometry } from 'src/app/contextualGeometry';
import { projectDataList } from './dataLists';
import { effectiveActivation } from 'src/app/screenInteractions';
import { screenOwners } from '../app/screenViews';
import {
    screenLayoutDocument,
    screenLayoutMembers,
    screenLayoutRoot,
    MISSING_SCREEN_LAYOUT,
    selectScreenLayout,
    screenLayouts,
    screenLayoutProblems
} from '../app/screenLayouts';
import type { Document, Shape, VariableContext, Size } from '../app/types';
import { layoutDocument } from '../app/frameLayout';
import { projectContextualLayout } from '../app/contextualLayout';
import { screenFrames } from '../app/screens';
import { shownShapesIds } from '../app/membership';
import { instanceComponent, instanceSource, instanceBox } from '../app/componentSource';
import { applyInstanceOverrides } from '../app/componentProps';
import { effectiveRoleSettings, resolveComponentRole } from '../app/componentRoles';
import { themeColors } from '../app/themeColors';
import { instanceModes, resolveModes } from '../app/inheritedModes';
import { assertNever, boxCenter, getShapeBounds, DEFAULT_TEXT_FONT_SIZE } from '../app/utils';
import type { PreviewDrawing, PreviewNode } from './protocol';

export interface PreviewInspection {
    width?: number;
    /** Undefined follows launch choice; null selects Auto; a screen ID selects Default. */
    layouts?: Record<string, string | null>;
}

export interface PreviewSession {
    modes: VariableContext;
    screenId?: string;
    viewport?: Size;
    layoutId?: string;
    layoutMode?: 'auto';
    /** Full Prototype sessions carry their viewport and modes across navigation. */
    scope?: 'all-screens';
}

export interface PreviewDiagnostic {
    kind: 'shape' | 'frame';
    id: string;
    name?: string;
    message: string;
}

/** A read-only projection. Source component records and bindings never cross the sandbox boundary.
 * Problems that leave the prototype usable, such as a link to a deleted screen, go to `warnings`. */
export function projectPreview(
    authoredDocument: Document,
    context: VariableContext,
    warnings: string[] = [],
    session?: PreviewSession | null,
    inspection: PreviewInspection = {},
    diagnostics: PreviewDiagnostic[] = []
): PreviewDrawing {
    const screens = screenFrames(authoredDocument);
    const viewportWidth = inspection.width ?? session?.viewport?.width;
    const address = {
        simulation: context,
        session: session?.modes,
        sessionScreenId: session?.scope === 'all-screens' ? undefined : session?.screenId
    };
    // Without an inspection viewport, bindings and Hug/Fill still define each screen's size.
    const intrinsic =
        viewportWidth === undefined &&
        screens.some((screen) => screen.bindings?.width || screen.bindings?.height || screen.sizing)
            ? layoutDocument(authoredDocument, projectContextualLayout(authoredDocument, address))
            : authoredDocument;
    const choices = new Map(
        screens.map((screen) => {
            const explicit = inspection.layouts?.[screen.id];
            const initial =
                screen.id === session?.screenId && (session.viewport || session.layoutId)
                    ? (session.layoutId ?? (session.layoutMode === 'auto' ? null : screen.id))
                    : null;
            const choice = explicit === undefined ? initial : explicit;
            const size = {
                ...intrinsic.frames[screen.id].size,
                ...(session?.scope === 'all-screens' || screen.id === session?.screenId
                    ? session?.viewport
                    : {}),
                width: viewportWidth ?? intrinsic.frames[screen.id].size.width
            };
            const layoutId = selectScreenLayout(authoredDocument, screen.id, {
                layoutId: choice ?? undefined,
                layoutMode: choice === null ? 'auto' : undefined,
                size
            });
            const layoutProblems = screenLayoutProblems(authoredDocument, screen.id);
            warnings.push(...layoutProblems);
            diagnostics.push(
                ...layoutProblems.map((message) => ({
                    kind: 'frame' as const,
                    id: screen.id,
                    message
                }))
            );
            // A rule's missing target is already among the rule problems.
            if (choice && screenLayoutRoot(authoredDocument, screen.id, choice)?.id !== choice) {
                warnings.push(MISSING_SCREEN_LAYOUT);
            }

            return [screen.id, { choice, layoutId, size }] as const;
        })
    );
    const sourceDocument = screens.reduce((document, screen) => {
        const selected = choices.get(screen.id)!;

        // Only the launch view supplies a height. Width inspection must not clear other
        // screens' height constraints or height bindings on their layout roots.
        const size =
            viewportWidth === undefined
                ? selected.size
                : {
                      width: viewportWidth,
                      ...((session?.scope === 'all-screens' || screen.id === session?.screenId) &&
                      session?.viewport
                          ? { height: session.viewport.height }
                          : {})
                  };
        const resized = screenLayoutDocument(document, screen.id, selected.layoutId, size);
        if (viewportWidth !== undefined) {
            return resized;
        }

        // Fit the alternate tree, but retain the canonical screen's bindings and diagnostics.
        return {
            ...resized,
            frames: { ...resized.frames, [screen.id]: document.frames[screen.id] }
        };
    }, authoredDocument);
    const members = new Map(
        screens.map((frame) => [
            frame.id,
            screenLayoutMembers(sourceDocument, frame.id, choices.get(frame.id)?.layoutId)
        ])
    );
    const inactiveFrames = new Set(
        [...screenOwners(sourceDocument.frames)].flatMap(([id, owner]) =>
            owner && members.has(owner) && !members.get(owner)!.has(id) ? [id] : []
        )
    );
    const activeProblems = (problems: Record<string, string>): PreviewDiagnostic[] =>
        Object.entries(problems)
            .filter(
                ([id]) =>
                    !inactiveFrames.has(id) &&
                    !inactiveFrames.has(sourceDocument.shapes[id]?.parentFrameId ?? '')
            )
            .map(([id, message]) => ({
                kind: sourceDocument.frames[id] ? 'frame' : 'shape',
                id,
                message
            }));

    const layout = projectContextualLayout(sourceDocument, address);
    const problems = activeProblems(layout.problems);
    const modeProblems = activeProblems(layout.modeProblems ?? {});
    warnings.push(...modeProblems.map(({ message }) => message));
    diagnostics.push(...problems, ...modeProblems);
    if (problems.length) {
        throw new Error(problems.map(({ message }) => message).join(' '));
    }
    const document = layoutDocument(sourceDocument, layout);
    const roots = screenFrames(document).sort(
        (a, b) => Number(b.id === session?.screenId) - Number(a.id === session?.screenId)
    );
    const screenIds = new Set(roots.map((frame) => frame.id));
    const shown = shownShapesIds({ ...document, shownLayerId: undefined }, null);
    const root = (screenId: string) =>
        screenLayoutRoot(document, screenId, choices.get(screenId)?.layoutId)!;
    const activeInstances = new Set(
        document.shapesIds.filter(
            (id) =>
                shown.has(id) &&
                [...members.values()].some((ids) =>
                    ids.has(document.shapes[id].parentFrameId ?? '')
                )
        )
    );
    const { draw, identities } = createArtworkProjector(
        document,
        warnings,
        diagnostics,
        screenIds,
        true,
        activeInstances
    );

    const drawing: PreviewDrawing = {
        documentId: document.id,
        booleans: Object.fromEntries(
            Object.values(document.prototypeBooleans).map((value) => [
                `state:${value.id}`,
                value.initial
            ])
        ),
        screens: roots.map((frame) => ({
            id: frame.id,
            name: frame.name,
            x: root(frame.id).position.x,
            y: root(frame.id).position.y,
            ...frame.size,
            layouts: [
                { id: frame.id, name: 'Default layout' },
                ...screenLayouts(document, frame.id)
            ].map(({ id, name }) => ({ id, name })),
            layoutChoice: choices.get(frame.id)!.choice,
            nodes: document.shapesIds
                .filter(
                    (id) =>
                        shown.has(id) &&
                        members.get(frame.id)!.has(document.shapes[id].parentFrameId ?? '')
                )
                .map((id) => {
                    const shape = document.shapes[id];
                    const resolved = resolveModes(document, {
                        simulation: context,
                        screenId: frame.id,
                        frameId: shape.parentFrameId,
                        // The launch snapshot belongs to its own Screen; others keep their choices.
                        session:
                            session?.scope === 'all-screens' || frame.id === session?.screenId
                                ? session?.modes
                                : undefined
                    });
                    warnings.push(...resolved.problems);

                    return draw(
                        themeColors(shape, document, resolved.modes),
                        frame.id,
                        new Set(),
                        resolved.modes,
                        frame.id
                    );
                })
        }))
    };
    const duplicateInputKeys = new Set<string>();
    for (const nodes of identities.values()) {
        if (nodes.length < 2) {
            continue;
        }
        warnings.push(
            'Duplicate input identity in a screen layout. Give each input a unique identity; these inputs reset when layouts change.'
        );
        for (const node of nodes) {
            if (node.control?.stateKey) {
                duplicateInputKeys.add(node.control.stateKey);
            }
            delete node.control!.stateKey;
        }
    }

    const clearDuplicateInputs = (node: PreviewNode) => {
        if (node.control?.stateKey && duplicateInputKeys.has(node.control.stateKey)) {
            delete node.control.stateKey;
        }
        node.children?.forEach(clearDuplicateInputs);
        Object.values(node.variants ?? {}).forEach(clearDuplicateInputs);
    };
    drawing.screens.forEach((screen) => screen.nodes.forEach(clearDuplicateInputs));

    return drawing;
}

/** Canvas artwork projection shared by Preview and SVG export. Without screen IDs it omits
 * interactive roles entirely: export must not depend on navigation or form configuration. */
export function createArtworkProjector(
    document: Document,
    warnings: string[] = [],
    diagnostics: PreviewDiagnostic[] = [],
    screenIds?: ReadonlySet<string>,
    includeVariants = true,
    activeInstances?: ReadonlySet<string>,
    /** Shared with the projectors that draw variant alternatives, so they count toward one limit. */
    nodes = { count: 0 }
) {
    const identities = new Map<string, PreviewNode[]>();
    const checkVariantAction = variantActionCheck(document);
    const checkVisibilityTarget = prototypeTargetCheck(document);
    const requestedVariants = new Map<string, Set<string>>();
    for (const shape of Object.values(document.shapes)) {
        if (
            !includeVariants ||
            shape.type !== 'instance' ||
            !activeInstances?.has(shape.id) ||
            shape.dataList
        ) {
            continue;
        }
        const component = document.components[shape.componentId];
        const action = component && effectiveActivation(component, shape);
        if (action?.type !== 'changeVariant') {
            continue;
        }
        const variants = requestedVariants.get(action.instanceId) ?? new Set<string>();
        variants.add(action.variantId);
        requestedVariants.set(action.instanceId, variants);
    }
    // Errors name the feature the person used; export has no screen set.
    const subject = screenIds ? 'Preview' : 'SVG export';
    const verb = screenIds ? 'previewing' : 'exporting';
    const draw = (
        shape: Shape,
        path: string,
        ancestors: ReadonlySet<string>,
        inherited: VariableContext,
        screenId: string,
        recordScope?: string,
        controlKey?: string
    ): PreviewNode => {
        const context =
            shape.type === 'instance'
                ? instanceModes(document, inherited, shape, warnings)
                : inherited;
        nodes.count += 1;
        if (nodes.count > 5000) {
            throw new Error(`${subject} exceeds 5000 drawing nodes.`);
        }
        const key = `${path}/${shape.id}`;
        if (screenIds && shape.type === 'instance' && shape.dataList) {
            const reported = new Set<string>();
            // Unfinished data warns and falls back to the template; it never stops Preview.
            const report = (problem: string) => {
                const message = `${shape.name}: ${problem}`;
                if (!reported.has(message)) {
                    reported.add(message);
                    warnings.push(message);
                    diagnostics.push({ kind: 'shape', id: shape.id, message });
                }
            };
            if (!document.dataEntities[shape.dataList.entityId]) {
                report('The list entity is unavailable, so the template is shown once.');

                return draw(
                    { ...shape, dataList: undefined },
                    path,
                    ancestors,
                    inherited,
                    screenId,
                    recordScope
                );
            }

            return projectDataList(
                document,
                shape,
                key,
                inherited,
                ancestors,
                (item, path, recordId) =>
                    draw(
                        item,
                        path,
                        ancestors,
                        inherited,
                        screenId,
                        JSON.stringify([recordScope, key, recordId])
                    ),
                report
            );
        }
        const bounds = getShapeBounds(shape);
        const center = boxCenter(bounds);
        const attrs: PreviewNode['attrs'] = { opacity: shape.opacity ?? 1 };
        const paint = {
            fill: shape.fill ?? 'none',
            stroke: shape.stroke ?? 'var(--shape-stroke-color)',
            // Matches the canvas's `.shape` stroke width.
            'stroke-width': 2
        };
        const group: PreviewNode = { key, tag: 'g', attrs, children: [] };
        const primitive = (tag: PreviewNode['tag'], attrs: PreviewNode['attrs'], text?: string) => {
            group.children!.push({
                key: `${key}/art`,
                tag,
                attrs,
                ...(text === undefined ? {} : { text })
            });
        };
        if (shape.rotation) {
            attrs.transform = `rotate(${shape.rotation} ${center.x} ${center.y})`;
        }
        switch (shape.type) {
            case 'rectangle':
                primitive('rect', {
                    x: shape.position.x,
                    y: shape.position.y,
                    ...shape.size,
                    rx: Math.min(
                        shape.cornerRadius ?? 0,
                        shape.size.width / 2,
                        shape.size.height / 2
                    ),
                    ...paint
                });
                break;
            case 'circle':
                primitive('circle', {
                    cx: shape.position.x,
                    cy: shape.position.y,
                    r: shape.radius,
                    ...paint
                });
                break;
            case 'ellipse':
                primitive('ellipse', {
                    cx: shape.position.x,
                    cy: shape.position.y,
                    rx: shape.radius.x,
                    ry: shape.radius.y,
                    ...paint
                });
                break;
            case 'line':
                primitive('line', {
                    x1: shape.start.x,
                    y1: shape.start.y,
                    x2: shape.end.x,
                    y2: shape.end.y,
                    ...paint
                });
                break;
            case 'pen':
                primitive('polyline', {
                    points: shape.points.map(({ x, y }) => `${x},${y}`).join(' '),
                    ...paint
                });
                break;
            case 'text': {
                const lines = shape.textLayout?.lines ?? [shape.value];
                lines.forEach((line, index) => {
                    group.children!.push({
                        key: `${key}/line-${index}`,
                        tag: 'text',
                        attrs: {
                            x: shape.position.x,
                            y: shape.position.y + index * (shape.textLayout?.lineHeight ?? 0),
                            'font-size': shape.fontSize ?? DEFAULT_TEXT_FONT_SIZE,
                            ...(shape.fontWeight === undefined
                                ? {}
                                : { 'font-weight': shape.fontWeight }),
                            ...(shape.fontColor === undefined ? {} : { fill: shape.fontColor })
                        },
                        text: line
                    });
                });
                break;
            }
            case 'image': {
                const hash = /^asset:([a-f0-9]{64})$/.exec(shape.source)?.[1];
                if (!hash) {
                    const message = `${shape.name}: ${screenIds ? 'preview' : 'exported'} images must be stored Reactor assets. Import this image before ${verb}.`;
                    diagnostics.push({ kind: 'shape', id: shape.id, message });
                    throw new Error(message);
                }
                group.children!.push({
                    key: `${key}/art`,
                    tag: 'image',
                    image: hash,
                    attrs: {
                        x: shape.position.x,
                        y: shape.position.y,
                        ...shape.size,
                        preserveAspectRatio: 'xMidYMid meet'
                    }
                });
                break;
            }
            case 'instance': {
                const source = instanceSource(document, shape, ancestors);
                const component = document.components[shape.componentId];
                if (!source || !component) {
                    const message = `${shape.name}: missing or cyclic component source.`;
                    diagnostics.push({ kind: 'shape', id: shape.id, message });
                    throw new Error(message);
                }
                const box = instanceBox(shape, source);
                const pivot = boxCenter(box);
                attrs.transform = `${shape.rotation ? `rotate(${shape.rotation} ${pivot.x} ${pivot.y}) ` : ''}translate(${shape.position.x - source.box.topLeft.x} ${shape.position.y - source.box.topLeft.y})`;
                const drawn = instanceComponent(document, shape) ?? component;
                const next = new Set(ancestors).add(drawn.id);
                group.children = source.shapes.flatMap((member) => {
                    const resolved = shape.projectedSource
                        ? themeColors(member, document, context)
                        : applyInstanceOverrides(
                              themeColors(member, document, context),
                              shape,
                              drawn,
                              document,
                              context
                          );

                    return resolved.visible
                        ? [draw(resolved, key, next, context, screenId, recordScope)]
                        : [];
                });
                if (!screenIds) {
                    break;
                }
                const role = resolveComponentRole(document, component, shape);
                if (role.problems.length) {
                    const message = `${shape.name}: ${role.problems.join(' ')}`;
                    diagnostics.push({ kind: 'shape', id: shape.id, message });
                    throw new Error(message);
                }
                const settings = effectiveRoleSettings(component, shape);
                const activation = effectiveActivation(component, shape);
                const variantAction = activation?.type === 'changeVariant' ? activation : undefined;
                const variantTarget = variantAction
                    ? document.shapes[variantAction.instanceId]
                    : undefined;
                const changeVariant =
                    variantAction &&
                    variantTarget?.type === 'instance' &&
                    !recordScope &&
                    (path === screenId || controlKey !== undefined) &&
                    activeInstances?.has(variantTarget.id) &&
                    checkVariantAction(variantAction, screenId)
                        ? {
                              key: JSON.stringify([
                                  screenId,
                                  variantTarget.id,
                                  variantTarget.componentId
                              ]),
                              variantId: variantAction.variantId
                          }
                        : undefined;
                const unavailable = `${shape.name}: variant target is unavailable in this screen. Choose an available instance and variant.`;
                if (variantAction && !changeVariant && !warnings.includes(unavailable)) {
                    warnings.push(unavailable);
                }
                const visibilityAction =
                    activation?.type === 'toggleVisibility' ? activation : undefined;
                const visibilityTarget = visibilityAction
                    ? document.shapes[visibilityAction.instanceId]
                    : undefined;
                const toggleVisibility =
                    visibilityAction &&
                    visibilityTarget?.type === 'instance' &&
                    !recordScope &&
                    (path === screenId || controlKey !== undefined) &&
                    activeInstances?.has(visibilityTarget.id) &&
                    checkVisibilityTarget(visibilityTarget.id, screenId)
                        ? JSON.stringify([
                              screenId,
                              visibilityTarget.id,
                              visibilityTarget.componentId
                          ])
                        : undefined;
                if (visibilityAction && !toggleVisibility) {
                    const message = `${shape.name}: visibility target is unavailable in this screen. Choose another instance in Interactions.`;
                    if (!warnings.includes(message)) {
                        warnings.push(message);
                        diagnostics.push({ kind: 'shape', id: shape.id, message });
                    }
                }
                if (
                    includeVariants &&
                    !recordScope &&
                    path === screenId &&
                    activeInstances?.has(shape.id) &&
                    checkVisibilityTarget(shape.id, screenId)
                ) {
                    if (
                        shape.prototypeVisibilityStateId &&
                        !document.prototypeBooleans[shape.prototypeVisibilityStateId]
                    ) {
                        const message = `${shape.name}: visibility state is missing; using its initial visibility.`;
                        if (!warnings.includes(message)) {
                            warnings.push(message);
                            diagnostics.push({ kind: 'shape', id: shape.id, message });
                        }
                    }
                    group.visibility = {
                        key: JSON.stringify([screenId, shape.id, component.id]),
                        initial: shape.prototypeVisible ?? true,
                        ...(shape.prototypeVisibilityStateId &&
                        document.prototypeBooleans[shape.prototypeVisibilityStateId]
                            ? { stateKey: `state:${shape.prototypeVisibilityStateId}` }
                            : {})
                    };
                }
                const stateId =
                    activation?.type === 'toggleState'
                        ? activation.stateId
                        : toggleVisibility && visibilityTarget?.type === 'instance'
                          ? visibilityTarget.prototypeVisibilityStateId
                          : undefined;
                const toggleState =
                    stateId &&
                    document.prototypeBooleans[stateId] &&
                    !recordScope &&
                    (path === screenId || controlKey !== undefined)
                        ? `state:${stateId}`
                        : undefined;
                if (activation?.type === 'toggleState' && !toggleState) {
                    const message = !document.prototypeBooleans[activation.stateId]
                        ? `${shape.name}: prototype state is missing. Choose a state in Interactions.`
                        : recordScope
                          ? `${shape.name}: controls in repeated records cannot toggle prototype state yet.`
                          : `${shape.name}: this control cannot toggle prototype state here. Use a control placed on the screen.`;
                    if (!warnings.includes(message)) {
                        warnings.push(message);
                        diagnostics.push({ kind: 'shape', id: shape.id, message });
                    }
                }
                const target = activation?.screenId;
                const navigateTo = target && screenIds.has(target) ? target : undefined;
                if (target && !navigateTo) {
                    const message = `${shape.name} links to an unavailable screen and does nothing. Choose another screen in Interactions.`;
                    warnings.push(message);
                    diagnostics.push({ kind: 'shape', id: shape.id, message });
                }
                const label = String(
                    role.props.label ?? role.props.content ?? role.props.alt ?? ''
                );
                if (role.role !== 'none' || activation) {
                    group.control = {
                        // An Activate action needs a native keyboard-operable control.
                        role:
                            role.role === 'none' || (activation && role.role !== 'input')
                                ? 'button'
                                : role.role,
                        label: activation && !label ? shape.name : label,
                        value: typeof role.props.value === 'string' ? role.props.value : undefined,
                        placeholder:
                            typeof role.props.placeholder === 'string'
                                ? role.props.placeholder
                                : undefined,
                        disabled: role.props.disabled === true,
                        navigateTo,
                        ...(changeVariant ? { changeVariant } : {}),
                        // A bound target's disclosure keeps aria-controls; the state is what toggles.
                        ...(toggleState ? { toggleState } : {}),
                        ...(toggleVisibility ? { toggleVisibility } : {}),
                        ...(controlKey ? { stateKey: controlKey } : {}),
                        ...(role.role === 'input'
                            ? {
                                  stateKey: JSON.stringify([
                                      screenId,
                                      ...(recordScope ? [recordScope] : []),
                                      shape.interaction?.controlId && settings.props.value
                                          ? ['shared', shape.interaction.controlId]
                                          : ['node', controlKey ?? key],
                                      component.id,
                                      settings.props.value ?? '',
                                      'text'
                                  ])
                              }
                            : {}),
                        x: source.box.topLeft.x,
                        y: source.box.topLeft.y,
                        width: source.box.width,
                        height: source.box.height
                    };
                }
                if (
                    includeVariants &&
                    requestedVariants.has(shape.id) &&
                    !recordScope &&
                    path === screenId &&
                    component.variantIds?.length
                ) {
                    const variants = [
                        ...new Set([drawn.id, ...requestedVariants.get(shape.id)!])
                    ].filter(
                        (id) =>
                            Boolean(document.components[id]) &&
                            (id === component.id || component.variantIds?.includes(id))
                    );
                    group.variantKey = JSON.stringify([screenId, shape.id, component.id]);
                    group.initialVariant = drawn.id;
                    const projector = createArtworkProjector(
                        document,
                        warnings,
                        diagnostics,
                        screenIds,
                        false,
                        activeInstances,
                        nodes
                    );
                    group.variants = Object.fromEntries(
                        variants.map((variantId) => {
                            const projected = projectGeometry(
                                {
                                    ...shape,
                                    variantId: variantId === component.id ? undefined : variantId,
                                    variantMode: undefined,
                                    projectedSource: undefined
                                },
                                document,
                                inherited,
                                shape.projectedSource?.context?.availableWidth,
                                ancestors,
                                {},
                                shape.projectedSource?.context?.widths
                            );

                            return [
                                variantId,
                                projector.draw(
                                    projected,
                                    `${path}/variant-${variantId}`,
                                    ancestors,
                                    inherited,
                                    screenId,
                                    undefined,
                                    key
                                )
                            ];
                        })
                    );
                }
                if (role.role === 'input' && shape.interaction?.controlId) {
                    const identity = JSON.stringify([
                        screenId,
                        recordScope,
                        shape.interaction.controlId
                    ]);
                    identities.set(identity, [...(identities.get(identity) ?? []), group]);
                    if (!settings.props.value) {
                        warnings.push(
                            `${shape.name}: link a Value property to preserve input across layouts.`
                        );
                    }
                }
                break;
            }
            default:
                assertNever(shape);
        }

        return group;
    };

    return { draw, identities };
}
