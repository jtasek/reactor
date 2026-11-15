import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Provider } from 'overmind-react';
import { registerEditor } from 'src/pages/registerEditor';
import { ScreenViews } from 'src/ui/components/Frames/ScreenViews';
import { Shapes } from 'src/ui/components/Surface/Shapes';
import { serializePersistedState } from 'src/app/services/documentStorage';
import { previewModes } from 'src/app/modeEdits';
import { projectPreview } from 'src/preview/project';
import { projectSvg, serializeSvg } from 'src/export/svg';
import type { PreviewDrawing, PreviewNode } from 'src/preview/protocol';
import type { Document } from 'src/app/types';
import { createTestStore } from './store';

/**
 * One drawn primitive, as a person sees it: where its outline lies in the screen's own
 * coordinates and how it is painted, whatever transforms and styles produced it.
 */
export interface Mark {
    tag: string;
    /** Corners, centres, ends or points after every transform, relative to the screen. */
    points: string[];
    /** Radii and corner rounding, scaled by the transforms. */
    size?: string;
    /** Rotation of text and ellipses, in degrees. */
    angle?: number;
    fill: string;
    stroke?: string;
    strokeWidth?: number;
    opacity: number;
    fontSize?: number;
    fontWeight?: string;
    text?: string;
}

/** The stroke a shape gets when it has none of its own. */
const DEFAULT_STROKE = 'var(--shape-stroke-color)';
/** A stroke color no fixture uses, so export's default stroke can be told apart. */
const EXPORT_STROKE = '#010203';
const DEFAULT_TEXT_SIZE = 24;

type Matrix = [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

function multiply([a, b, c, d, e, f]: Matrix, [g, h, i, j, k, l]: Matrix): Matrix {
    return [
        a * g + c * h,
        b * g + d * h,
        a * i + c * j,
        b * i + d * j,
        a * k + c * l + e,
        b * k + d * l + f
    ];
}

function parseTransform(value: string | undefined): Matrix {
    let matrix = IDENTITY;
    for (const [, name, args] of (value ?? '').matchAll(/(\w+)\(([^)]*)\)/g)) {
        const numbers = args
            .split(/[\s,]+/)
            .filter(Boolean)
            .map(Number);
        if (name === 'translate') {
            matrix = multiply(matrix, [1, 0, 0, 1, numbers[0], numbers[1] ?? 0]);
        } else if (name === 'rotate') {
            const [angle, cx = 0, cy = 0] = numbers;
            const radians = (angle * Math.PI) / 180;
            const cos = Math.cos(radians);
            const sin = Math.sin(radians);
            matrix = multiply(
                multiply(multiply(matrix, [1, 0, 0, 1, cx, cy]), [cos, sin, -sin, cos, 0, 0]),
                [1, 0, 0, 1, -cx, -cy]
            );
        } else {
            throw new Error(`Unsupported transform ${name}`);
        }
    }

    return matrix;
}

const round = (value: number) => {
    const rounded = Math.round(value * 100) / 100;

    return Object.is(rounded, -0) ? 0 : rounded;
};

const point = ([a, b, c, d, e, f]: Matrix, x: number, y: number) =>
    `${round(a * x + c * y + e)},${round(b * x + d * y + f)}`;

const angleOf = ([a, b]: Matrix) => round((Math.atan2(b, a) * 180) / Math.PI);
const scaleOf = ([a, b]: Matrix) => Math.hypot(a, b);

/** An element of SVG markup or of the Preview drawing. */
interface Element {
    tag: string;
    attrs: Record<string, string>;
    text?: string;
    children: Element[];
}

interface Paint {
    matrix: Matrix;
    opacity: number;
    fill?: string;
    stroke?: string;
}

const ART = new Set(['rect', 'circle', 'ellipse', 'line', 'polyline', 'text', 'image']);

