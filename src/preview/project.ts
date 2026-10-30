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

/** A read-only projection. Source component records and bindings never cross the sandbox boundary.
 * Problems that leave the prototype usable, such as a link to a deleted screen, go to `warnings`. */
export function projectPreview(
    authoredDocument: Document,
    context: VariableContext,
    warnings: string[] = [],
    session?: {
        modes: VariableContext;
        screenId?: string;
        viewport?: Size;
        layoutId?: string;
        layoutMode?: 'auto';
    } | null,
    inspection: PreviewInspection = {}
): PreviewDrawing {
    const screens = screenFrames(authoredDocument);
    const viewportWidth = inspection.width ?? session?.viewport?.width;
    const address = {
        simulation: context,
        session: session?.modes,
        sessionScreenId: session?.screenId
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
                ...(screen.id === session?.screenId ? session.viewport : {}),
                width: viewportWidth ?? intrinsic.frames[screen.id].size.width
            };
            const layoutId = selectScreenLayout(authoredDocument, screen.id, {
                layoutId: choice ?? undefined,
                layoutMode: choice === null ? 'auto' : undefined,
                size
            });
            warnings.push(...screenLayoutProblems(authoredDocument, screen.id));
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
                      ...(screen.id === session?.screenId && session.viewport
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
    const activeProblems = (problems: Record<string, string>) =>
        Object.entries(problems)
            .filter(
                ([id]) =>
                    !inactiveFrames.has(id) &&
                    !inactiveFrames.has(sourceDocument.shapes[id]?.parentFrameId ?? '')
            )
            .map(([, problem]) => problem);

    const layout = projectContextualLayout(sourceDocument, address);
    const problems = activeProblems(layout.problems);
    warnings.push(...activeProblems(layout.modeProblems ?? {}));
    if (problems.length) {
        throw new Error(problems.join(' '));
    }
    const document = layoutDocument(sourceDocument, layout);
    const roots = screenFrames(document).sort(
        (a, b) => Number(b.id === session?.screenId) - Number(a.id === session?.screenId)
    );
    const screenIds = new Set(roots.map((frame) => frame.id));
    const shown = shownShapesIds({ ...document, shownLayerId: undefined }, null);
    const root = (screenId: string) =>
        screenLayoutRoot(document, screenId, choices.get(screenId)?.layoutId)!;
    const identities = new Map<string, PreviewNode[]>();
    let count = 0;
    const draw = (
        shape: Shape,
        path: string,
        ancestors: ReadonlySet<string>,
        inherited: VariableContext,
        screenId: string
    ): PreviewNode => {
        const context =
            shape.type === 'instance'
                ? instanceModes(document, inherited, shape, warnings)
                : inherited;
        count += 1;
        if (count > 5000) {
            throw new Error('Preview exceeds 5000 drawing nodes.');
        }
        const key = `${path}/${shape.id}`;
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
                    throw new Error(
                        `${shape.name}: preview images must be stored Reactor assets. Import this image before previewing.`
                    );
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
                    throw new Error(`${shape.name}: missing or cyclic component source.`);
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

                    return resolved.visible ? [draw(resolved, key, next, context, screenId)] : [];
                });
                const role = resolveComponentRole(document, component, shape);
                if (role.problems.length) {
                    throw new Error(`${shape.name}: ${role.problems.join(' ')}`);
                }
                const settings = effectiveRoleSettings(component, shape);
                let navigateTo = role.role === 'button' ? settings.navigateTo : undefined;
                if (navigateTo && !screenIds.has(navigateTo)) {
                    // The button stays clickable; it just goes nowhere until relinked.
                    warnings.push(
                        `${shape.name} links to an unavailable screen and does nothing. Choose another screen in its role settings.`
                    );
                    navigateTo = undefined;
                }
                if (role.role !== 'none') {
                    group.control = {
                        role: role.role,
                        label: String(
                            role.props.label ?? role.props.content ?? role.props.alt ?? ''
                        ),
                        value: typeof role.props.value === 'string' ? role.props.value : undefined,
                        placeholder:
                            typeof role.props.placeholder === 'string'
                                ? role.props.placeholder
                                : undefined,
                        disabled: role.props.disabled === true,
                        navigateTo,
                        ...(role.role === 'input'
                            ? {
                                  stateKey: JSON.stringify([
                                      screenId,
                                      shape.interaction?.controlId && settings.props.value
                                          ? ['shared', shape.interaction.controlId]
                                          : ['node', key],
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
                if (role.role === 'input' && shape.interaction?.controlId) {
                    const identity = JSON.stringify([screenId, shape.interaction.controlId]);
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

    const drawing: PreviewDrawing = {
        documentId: document.id,
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
                        session: frame.id === session?.screenId ? session.modes : undefined
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
    for (const nodes of identities.values()) {
        if (nodes.length < 2) {
            continue;
        }
        warnings.push(
            'Duplicate input identity in a screen layout. Give each input a unique identity; these inputs reset when layouts change.'
        );
        for (const node of nodes) {
            delete node.control!.stateKey;
        }
    }

    return drawing;
}
