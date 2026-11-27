import {
    readPreview,
    readPreviewImages,
    PREVIEW_PROTOCOL_VERSION,
    type PreviewApplication,
    type PreviewNode,
    type PreviewStateValue
} from '../shared/previewProtocol';
import { evaluateCondition, formatStateValue, type Condition } from '../shared/conditions';
import { auditScreen, type AuditPick, type AuditReport } from './accessibilityAudit';
import { DEFAULT_ACCESSIBILITY_RULES, type AccessibilityRules } from './accessibilityRules';
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
/** A downloaded package carries its snapshot in the page and never talks to a server. */
const packaged = document.getElementById('reactor-package');
const standalone = shared || packaged !== null;
const externalControls =
    !standalone && new URLSearchParams(window.location.search).get('player') === 'prototype';
const values = new Map<string, string>();
let selectedRecord: { entityId: string; id: string } | undefined;
/** Screen ID → entities its Selected record bindings show. */
const recordScreens = new Map<string, Set<string>>();
const variants = new Map<string, string>();
const initialVariants = new Map<string, string>();
/** Per-instance shown or hidden, for instances that follow no state. */
const visibility = new Map<string, boolean>();
const initialVisibility = new Map<string, boolean>();
/** The condition each visibility key follows, if any. */
const visibilityConditions = new Map<string, Condition>();
/** Named state values of this session, and the values they start with. */
const states = new Map<string, PreviewStateValue>();
const initialStates = new Map<string, PreviewStateValue>();
const stateValue = (key: string) => states.get(key) ?? initialStates.get(key);
/** What was typed into number fields, by input key, so “1.” or “-” isn't rewritten mid-typing. */
const drafts = new Map<string, string>();
/** Whether the instance with this visibility key shows now. */
const isShown = (key: string, initial = initialVisibility.get(key) ?? true) => {
    const condition = visibilityConditions.get(key);

    return condition
        ? evaluateCondition(condition, (operand) =>
              operand.kind === 'state' ? stateValue(operand.stateId) : undefined
          )
        : (visibility.get(key) ?? initial);
};
const visibilityId = (key: string) => `visibility-${encodeURIComponent(key)}`;
/** The visibility the last activation toggled: focus returns to its opener if the control hid. */
let toggled: string | undefined;
let application: PreviewApplication | undefined;
/** Images received so far. The editor sends each image once and later updates only refer to it. */
let images: Record<string, string> = {};
let currentScreen: string | undefined;
/** The editor draws the screen picker and Layout itself. Older editors never say so. */
let hostControls = false;
/** The modes and sizes a package can be viewed in; the first is the session it was tested in. */
let views: { name: string; application: PreviewApplication }[] = [];
let currentView = 0;
let accessibilityRules = DEFAULT_ACCESSIBILITY_RULES;
let reportOpen = false;
let port: MessagePort | undefined;
/** Controls an AI proposal in the editor changes, by shape ID, drawn dashed until it applies. */
let outlined = new Set<string>();

