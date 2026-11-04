import {
    readPreview,
    readPreviewImages,
    PREVIEW_PROTOCOL_VERSION,
    type PreviewApplication,
    type PreviewNode
} from './protocol';
import '../../static/styles/site.css';
import './runtime.css';

declare global {
    interface Window {
        REACTOR_EDITOR_ORIGIN?: string;
    }
}
const SVG = 'http://www.w3.org/2000/svg';
const XHTML = 'http://www.w3.org/1999/xhtml';
const root = document.getElementById('preview')!;
// The standalone player owns viewport and reset controls outside the sandbox.
const shared = window.location.pathname.replace(/\/$/, '') === '/share';
const externalControls =
    !shared && new URLSearchParams(window.location.search).get('player') === 'prototype';
const values = new Map<string, string>();
const variants = new Map<string, string>();
const initialVariants = new Map<string, string>();
let application: PreviewApplication | undefined;
/** Images received so far. The editor sends each image once and later updates only refer to it. */
let images: Record<string, string> = {};
let currentScreen: string | undefined;
let port: MessagePort | undefined;

function nodeElement(authored: PreviewNode, decorative = false): SVGElement {
    const choice = authored.variantKey ? variants.get(authored.variantKey) : undefined;
    const node = choice && authored.variants?.[choice] ? authored.variants[choice] : authored;
    const element = document.createElementNS(SVG, node.tag);
    Object.entries(node.attrs).forEach(([key, value]) => element.setAttribute(key, String(value)));
    if (node.image) {
        element.setAttribute('href', application!.images[node.image]);
    }
    if (node.text !== undefined) {
        element.textContent = node.text;
    }
    const control = decorative ? undefined : node.control;
    const isControl = control?.role === 'input' || control?.role === 'button';
    node.children?.forEach((child) => {
        const item = nodeElement(child, decorative || isControl);
        if (control?.role === 'list' && child.tag === 'g') {
            item.setAttribute('role', 'listitem');
        }
        element.append(item);
    });
    if (!control) {
        return element;
    }
    if (control.role === 'image' && control.label === '') {
        element.setAttribute('aria-hidden', 'true');

        return element;
    }
    if (control.role !== 'input' && control.role !== 'button') {
        element.setAttribute(
            'role',
            control.role === 'image' ? 'img' : control.role === 'list' ? 'list' : 'group'
        );
        element.setAttribute('aria-label', control.label);

        return element;
    }
    Array.from(element.children).forEach((child) => {
        child.setAttribute('aria-hidden', 'true');
        if (control.role === 'input') {
            child.setAttribute('visibility', 'hidden');
        }
    });
    const box = document.createElementNS(SVG, 'foreignObject');
    for (const key of ['x', 'y', 'width', 'height'] as const) {
        box.setAttribute(key, String(control[key]));
    }
    const field = document.createElementNS(XHTML, control.role === 'input' ? 'input' : 'button') as
        | HTMLInputElement
        | HTMLButtonElement;
    const inputKey = control.stateKey ?? node.key;
    field.dataset.key = inputKey;
    field.className = control.role;
    field.setAttribute('aria-label', control.label);
    field.disabled = control.disabled ?? false;
    if (control.changeVariant && control.role === 'button') {
        const action = control.changeVariant;
        field.setAttribute(
            'aria-pressed',
            String(
                (variants.get(action.key) ?? initialVariants.get(action.key)) === action.variantId
            )
        );
    }
    if (control.disabled) {
        element.setAttribute('opacity', String(Number(node.attrs.opacity ?? 1) * 0.5));
    }
    field.type = control.role === 'input' ? 'text' : 'button';
    if (field instanceof HTMLInputElement) {
        field.value = values.get(inputKey) ?? control.value ?? '';
        field.placeholder = control.placeholder ?? control.label;
        field.addEventListener('input', () => values.set(inputKey, field.value));
        field.addEventListener('keydown', (event) => {
            if (
                event.key !== 'Enter' ||
                event.isComposing ||
                (!control.navigateTo && !control.changeVariant)
            ) {
                return;
            }
            event.preventDefault();
            activate(control);
        });
    } else {
        field.textContent = control.label;
        field.title = control.label;
        field.addEventListener('click', () => {
            activate(control);
        });
    }
    box.append(field);
    element.append(box);

    return element;
}

