import type { Document, Shape, VariableContext } from '../app/types';
import { layoutDocument, frameLayout } from '../app/frameLayout';
import { frameParents, isFrameVisible } from '../app/frameState';
import { shownShapesIds } from '../app/membership';
import { componentSource, instanceBox } from '../app/componentSource';
import { applyInstanceOverrides } from '../app/componentProps';
import { effectiveRoleSettings, resolveComponentRole } from '../app/componentRoles';
import { themeColors } from '../app/themeColors';
import { assertNever, boxCenter, getShapeBounds, DEFAULT_TEXT_FONT_SIZE } from '../app/utils';
import { readPreview, type PreviewApplication, type PreviewNode } from './protocol';

/** A read-only projection. Source component records and bindings never cross the sandbox boundary. */
export function projectPreview(
    sourceDocument: Document,
    context: VariableContext
): PreviewApplication {
    const problems = Object.values(frameLayout(sourceDocument).problems);
    if (problems.length) {
        throw new Error(problems.join(' '));
    }
    const document = layoutDocument(sourceDocument);
    const parents = frameParents(document.frames);
    const roots = Object.values(document.frames).filter(
        (frame) => !parents.get(frame.id) && isFrameVisible(document, frame.id)
    );
    const shown = shownShapesIds({ ...document, shownLayerId: undefined }, null);
    const rootOf = (parent: string | undefined): string | undefined => {
        if (!parent) {
            return undefined;
        }
        const next = parents.get(parent);

        return next ? rootOf(next) : parent;
    };
    let count = 0;
    const draw = (shape: Shape, path: string, ancestors: ReadonlySet<string>): PreviewNode => {
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
            stroke: shape.stroke ?? 'currentColor',
            'stroke-width': 1
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
            case 'text':
                primitive(
                    'text',
                    {
                        x: shape.position.x,
                        y: shape.position.y,
                        'font-size': shape.fontSize ?? DEFAULT_TEXT_FONT_SIZE,
                        fill: shape.fontColor ?? 'currentColor'
                    },
                    shape.value
                );
                break;
            case 'image':
                throw new Error(
                    `${shape.name}: image resources are not supported in this preview increment.`
                );
            case 'instance': {
                const source = componentSource(document, shape.componentId, ancestors);
                const component = document.components[shape.componentId];
                if (!source || !component) {
                    throw new Error(`${shape.name}: missing or cyclic component source.`);
                }
                const box = instanceBox(shape, source);
                const pivot = boxCenter(box);
                attrs.transform = `${shape.rotation ? `rotate(${shape.rotation} ${pivot.x} ${pivot.y}) ` : ''}translate(${shape.position.x - source.box.topLeft.x} ${shape.position.y - source.box.topLeft.y})`;
                const next = new Set(ancestors).add(shape.componentId);
                group.children = source.shapes.flatMap((member) => {
                    const resolved = applyInstanceOverrides(
                        themeColors(member, document, context),
                        shape,
                        component,
                        document,
                        context
                    );

                    return resolved.visible ? [draw(resolved, key, next)] : [];
                });
                const role = resolveComponentRole(document, component, shape);
                if (role.problems.length) {
                    throw new Error(`${shape.name}: ${role.problems.join(' ')}`);
                }
                const settings = effectiveRoleSettings(component, shape);
                if (settings.navigateTo && role.role !== 'button') {
                    throw new Error(
                        `${shape.name}: only buttons can navigate. Update its role settings.`
                    );
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
                        navigateTo: settings.navigateTo,
                        x: source.box.topLeft.x,
                        y: source.box.topLeft.y,
                        width: source.box.width,
                        height: source.box.height
                    };
                }
                break;
            }
            default:
                assertNever(shape);
        }

        return group;
    };

    return readPreview({
        documentId: document.id,
        screens: roots.map((frame) => ({
            id: frame.id,
            name: frame.name,
            x: frame.position.x,
            y: frame.position.y,
            ...frame.size,
            nodes: document.shapesIds
                .filter(
                    (id) => shown.has(id) && rootOf(document.shapes[id].parentFrameId) === frame.id
                )
                .map((id) =>
                    draw(themeColors(document.shapes[id], document, context), frame.id, new Set())
                )
        }))
    });
}
