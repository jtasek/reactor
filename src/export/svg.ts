import type { Context } from 'src/app';
import type { Shape } from 'src/app/types';
import { renderedShape } from 'src/app/frameLayout';
import { canvasLayout } from 'src/app/contextualLayout';
import { projectScreen } from 'src/app/screenProjection';
import { editableScreenView } from 'src/app/screenViewEditing';
import { screenViewName } from 'src/app/screenViews';
import { artworkModes } from 'src/app/modeHooks';
import { themeColors } from 'src/app/themeColors';
import { drawnBox } from 'src/app/membership';
import { instanceBox, instanceSource } from 'src/app/componentSource';
import { createArtworkProjector } from 'src/preview/project';
import {
    readPreview,
    type PreviewDrawing,
    type PreviewApplication,
    type PreviewNode
} from 'src/preview/protocol';

/** Export the same placed artwork as Canvas, independently of camera zoom and editor overlays. */
export function projectSvg(state: Context['state']): PreviewDrawing {
    const document = state.currentDocument;
    const frame = document.frames[document.selectedFrameId ?? ''];
    const wholeView = frame?.kind === 'view' ? frame : undefined;
    const address = state.events.pointer.screenView;
    const addressed =
        address?.documentId === document.id ? document.frames[address.viewId] : undefined;
    const placed = wholeView
        ? projectScreen(
              document,
              wholeView.screenId ?? '',
              wholeView,
              state.previewModes[document.id]
          )
        : (editableScreenView(state, address)?.projection ??
          (addressed?.kind === 'view'
              ? projectScreen(
                    document,
                    addressed.screenId ?? '',
                    addressed,
                    state.previewModes[document.id]
                )
              : undefined));
    if (wholeView && !placed) {
        throw new Error('The selected Screen view is unavailable.');
    }
    if (placed?.problems.length) {
        throw new Error(placed.problems.join(' '));
    }
    const viewId = wholeView?.id ?? (placed ? state.events.pointer.screenView?.viewId : undefined);
    const layout = canvasLayout(document, state.previewModes[document.id]);
    const placedShapes = new Map(placed?.shapes.map((shape) => [shape.id, shape]));
    const selected = new Set(document.selectedShapesIds);
    const shapes =
        wholeView && placed
            ? placed.shapes
            : document.shapesIds
                  .filter((id) => selected.has(id))
                  .map((id) => placedShapes.get(id) ?? renderedShape(document, id, layout));
    if (!wholeView && !shapes.length) {
        throw new Error('Select a Screen view or visible shapes to export.');
    }
    const problems = Object.entries(layout?.problems ?? {}).filter(([id]) => selected.has(id));
    if (problems.length) {
        throw new Error(problems.map(([, message]) => message).join(' '));
    }
    const warnings: string[] = [];
    const { draw } = createArtworkProjector(document, warnings);
    const nodes = shapes.map((shape) => {
        const resolved = artworkModes(
            state,
            shape,
            placedShapes.has(shape.id) ? viewId : undefined
        );
        if (resolved.problems.length) {
            throw new Error(resolved.problems.join(' '));
        }

        return draw(
            themeColors(shape, document, resolved.modes),
            'export',
            new Set(),
            resolved.modes,
            'export'
        );
    });
    if (warnings.length) {
        throw new Error(warnings.join(' '));
    }
    const bounds = wholeView
        ? { x: wholeView.position.x, y: wholeView.position.y, ...wholeView.size }
        : selectionBounds(shapes, document);

    return {
        documentId: document.id,
        screens: [
            {
                id: 'export',
                name: wholeView
                    ? screenViewName(document, wholeView)
                    : `${document.name} selection`,
                ...bounds,
                nodes
            }
        ]
    };
}

function selectionBounds(shapes: Shape[], document: Context['state']['currentDocument']) {
    const boxes = shapes.map((shape) => {
        const source = shape.type === 'instance' ? instanceSource(document, shape) : null;

        return drawnBox(
            shape.type === 'instance' && source
                ? { ...shape, bounds: instanceBox(shape, source) }
                : shape
        );
    });
    // Include the default two-unit stroke and its miter joins; zero-width lines remain exportable.
    const x = Math.min(...boxes.map((box) => box.topLeft.x)) - 4;
    const y = Math.min(...boxes.map((box) => box.topLeft.y)) - 4;
    const right = Math.max(...boxes.map((box) => box.bottomRight.x)) + 4;
    const bottom = Math.max(...boxes.map((box) => box.bottomRight.y)) + 4;

    return { x, y, width: right - x, height: bottom - y };
}

function escape(value: string | number) {
    const text = String(value);
    for (const char of text) {
        const code = char.codePointAt(0)!;
        if (
            (code < 32 && ![9, 10, 13].includes(code)) ||
            (code >= 0xd800 && code <= 0xdfff) ||
            code === 0xfffe ||
            code === 0xffff
        ) {
            throw new Error('The artwork contains a character that SVG cannot represent.');
        }
    }

    return text.replace(
        /[&<>"']/g,
        (char) =>
            ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&apos;'
            })[char]!
    );
}

/** Only allowlisted SVG artwork and verified embedded images are serialized, never controls. */
export function serializeSvg(input: PreviewApplication, strokeColor = '#474a51') {
    const application = readPreview(input);
    const screen = application.screens[0];
    const paint = /^#[0-9a-f]{6}$/i.test(strokeColor) ? strokeColor : '#474a51';
    // Repeated images expand into data URLs in SVG; bound the actual output as well as the DTO.
    const output = { bytes: 0 };
    const bounded = (value: string) => {
        output.bytes += new TextEncoder().encode(value).byteLength;
        if (output.bytes > 32 * 1024 * 1024) {
            throw new Error('SVG exceeds 32 MiB. Export fewer objects or smaller images.');
        }

        return value;
    };
    const element = (node: PreviewNode): string => {
        const attributes = Object.entries(node.attrs).map(
            ([key, value]) =>
                `${key}="${escape(value === 'var(--shape-stroke-color)' ? paint : value)}"`
        );
        if (node.image) {
            attributes.push(`href="${escape(application.images[node.image])}"`);
        }

        return (
            bounded(
                `<${node.tag}${attributes.length ? ` ${attributes.join(' ')}` : ''}>${node.text === undefined ? '' : escape(node.text)}`
            ) +
            (node.children ?? []).map(element).join('') +
            bounded(`</${node.tag}>`)
        );
    };

    return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${screen.width}" height="${screen.height}" viewBox="${screen.x} ${screen.y} ${screen.width} ${screen.height}" overflow="hidden" color="#000000" font-family="Roboto, sans-serif"><title>${escape(screen.name)}</title>${screen.nodes.map(element).join('')}</svg>\n`;
}