function activate(control: NonNullable<PreviewNode['control']>) {
    if (!control.changeVariant && !control.navigateTo) {
        return;
    }
    if (control.changeVariant) {
        variants.set(control.changeVariant.key, control.changeVariant.variantId);
    }
    if (control.navigateTo) {
        currentScreen = control.navigateTo;
    }
    render();
}

function render() {
    if (!application) {
        return;
    }
    const screen =
        application.screens.find((screen) => screen.id === currentScreen) ?? application.screens[0];
    currentScreen = screen.id;
    const focused =
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLButtonElement
            ? document.activeElement
            : undefined;
    const selection =
        focused instanceof HTMLInputElement
            ? ([focused.selectionStart, focused.selectionEnd] as const)
            : undefined;
    const key = focused?.dataset.key;
    const navigation = document.createElement('nav');
    navigation.setAttribute('aria-label', 'Preview controls');
    const label = document.createElement('label');
    label.textContent = 'Screen ';
    const select = document.createElement('select');
    select.setAttribute('aria-label', 'Preview screen');
    application.screens.forEach((item) => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = item.name;
        select.append(option);
    });
    select.value = screen.id;
    select.addEventListener('change', () => {
        currentScreen = select.value;
        render();
    });
    label.append(select);
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.textContent = shared ? 'Reset prototype' : 'Reset preview';
    reset.addEventListener('click', () => {
        values.clear();
        variants.clear();
        currentScreen = undefined;
        // Inspected Width and Layout return to the launch view's too.
        port?.postMessage({ type: 'inspect-reset' });
        render();
    });
    navigation.append(label);
    if (screen.layouts && !shared) {
        const widthLabel = document.createElement('label');
        widthLabel.textContent = 'Width ';
        const width = document.createElement('input');
        width.type = 'number';
        width.min = '1';
        width.max = '10000';
        width.value = String(screen.width);
        width.setAttribute('aria-label', 'Preview width');
        width.addEventListener('change', () => {
            if (width.checkValidity() && Number.isFinite(width.valueAsNumber)) {
                port?.postMessage({ type: 'inspect-width', width: width.valueAsNumber });
            }
        });
        widthLabel.append(width);
        const layoutLabel = document.createElement('label');
        layoutLabel.textContent = 'Layout ';
        const layouts = document.createElement('select');
        layouts.setAttribute('aria-label', 'Preview layout');
        const choices = [{ id: null, name: 'Auto · Width' }, ...screen.layouts];
        if (screen.layoutChoice && !screen.layouts.some(({ id }) => id === screen.layoutChoice)) {
            choices.push({ id: screen.layoutChoice, name: 'Missing layout — showing default' });
        }
        for (const choice of choices) {
            const option = document.createElement('option');
            option.value = JSON.stringify(choice.id);
            option.textContent = choice.name;
            layouts.append(option);
        }
        layouts.value = JSON.stringify(screen.layoutChoice ?? null);
        layouts.addEventListener('change', () =>
            port?.postMessage({
                type: 'inspect-layout',
                screenId: screen.id,
                layoutId: JSON.parse(layouts.value)
            })
        );
        layoutLabel.append(layouts);
        if (!externalControls) {
            navigation.append(widthLabel);
        }
        navigation.append(layoutLabel);
    }
    if (!externalControls) {
        navigation.append(reset);
    }
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', `${screen.x} ${screen.y} ${screen.width} ${screen.height}`);
    svg.setAttribute('width', String(screen.width));
    svg.setAttribute('height', String(screen.height));
    svg.setAttribute('aria-label', screen.name);
    screen.nodes.forEach((node) => svg.append(nodeElement(node)));
    root.replaceChildren(navigation, svg);
    if (key) {
        const input = Array.from(
            root.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input, button')
        ).find((input) => input.dataset.key === key);
        input?.focus();
        if (input instanceof HTMLInputElement && selection) {
            input.setSelectionRange(selection[0], selection[1]);
        }
    }
}