function mark(element: Element, paint: Paint, fill: string, stroke?: string, strokeWidth?: number) {
    const { attrs } = element;
    const { matrix } = paint;
    const number = (key: string) => Number(attrs[key] ?? 0);
    const result: Mark = { tag: element.tag, points: [], fill, opacity: round(paint.opacity) };
    if (stroke !== undefined) {
        result.stroke = stroke;
        result.strokeWidth = strokeWidth;
    }
    switch (element.tag) {
        case 'rect':
        case 'image': {
            const [x, y, width, height] = ['x', 'y', 'width', 'height'].map(number);
            result.points = [
                point(matrix, x, y),
                point(matrix, x + width, y),
                point(matrix, x + width, y + height),
                point(matrix, x, y + height)
            ];
            if (element.tag === 'rect' && number('rx')) {
                result.size = `${round(number('rx') * scaleOf(matrix))}`;
            }
            break;
        }
        case 'circle':
            result.points = [point(matrix, number('cx'), number('cy'))];
            result.size = `${round(number('r') * scaleOf(matrix))}`;
            break;
        case 'ellipse':
            result.points = [point(matrix, number('cx'), number('cy'))];
            result.size = `${round(number('rx') * scaleOf(matrix))},${round(number('ry') * scaleOf(matrix))}`;
            result.angle = angleOf(matrix);
            break;
        case 'line':
            result.points = [
                point(matrix, number('x1'), number('y1')),
                point(matrix, number('x2'), number('y2'))
            ];
            break;
        case 'polyline': {
            const numbers = (attrs.points ?? '')
                .split(/[\s,]+/)
                .filter(Boolean)
                .map(Number);
            for (let index = 0; index < numbers.length; index += 2) {
                result.points.push(point(matrix, numbers[index], numbers[index + 1]));
            }
            break;
        }
        case 'text':
            result.points = [point(matrix, number('x'), number('y'))];
            result.angle = angleOf(matrix);
            result.text = element.text ?? '';
            break;
    }

    return result;
}

/** Text drawn as one element per line, as Preview and export do. */
function lines(element: Element): Element[] {
    const spans = element.children.filter((child) => child.tag === 'tspan');
    if (!spans.length) {
        return [element];
    }

    return spans.map((span) => ({
        tag: 'text',
        attrs: { ...element.attrs, x: span.attrs.x, y: span.attrs.y },
        text: span.text,
        children: []
    }));
}

const decode = (text: string) =>
    text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, entity: string) => {
        const named: Record<string, string> = {
            amp: '&',
            lt: '<',
            gt: '>',
            quot: '"',
            apos: "'"
        };
        if (entity[0] !== '#') {
            return named[entity.toLowerCase()];
        }

        return String.fromCodePoint(
            entity[1] === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1))
        );
    });

/** Reads the well-formed SVG that React and the export serializer write. */
export function parseMarkup(markup: string): Element[] {
    const root: Element = { tag: '#root', attrs: {}, children: [] };
    const stack = [root];
    const tokens =
        /<\?[^>]*\?>|<\/([\w:-]+)>|<([\w:-]+)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>|([^<]+)/g;
    for (const [token, closing, opening, attributes, selfClosing, text] of markup.matchAll(
        tokens
    )) {
        const parent = stack.at(-1)!;
        if (token.startsWith('<?')) {
            continue;
        }
        if (closing) {
            if (stack.pop()?.tag !== closing) {
                throw new Error(`Unbalanced </${closing}>`);
            }
        } else if (opening) {
            const element: Element = {
                tag: opening,
                attrs: Object.fromEntries(
                    [...attributes.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [
                        key,
                        decode(value)
                    ])
                ),
                children: []
            };
            parent.children.push(element);
            if (!selfClosing) {
                stack.push(element);
            }
        } else if (text !== undefined && text.trim()) {
            parent.text = (parent.text ?? '') + decode(text);
        }
    }

    return root.children;
}

const styles = (element: Element) =>
    Object.fromEntries(
        (element.attrs.style ?? '')
            .split(';')
            .filter(Boolean)
            .map((declaration) => {
                const index = declaration.indexOf(':');

                return [declaration.slice(0, index).trim(), declaration.slice(index + 1).trim()];
            })
    );

/**
 * The canvas's primitives take their paint from the `.shape` rule in `src/tools/styles.css`
 * (`--shape-fill`, `--shape-stroke`, a stroke of 2) and text from its own inline style.
 */
