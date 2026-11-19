import { readFileSync } from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { vi } from 'vitest';
import { prototypeModes, prototypeSession } from 'src/app/modeEdits';
import { packageApplication, writeStandalonePackage } from 'src/preview/standalonePackage';
import { PREVIEW_PROTOCOL_VERSION, type PreviewApplication } from 'src/shared/previewProtocol';
import {
    markupMarks,
    type MarkupElement,
    type ParityStore,
    type ShapeMarks
} from './projectionParity';
import { previewImageAsset } from './previewImages';

/** The package page as `webpack.preview.mjs` writes it, without the compiled runtime. */
const TEMPLATE = readFileSync(path.resolve('src/preview/package.html'), 'utf8')
    .replace('<!-- reactor:version -->', String(PREVIEW_PROTOCOL_VERSION))
    .replace(/<!-- reactor:(csp|style|script) -->/g, '');

/**
 * The page Download on the Prototype page saves after Play on this View: the drawing of
 * every screen at the launch size and modes, its images read and verified, written into
 * the package template. Every image reads as the one test raster.
 */
export async function packagePage(store: ParityStore, viewId: string) {
    store.actions.editFrame({ kind: 'select', id: viewId });
    const { state } = store;
    const session = prototypeSession(
        state.currentDocument,
        prototypeModes(state),
        null,
        state.config.viewportPresets[0].size
    );
    const asset = await previewImageAsset();
    vi.stubGlobal('createImageBitmap', async () => ({ close() {} }));
    try {
        const application = await packageApplication(
            state.currentDocument,
            session,
            {},
            { read: async () => asset },
            new AbortController().signal
        );

        return writeStandalonePackage(TEMPLATE, state.currentDocument.name, application);
    } finally {
        vi.unstubAllGlobals();
    }
}

const SVG = 'http://www.w3.org/2000/svg';
/** What the runtime adds for people using assistive technology, which draws nothing. */
const ACCESSIBILITY = new Set(['id', 'role', 'tabindex']);

/** The drawn SVG element as the parity marks read markup; null when the runtime hides it. */
function drawn(element: Element): MarkupElement | null {
    if (element.namespaceURI !== SVG || element.localName === 'foreignObject') {
        return null;
    }
    if (element.getAttribute('display') === 'none') {
        return null;
    }
    const attrs = Object.fromEntries(
        [...element.attributes]
            .filter(({ name }) => !ACCESSIBILITY.has(name))
            // Artwork under an input is hidden behind the native field drawn over it.
            .filter(({ name, value }) => !(name === 'visibility' && value === 'hidden'))
            .map(({ name, value }) => [name, value])
    );
    const text = [...element.childNodes]
        .filter((node) => node.nodeType === node.TEXT_NODE)
        .map((node) => node.textContent)
        .join('');

    return {
        tag: element.localName,
        attrs,
        ...(text.trim() ? { text } : {}),
        children: [...element.children].flatMap((child) => drawn(child) ?? [])
    };
}

/**
 * Opens a downloaded page as a browser would, running `src/preview/runtime.ts` against it,
 * and reads what it draws for each screen, chosen with the page's own screen picker.
 * Close it before opening another.
 */
export async function openPackage(page: string) {
    const dom = new JSDOM(page);
    const { window } = dom;
    vi.stubGlobal('window', window);
    vi.stubGlobal('document', window.document);
    vi.stubGlobal('HTMLInputElement', window.HTMLInputElement);
    vi.stubGlobal('HTMLButtonElement', window.HTMLButtonElement);
    // The runtime reads these globals whenever it draws, so they stay until the page closes.
    vi.resetModules();
    await import('src/preview/runtime');
    const data = JSON.parse(window.document.getElementById('reactor-package')!.textContent!);
    const application: PreviewApplication = data.application;
    const root = window.document.getElementById('preview')!;

    /** Each shape's marks on this screen as the page draws it, keyed by shape id. */
    function show(screenId: string): ShapeMarks {
        // Each drawing replaces the controls, so the picker is found again each time.
        const picker = root.querySelector<HTMLSelectElement>('select[aria-label="Preview page"]');
        if (picker && picker.value !== screenId) {
            picker.value = screenId;
            picker.dispatchEvent(new window.Event('change'));
        }
        const svg = window.document.querySelector<SVGSVGElement>('#preview > svg');
        const screen = application.screens.find((item) => item.id === screenId)!;
        if (svg?.getAttribute('aria-label') !== screen.name) {
            throw new Error(`The page did not open ${screen.name}`);
        }

        return new Map(
            screen.nodes.map((node, index) => {
                const element = drawn(svg.children[index]);

                return [
                    node.key.slice(screen.id.length + 1),
                    element ? markupMarks(element, screen.x, screen.y) : []
                ];
            })
        );
    }

    return {
        application,
        title: window.document.title,
        status: root.getAttribute('role') === 'status' ? root.textContent : null,
        show,
        close: () => {
            vi.unstubAllGlobals();
            window.close();
        }
    };
}
