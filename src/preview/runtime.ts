import { readPreview, type PreviewApplication, type PreviewNode } from './protocol';
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
const values = new Map<string, string>();
let application: PreviewApplication | undefined;
let currentScreen: string | undefined;
let port: MessagePort | undefined;

function nodeElement(node: PreviewNode, decorative = false): SVGElement {
    const element = document.createElementNS(SVG, node.tag);
    Object.entries(node.attrs).forEach(([key, value]) => element.setAttribute(key, String(value)));
    if (node.text !== undefined) {
        element.textContent = node.text;
    }
    const control = decorative ? undefined : node.control;
    const isControl = control?.role === 'input' || control?.role === 'button';
    node.children?.forEach((child) => element.append(nodeElement(child, decorative || isControl)));
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
    field.dataset.key = node.key;
    field.className = control.role;
    field.setAttribute('aria-label', control.label);
    field.disabled = control.disabled ?? false;
    if (control.disabled) {
        element.setAttribute('opacity', String(Number(node.attrs.opacity ?? 1) * 0.5));
    }
    field.type = control.role === 'input' ? 'text' : 'button';
    if (field instanceof HTMLInputElement) {
        field.value = values.get(node.key) ?? control.value ?? '';
        field.placeholder = control.placeholder ?? control.label;
        field.addEventListener('input', () => values.set(node.key, field.value));
    } else {
        field.textContent = control.label;
        field.title = control.label;
        field.addEventListener('click', () => {
            if (control.navigateTo) {
                currentScreen = control.navigateTo;
                render();
            }
        });
    }
    box.append(field);
    element.append(box);

    return element;
}

function render() {
    if (!application) {
        return;
    }
    const screen =
        application.screens.find((screen) => screen.id === currentScreen) ?? application.screens[0];
    currentScreen = screen.id;
    const focused =
        document.activeElement instanceof HTMLInputElement ? document.activeElement : undefined;
    const selection = focused
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
    reset.textContent = 'Reset preview';
    reset.addEventListener('click', () => {
        values.clear();
        currentScreen = undefined;
        render();
    });
    navigation.append(label, reset);
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', `${screen.x} ${screen.y} ${screen.width} ${screen.height}`);
    svg.setAttribute('width', String(screen.width));
    svg.setAttribute('height', String(screen.height));
    svg.setAttribute('aria-label', screen.name);
    screen.nodes.forEach((node) => svg.append(nodeElement(node)));
    root.replaceChildren(navigation, svg);
    if (key) {
        const input = Array.from(root.querySelectorAll('input')).find(
            (input) => input.dataset.key === key
        );
        input?.focus();
        if (input && selection) {
            input.setSelectionRange(selection[0], selection[1]);
        }
    }
}

function receive(value: unknown) {
    try {
        const next = readPreview(value);
        if (application?.documentId !== next.documentId) {
            values.clear();
            currentScreen = undefined;
        }
        const keys = new Set<string>();
        const collect = (node: PreviewNode) => {
            if (node.control?.role === 'input') {
                keys.add(node.key);
            }
            node.children?.forEach(collect);
        };
        next.screens.forEach((screen) => screen.nodes.forEach(collect));
        values.forEach((_value, key) => {
            if (!keys.has(key)) {
                values.delete(key);
            }
        });
        application = next;
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
    port.postMessage({ type: 'ready' });
});
window.addEventListener('pagehide', () => port?.close());