function canvasMarks(element: Element, paint: Paint, marks: Mark[]) {
    if (element.attrs['data-view-instance-hit'] !== undefined) {
        return;
    }
    const style = styles(element);
    const next: Paint = {
        matrix: multiply(paint.matrix, parseTransform(element.attrs.transform)),
        opacity: paint.opacity * Number(element.attrs.opacity ?? 1),
        fill: style['--shape-fill'] ?? paint.fill,
        stroke: style['--shape-stroke'] ?? paint.stroke
    };
    if (element.tag === 'text') {
        for (const line of lines(element)) {
            const drawn = mark(line, next, style.fill ?? 'default');
            drawn.fontSize = Number.parseFloat(style['font-size'] ?? `${DEFAULT_TEXT_SIZE}`);
            if (style['font-weight']) {
                drawn.fontWeight = style['font-weight'];
            }
            marks.push(drawn);
        }

        return;
    }
    if (element.tag === 'image') {
        marks.push(mark(element, next, 'none'));

        return;
    }
    if (ART.has(element.tag)) {
        marks.push(mark(element, next, next.fill ?? 'none', next.stroke ?? DEFAULT_STROKE, 2));

        return;
    }
    element.children.forEach((child) => canvasMarks(child, next, marks));
}

/** Preview and export draw from the same attributes; export has replaced the stroke token. */
function drawingMarks(element: Element, paint: Paint, marks: Mark[]) {
    const { attrs } = element;
    const next: Paint = {
        matrix: multiply(paint.matrix, parseTransform(attrs.transform)),
        opacity: paint.opacity * Number(attrs.opacity ?? 1)
    };
    if (element.tag === 'text') {
        const drawn = mark(element, next, attrs.fill ?? 'default');
        drawn.fontSize = Number(attrs['font-size'] ?? DEFAULT_TEXT_SIZE);
        if (attrs['font-weight'] !== undefined) {
            drawn.fontWeight = attrs['font-weight'];
        }
        marks.push(drawn);

        return;
    }
    if (element.tag === 'image') {
        marks.push(mark(element, next, 'none'));

        return;
    }
    if (ART.has(element.tag)) {
        const stroke = attrs.stroke === EXPORT_STROKE ? DEFAULT_STROKE : attrs.stroke;
        marks.push(
            mark(element, next, attrs.fill ?? 'none', stroke, Number(attrs['stroke-width']))
        );

        return;
    }
    element.children.forEach((child) => drawingMarks(child, next, marks));
}

const origin = (x: number, y: number): Paint => ({
    matrix: [1, 0, 0, 1, -x, -y],
    opacity: 1
});

/** Marks drawn for each shape, keyed by shape id, in drawing order. */
export type ShapeMarks = Map<string, Mark[]>;

/** Each View's artwork as the editor draws it on the canvas, keyed by View id. */
export function canvasProjection(store: ParityStore) {
    const markup = renderToStaticMarkup(
        createElement(Provider, { value: store }, createElement(ScreenViews))
    );
    const [container] = parseMarkup(markup);
    const result = new Map<string, ShapeMarks>();
    for (const placement of container.children) {
        const shapes = placement.children.filter(
            (child) => child.attrs['data-shape-id'] !== undefined
        );
        const viewId = shapes[0]?.attrs['data-screen-view'];
        if (!viewId) {
            continue;
        }
        // Content is local to the View; its placement moves it to the View's position.
        const { position } = store.state.currentDocument.frames[viewId];
        const placed = {
            ...origin(position.x, position.y),
            matrix: multiply(
                origin(position.x, position.y).matrix,
                parseTransform(placement.attrs.transform)
            )
        };
        result.set(
            viewId,
            new Map(
                shapes.map((shape) => {
                    const marks: Mark[] = [];
                    canvasMarks(shape, placed, marks);

                    return [shape.attrs['data-shape-id'], marks];
                })
            )
        );
    }

    return result;
}

/**
 * Shapes outside any Screen as the canvas draws them, in the coordinates `origin` starts.
 * Hidden measuring copies of Screen artwork are left out.
 */
