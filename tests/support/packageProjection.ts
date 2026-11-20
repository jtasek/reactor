import { readFileSync } from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { vi } from 'vitest';
import { prototypeModes, prototypeSession } from 'src/app/modeEdits';
import { packageContents, writeStandalonePackage } from 'src/preview/standalonePackage';
import type { CheckContext } from 'src/app/accessibilityCheck';
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
export async function packagePage(
    store: ParityStore,
    viewId: string,
    contexts: readonly CheckContext[] = []
) {
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
        const { application, extras } = await packageContents(
            state.currentDocument,
            session,
            {},
            contexts,
            state.config.accessibility,
            { read: async () => asset },
            new AbortController().signal
        );

        return writeStandalonePackage(
            TEMPLATE,
            state.currentDocument.name,
            application,
            contexts.length ? extras : undefined
        );
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
    let application: PreviewApplication = data.application;
    const root = window.document.getElementById('preview')!;
    const select = <T extends HTMLElement>(selector: string) =>
        root.querySelector(selector) as T | null;

    /** Views the page in the modes and size of this name, with its own picker. */
    function view(name: string) {
        const picker = select<HTMLSelectElement>('select[aria-label="Modes and size"]')!;
        const option = [...picker.options].find((item) => item.textContent === name)!;
        picker.value = option.value;
        picker.dispatchEvent(new window.Event('change'));
        application =
            name === 'As tested'
                ? data.application
                : data.views.find((item: { name: string }) => item.name === name).application;
    }

    /** What the page's Accessibility report lists, by heading. */
    function report(): Record<string, string[]> {
        const toggle = select<HTMLButtonElement>('button[aria-controls="accessibility-report"]')!;
        if (toggle.getAttribute('aria-expanded') !== 'true') {
            toggle.click();
        }
        const section = select<HTMLElement>('#accessibility-report')!;

        return Object.fromEntries(
            [...section.querySelectorAll('ol, ul')].map((list) => [
                list.getAttribute('aria-label')!,
                [...list.children].map((item) => item.textContent!)
            ])
        );
    }

    /** Each shape's marks on this screen as the page draws it, keyed by shape id. */
    function show(screenId: string): ShapeMarks {
        // Each drawing replaces the controls, so the picker is found again each time.
        const picker = select<HTMLSelectElement>('select[aria-label="Preview page"]');
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
        view,
        report,
        views: (data.views ?? []).map(({ name }: { name: string }) => name) as string[],
        title: window.document.title,
        status: root.getAttribute('role') === 'status' ? root.textContent : null,
        show,
        close: () => {
            vi.unstubAllGlobals();
            window.close();
        }
    };
}