function nodeElement(authored: PreviewNode, decorative = false): SVGElement {
    const recordId =
        authored.recordEntity === selectedRecord?.entityId ? selectedRecord?.id : undefined;
    if (recordId && Object.hasOwn(authored.records ?? {}, recordId)) {
        return nodeElement(authored.records![recordId], decorative);
    }
    const choice = authored.variantKey ? variants.get(authored.variantKey) : undefined;
    const node = choice && authored.variants?.[choice] ? authored.variants[choice] : authored;
    const element = document.createElementNS(SVG, node.tag);
    if (authored.visibility) {
        element.id = visibilityId(authored.visibility.key);
        if (!isShown(authored.visibility.key, authored.visibility.initial)) {
            element.setAttribute('display', 'none');

            return element;
        }
    }
    Object.entries(node.attrs).forEach(([key, value]) => element.setAttribute(key, String(value)));
    if (node.image) {
        element.setAttribute('href', application!.images[node.image]);
    }
    if (node.text !== undefined) {
        element.textContent = node.text;
    }
    const control = decorative ? undefined : node.control;
    const isControl = control?.role === 'input' || control?.role === 'button';
    // A bound text shows its state on its first line; the canvas keeps the authored text.
    const children =
        node.textState !== undefined && node.children?.[0]?.tag === 'text'
            ? [{ ...node.children[0], text: formatStateValue(stateValue(node.textState)) }]
            : node.children;
    children?.forEach((child) => {
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
    if (outlined.has(authored.key.slice(authored.key.lastIndexOf('/') + 1))) {
        field.dataset.proposed = 'true';
    }
    // A label bound to a state reads its value; an empty value keeps the authored label.
    const label =
        (control.labelState !== undefined && formatStateValue(stateValue(control.labelState))) ||
        control.label;
    field.setAttribute('aria-label', label);
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
    const change = control.changeState;
    // A Set or Reset control is a plain button: pressing it again changes nothing, so no
    // aria-pressed. The data attribute lets focus return to it when its action hides another.
    if (change && control.role === 'button') {
        field.dataset.toggleState = change.key;
    }
    // A disclosure whose target follows a state stays a disclosure; plain state toggles are pressed.
    if (
        change?.change === 'toggle' &&
        control.toggleVisibility === undefined &&
        control.role === 'button'
    ) {
        field.setAttribute('aria-pressed', String(stateValue(change.key) === true));
    }
    if (control.toggleVisibility !== undefined && control.role === 'button') {
        field.setAttribute('aria-expanded', String(isShown(control.toggleVisibility)));
        field.setAttribute('aria-controls', visibilityId(control.toggleVisibility));
    }
    if (control.disabled) {
        element.setAttribute('opacity', String(Number(node.attrs.opacity ?? 1) * 0.5));
    }
    field.type = control.role === 'input' ? 'text' : 'button';
    if (field instanceof HTMLInputElement) {
        const bound = control.valueState;
        const draft = drafts.get(inputKey);
        // A draft stands while the state still holds what it reads as, or it reads as no number.
        field.value =
            bound === undefined
                ? (values.get(inputKey) ?? control.value ?? '')
                : draft !== undefined &&
                    (!draft.trim() ||
                        !Number.isFinite(Number(draft.trim())) ||
                        Number(draft.trim()) === stateValue(bound))
                  ? draft
                  : formatStateValue(stateValue(bound));
        if (bound !== undefined && typeof initialStates.get(bound) === 'number') {
            field.inputMode = 'decimal';
        }
        field.placeholder = control.placeholder ?? label;
        field.addEventListener('input', () => {
            if (bound === undefined) {
                values.set(inputKey, field.value);

                return;
            }
            // A number state changes only when the field holds a number; other text waits.
            const number = Number(field.value.trim());
            if (typeof initialStates.get(bound) !== 'number') {
                states.set(bound, field.value);
            } else {
                drafts.set(inputKey, field.value);
                if (!field.value.trim() || !Number.isFinite(number)) {
                    return;
                }
                states.set(bound, number);
            }
            render();
        });
        field.addEventListener('keydown', (event) => {
            if (
                event.key !== 'Enter' ||
                event.isComposing ||
                (!control.navigateTo &&
                    !control.changeVariant &&
                    control.toggleVisibility === undefined &&
                    control.changeState === undefined)
            ) {
                return;
            }
            event.preventDefault();
            activate(control);
        });
    } else {
        field.textContent = label;
        field.title = label;
        field.addEventListener('click', () => {
            activate(control);
        });
    }
    box.append(field);
    element.append(box);

    return element;
}

/** What the player shows for a node now: its record, variant and state, or nothing when hidden. */
const shownNode: AuditPick = (authored) => {
    const recordId =
        authored.recordEntity === selectedRecord?.entityId ? selectedRecord?.id : undefined;
    if (recordId && Object.hasOwn(authored.records ?? {}, recordId)) {
        return shownNode(authored.records![recordId]);
    }
    if (authored.visibility && !isShown(authored.visibility.key, authored.visibility.initial)) {
        return undefined;
    }
    const choice = authored.variantKey ? variants.get(authored.variantKey) : undefined;
    const node = choice && authored.variants?.[choice] ? authored.variants[choice] : authored;
    const label =
        node.control?.labelState !== undefined &&
        formatStateValue(stateValue(node.control.labelState));

    return label ? { ...node, control: { ...node.control!, label } } : node;
};

function reportSection(report: AuditReport) {
    const section = document.createElement('section');
    section.id = 'accessibility-report';
    section.setAttribute('aria-label', 'Accessibility report');
    const list = (title: string, items: string[], ordered = false) => {
        const heading = document.createElement('h2');
        heading.textContent = title;
        const element = document.createElement(ordered ? 'ol' : 'ul');
        element.setAttribute('aria-label', title);
        for (const text of items.length ? items : ['None']) {
            const item = document.createElement('li');
            item.textContent = text;
            element.append(item);
        }
        section.append(heading, element);
    };
    const name = (text: string) => (text ? `“${text}”` : 'no name');
    list(
        'Problems',
        report.problems.map((problem) =>
            problem.kind === 'contrast'
                ? `“${problem.text}” has contrast ${problem.ratio}:1; it needs ${problem.required}:1.`
                : problem.kind === 'name'
                  ? `A ${problem.role} showing ${name(problem.visible)} is named ${name(problem.name)}.`
                  : `Tab goes from ${name(problem.after)} back to ${name(problem.name)}.`
        )
    );
    list('Focus order', report.focusOrder.map(name), true);
    list(
        'Names',
        report.names.map(
            ({ role, name: text }) =>
                `${role === 'image' ? 'Image' : role === 'list' ? 'List' : role === 'input' ? 'Input' : 'Button'}: ${name(text)}`
        )
    );
    list(
        'Contrast',
        report.contrast.map(
            ({ text, ratio, required }) =>
                `“${text}”: ${ratio}:1, ${ratio >= required ? 'passes' : 'fails'} ${required}:1`
        )
    );

    return section;
}

function activate(control: NonNullable<PreviewNode['control']>) {
    if (
        !control.changeVariant &&
        !control.navigateTo &&
        control.toggleVisibility === undefined &&
        control.changeState === undefined
    ) {
        return;
    }
    const change = control.changeState;
    toggled = change?.key ?? control.toggleVisibility;
    if (change) {
        // Fields show the state as the action leaves it, not what was typed before.
        drafts.clear();
    }
    if (change?.change === 'set') {
        states.set(change.key, change.value);
    } else if (change?.change === 'reset') {
        states.delete(change.key);
    } else if (change?.change === 'toggle') {
        states.set(change.key, stateValue(change.key) !== true);
    } else if (control.toggleVisibility !== undefined) {
        visibility.set(control.toggleVisibility, !isShown(control.toggleVisibility));
    }
    if (control.changeVariant) {
        variants.set(control.changeVariant.key, control.changeVariant.variantId);
    }
    if (control.navigateTo) {
        // A plain navigation keeps the record only when leaving a screen that shows it.
        selectedRecord =
            control.record ??
            (selectedRecord && recordScreens.get(currentScreen ?? '')?.has(selectedRecord.entityId)
                ? selectedRecord
                : undefined);
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
    label.textContent = 'Page ';
    const select = document.createElement('select');
    select.setAttribute('aria-label', 'Preview page');
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
    reset.textContent = standalone ? 'Restart prototype' : 'Restart preview';
    reset.addEventListener('click', () => {
        values.clear();
        selectedRecord = undefined;
        variants.clear();
        visibility.clear();
        states.clear();
        drafts.clear();
        currentScreen = undefined;
        // Inspected Width and Layout return to the launch view's too.
        port?.postMessage({ type: 'inspect-reset' });
        render();
    });
    navigation.append(label);
    if (views.length > 1) {
        const viewLabel = document.createElement('label');
        viewLabel.textContent = 'View as ';
        const viewSelect = document.createElement('select');
        viewSelect.setAttribute('aria-label', 'Modes and size');
        views.forEach((view, index) => {
            const option = document.createElement('option');
            option.value = String(index);
            option.textContent = view.name;
            viewSelect.append(option);
        });
        viewSelect.value = String(currentView);
        viewSelect.addEventListener('change', () => {
            currentView = Number(viewSelect.value);
            receive(views[currentView].application);
            root.querySelector<HTMLSelectElement>('select[aria-label="Modes and size"]')?.focus();
        });
        viewLabel.append(viewSelect);
        navigation.append(viewLabel);
    }
    if (screen.layouts && !standalone) {
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
    const report =
        standalone && reportOpen ? auditScreen(screen, accessibilityRules, shownNode) : undefined;
    if (standalone) {
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.textContent = report ? `Accessibility · ${report.problems.length}` : 'Accessibility';
        toggle.setAttribute('aria-expanded', String(reportOpen));
        toggle.setAttribute('aria-controls', 'accessibility-report');
        toggle.addEventListener('click', () => {
            reportOpen = !reportOpen;
            render();
            root.querySelector<HTMLButtonElement>(
                'button[aria-controls="accessibility-report"]'
            )?.focus();
        });
        navigation.append(toggle);
    }
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', `${screen.x} ${screen.y} ${screen.width} ${screen.height}`);
    svg.setAttribute('width', String(screen.width));
    svg.setAttribute('height', String(screen.height));
    svg.setAttribute('aria-label', screen.name);
    screen.nodes.forEach((node) => svg.append(nodeElement(node)));
    root.replaceChildren(
        ...(hostControls ? [svg] : [navigation, ...(report ? [reportSection(report)] : []), svg])
    );
    port?.postMessage({ type: 'current-screen', screenId: screen.id, record: selectedRecord });
    if (hostControls) {
        document.documentElement.dataset.player = 'true';
    }
    if (key) {
        const input = Array.from(
            root.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input, button')
        ).find((input) => input.dataset.key === key);
        const opener =
            toggled === undefined
                ? null
                : root.querySelector<HTMLElement>(
                      `[aria-controls="${CSS.escape(visibilityId(toggled))}"], [data-toggle-state="${CSS.escape(toggled)}"]`
                  );
        const focusTarget = input ?? opener ?? (hostControls ? svg : select);
        if (focusTarget === svg) {
            svg.setAttribute('tabindex', '-1');
        }
        focusTarget.focus();
        if (input instanceof HTMLInputElement && selection) {
            input.setSelectionRange(selection[0], selection[1]);
        }
    }
}

function receive(value: unknown) {
    try {
        const update =
            value && typeof value === 'object'
                ? (value as {
                      images?: unknown;
                      savedRecord?: { id?: unknown; entityId?: unknown };
                  })
                : {};
        // Keep new images even if this drawing is refused: the editor counts them as sent.
        images = { ...images, ...readPreviewImages(update.images) };
        const next = readPreview({ ...update, images: undefined }, images);
        if (application?.documentId !== next.documentId) {
            values.clear();
            selectedRecord = undefined;
            variants.clear();
            visibility.clear();
            states.clear();
            drafts.clear();
            currentScreen = undefined;
        }
        const keys = new Set<string>();
        const records = new Set<string>();
        let collecting = '';
        recordScreens.clear();
        initialVariants.clear();
        initialVisibility.clear();
        visibilityConditions.clear();
        initialStates.clear();
        Object.entries(next.states ?? {}).forEach(([key, initial]) =>
            initialStates.set(key, initial)
        );
        const collect = (node: PreviewNode) => {
            if (node.control?.record) {
                records.add(JSON.stringify([node.control.record.entityId, node.control.record.id]));
            }
            if (node.recordEntity) {
                if (!recordScreens.has(collecting)) {
                    recordScreens.set(collecting, new Set());
                }
                recordScreens.get(collecting)!.add(node.recordEntity);
                Object.keys(node.records ?? {}).forEach((id) =>
                    records.add(JSON.stringify([node.recordEntity, id]))
                );
            }
            if (node.visibility) {
                initialVisibility.set(node.visibility.key, node.visibility.initial);
                if (node.visibility.condition) {
                    visibilityConditions.set(node.visibility.key, node.visibility.condition);
                }
            }
            if (node.control?.role === 'input') {
                keys.add(node.control.stateKey ?? node.key);
                if (
                    node.control.inputRecord &&
                    node.control.inputRecord.id === update.savedRecord?.id &&
                    node.control.inputRecord.entityId === update.savedRecord?.entityId
                ) {
                    values.delete(node.control.stateKey ?? node.key);
                }
            }
            node.children?.forEach(collect);
            Object.values(node.variants ?? {}).forEach(collect);
            Object.values(node.records ?? {}).forEach(collect);
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
        next.screens.forEach((screen) => {
            collecting = screen.id;
            screen.nodes.forEach(collect);
        });
        if (
            selectedRecord &&
            !records.has(JSON.stringify([selectedRecord.entityId, selectedRecord.id]))
        ) {
            selectedRecord = undefined;
        }
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
        visibility.forEach((_value, key) => {
            if (!initialVisibility.has(key)) {
                visibility.delete(key);
            }
        });
        // A value keeps only while its state is there with the same type.
        states.forEach((value, key) => {
            if (typeof initialStates.get(key) !== typeof value) {
                states.delete(key);
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
        standalone ||
        port ||
        event.source !== window.parent ||
        event.origin !== window.REACTOR_EDITOR_ORIGIN ||
        event.data?.type !== 'reactor-preview-connect' ||
        event.ports.length !== 1
    ) {
        return;
    }
    port = event.ports[0];
    port.onmessage = (event) => {
        if (event.data?.type === 'player-controls') {
            hostControls = externalControls;
            render();

            return;
        }
        if (event.data?.type === 'outline') {
            outlined = new Set(
                Array.isArray(event.data.shapeIds)
                    ? event.data.shapeIds.filter((id: unknown) => typeof id === 'string')
                    : []
            );
            render();

            return;
        }
        if (event.data?.type === 'device-frame') {
            const kind = event.data.kind;
            document.documentElement.dataset.frame =
                kind === 'phone' || kind === 'tablet' ? kind : 'none';

            return;
        }
        if (event.data?.type === 'select-screen') {
            if (
                hostControls &&
                application?.screens.some((screen) => screen.id === event.data.screenId)
            ) {
                currentScreen = event.data.screenId;
                render();
            }

            return;
        }
        receive(event.data);
    };
    port.postMessage({
        type: 'ready',
        version: PREVIEW_PROTOCOL_VERSION,
        playerControls: true,
        outline: true,
        deviceFrame: true
    });
});
window.addEventListener('pagehide', () => port?.close());

/**
 * A random id this browser keeps on the preview site, so the server counts distinct
 * players per link; it is never sent anywhere else, nor with anything about the player.
 */
function playerId() {
    try {
        const kept = localStorage.getItem('reactor:player');
        if (kept) {
            return kept;
        }
        const id = crypto.randomUUID();
        localStorage.setItem('reactor:player', id);

        return id;
    } catch {
        return undefined;
    }
}

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
            body: JSON.stringify({ token, player: playerId() }),
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
/** The thresholds a package was checked with, or the defaults. */
function readRules(value: unknown): AccessibilityRules {
    const rules = { ...DEFAULT_ACCESSIBILITY_RULES };
    if (value && typeof value === 'object') {
        for (const key of Object.keys(rules) as (keyof AccessibilityRules)[]) {
            const number = (value as Record<string, unknown>)[key];
            if (typeof number === 'number' && Number.isFinite(number) && number > 0) {
                rules[key] = number;
            }
        }
    }

    return rules;
}

/** Read the snapshot the editor wrote into the downloaded page, as a shared link would load it. */
function openPackage(element: HTMLElement) {
    try {
        const data = JSON.parse(element.textContent ?? '');
        if (data?.version !== PREVIEW_PROTOCOL_VERSION) {
            throw new Error('This prototype uses an unsupported version.');
        }
        if (typeof data.name === 'string' && data.name) {
            document.title = data.name;
        }
        const tested = readPreview(data.application);
        const known = readPreviewImages(data.application?.images);
        views = [
            { name: 'As tested', application: tested },
            ...(Array.isArray(data.views) ? data.views : []).map((view: unknown) => {
                const { name, application } = (view ?? {}) as Record<string, unknown>;
                if (typeof name !== 'string' || !name) {
                    throw new Error('This prototype could not be opened.');
                }

                return {
                    name,
                    application: readPreview(
                        { ...(application as object), images: undefined },
                        known
                    )
                };
            })
        ];
        accessibilityRules = readRules(data.accessibility);
        receive(tested);
    } catch (error) {
        root.textContent =
            error instanceof Error ? error.message : 'This prototype could not be opened.';
        root.setAttribute('role', 'status');
    }
}
if (packaged) {
    openPackage(packaged);
} else if (shared) {
    void openSharedPrototype();
}