export function canvasShapes(store: ParityStore, x: number, y: number) {
    const markup = renderToStaticMarkup(
        createElement(Provider, { value: store }, createElement(Shapes))
    );
    const [container] = parseMarkup(markup);
    const marks: Mark[] = [];
    for (const shape of container.children) {
        if (shape.attrs.visibility === 'hidden') {
            continue;
        }
        const art = shape.children.find((child) => child.attrs['data-guide-outline'] !== undefined);
        canvasMarks({ ...shape, children: art ? [art] : [] }, origin(x, y), marks);
    }

    return marks;
}

/** What a person has done in Prototype so far; nothing means the screen as it opens. */
export interface Player {
    variants?: Record<string, string>;
    visibility?: Record<string, boolean>;
    record?: { entityId: string; id: string };
}

/** The node the player shows, as `nodeElement` in `src/preview/runtime.ts` chooses it. */
export function playedNode(
    authored: PreviewNode,
    booleans: Record<string, boolean>,
    player: Player
): Element | null {
    const record =
        authored.recordEntity === player.record?.entityId ? player.record?.id : undefined;
    if (record && Object.hasOwn(authored.records ?? {}, record)) {
        return playedNode(authored.records![record], booleans, player);
    }
    const choice = authored.variantKey ? player.variants?.[authored.variantKey] : undefined;
    const node = choice && authored.variants?.[choice] ? authored.variants[choice] : authored;
    if (authored.visibility) {
        const key = authored.visibility.stateKey ?? authored.visibility.key;
        const value = player.visibility?.[key] ?? booleans[key] ?? authored.visibility.initial;
        if (value !== (authored.visibility.stateKey ? (authored.visibility.when ?? true) : true)) {
            return null;
        }
    }

    return {
        tag: node.tag,
        attrs: Object.fromEntries(
            Object.entries(node.attrs).map(([key, value]) => [key, String(value)])
        ),
        text: node.text,
        children: (node.children ?? []).flatMap(
            (child) => playedNode(child, booleans, player) ?? []
        )
    };
}

/** Marks of one Preview node, drawn in its screen's coordinates. */
export function nodeMarks(
    node: PreviewNode,
    screen: { x: number; y: number },
    booleans: Record<string, boolean> = {},
    player: Player = {}
) {
    const marks: Mark[] = [];
    const element = playedNode(node, booleans, player);
    if (element) {
        drawingMarks(element, origin(screen.x, screen.y), marks);
    }

    return marks;
}

/** Prototype launched from a View: the drawing, its screen and each shape's marks. */
export function previewProjection(store: ParityStore, viewId: string, player: Player = {}) {
    store.actions.editFrame({ kind: 'select', id: viewId });
    const session = previewModes(store.state);
    const drawing: PreviewDrawing = projectPreview(store.state.currentDocument, {}, [], session);
    const screen = drawing.screens.find((item) => item.id === session.screenId)!;
    const shapes: ShapeMarks = new Map(
        screen.nodes.map((node) => [
            node.key.slice(screen.id.length + 1),
            nodeMarks(node, screen, drawing.booleans, player)
        ])
    );

    return { shapes, drawing, screen };
}

/** The SVG file Export writes for the selected View or shapes. */
export function exportProjection(store: ParityStore) {
    const drawing = projectSvg(store.state);
    const images = Object.fromEntries(
        drawing.screens
            .flatMap((screen) => screen.nodes)
            .flatMap(function imagesOf(node): string[] {
                return [
                    ...(node.image ? [node.image] : []),
                    ...(node.children ?? []).flatMap(imagesOf)
                ];
            })
            .map((hash) => [hash, `data:image/png;base64,${hash}`])
    );
    const svg = serializeSvg({ ...drawing, images }, EXPORT_STROKE);
    const [root] = parseMarkup(svg);
    const [x, y] = root.attrs.viewBox.split(' ').map(Number);
    const marks: Mark[] = [];
    root.children
        .filter((child) => child.tag !== 'title')
        .forEach((child) => drawingMarks(child, origin(x, y), marks));

    return { marks, x, y };
}

export type ParityStore = Awaited<ReturnType<typeof openDocument>>;

export async function openDocument(document: Document) {
    registerEditor();
    const saved = serializePersistedState({
        currentDocumentId: document.id,
        documents: { [document.id]: document }
    });
    const { store } = createTestStore({ reactor: JSON.stringify(saved) });
    await store.onInitialize();

    return store;
}