function receive(value: unknown) {
    try {
        const update = value && typeof value === 'object' ? (value as { images?: unknown }) : {};
        // Keep new images even if this drawing is refused: the editor counts them as sent.
        images = { ...images, ...readPreviewImages(update.images) };
        const next = readPreview({ ...update, images: undefined }, images);
        if (application?.documentId !== next.documentId) {
            values.clear();
            variants.clear();
            currentScreen = undefined;
        }
        const keys = new Set<string>();
        initialVariants.clear();
        const collect = (node: PreviewNode) => {
            if (node.control?.role === 'input') {
                keys.add(node.control.stateKey ?? node.key);
            }
            node.children?.forEach(collect);
            Object.values(node.variants ?? {}).forEach(collect);
            if (node.variantKey && node.initialVariant) {
                initialVariants.set(node.variantKey, node.initialVariant);
            }
            if (
                node.variantKey &&
                !Object.hasOwn(node.variants ?? {}, variants.get(node.variantKey) ?? '')
            ) {
                variants.delete(node.variantKey);
            }
        };
        next.screens.forEach((screen) => screen.nodes.forEach(collect));
        values.forEach((_value, key) => {
            if (!keys.has(key)) {
                values.delete(key);
            }
        });
        variants.forEach((_value, key) => {
            if (!initialVariants.has(key)) {
                variants.delete(key);
            }
        });
        application = next;
        // Only what the accepted drawing uses stays, matching what the editor remembers sending.
        images = next.images;
        render();
        port?.postMessage({ type: 'rendered' });
    } catch (error) {
        port?.postMessage({
            type: 'error',
            message: error instanceof Error ? error.message : 'Invalid preview.'
        });
    }
}

window.addEventListener('message', (event) => {
    if (
        shared ||
        port ||
        event.source !== window.parent ||
        event.origin !== window.REACTOR_EDITOR_ORIGIN ||
        event.data?.type !== 'reactor-preview-connect' ||
        event.ports.length !== 1
    ) {
        return;
    }
    port = event.ports[0];
    port.onmessage = (event) => receive(event.data);
    port.postMessage({ type: 'ready', version: PREVIEW_PROTOCOL_VERSION });
});
window.addEventListener('pagehide', () => port?.close());

/** Public links load one immutable validated snapshot, without cookies or an editor channel. */
async function openSharedPrototype() {
    root.textContent = 'Loading shared prototype…';
    const token = window.location.hash.slice(1);
    const controller = new AbortController();
    window.addEventListener('pagehide', () => controller.abort(), { once: true });
    try {
        if (!/^[A-Za-z0-9_-]{43}$/.test(token) || !window.REACTOR_EDITOR_ORIGIN) {
            throw new Error('This prototype link is invalid.');
        }
        const response = await fetch(`${window.REACTOR_EDITOR_ORIGIN}/api/prototype-links/open`, {
            method: 'POST',
            credentials: 'omit',
            cache: 'no-store',
            referrerPolicy: 'no-referrer',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
            signal: controller.signal
        });
        if (!response.ok) {
            throw new Error(
                response.status === 404
                    ? 'This prototype link has expired or been revoked.'
                    : response.status === 410
                      ? 'This prototype link is out of date. Ask whoever shared it for a new link.'
                      : 'The shared prototype could not be loaded. Try reloading.'
            );
        }
        const data = await response.json();
        if (data.version !== PREVIEW_PROTOCOL_VERSION) {
            throw new Error('This shared prototype uses an unsupported version.');
        }
        const snapshot = readPreview(data.application);
        receive(snapshot);
    } catch (error) {
        if (controller.signal.aborted) {
            return;
        }
        root.textContent =
            error instanceof Error ? error.message : 'The shared prototype could not be loaded.';
        root.setAttribute('role', 'status');
    }
}
if (shared) {
    void openSharedPrototype();
}
