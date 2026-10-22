/** The complete sandbox contract. Contains no document records, user data or executable code. */
export interface PreviewNode {
    key: string;
    tag: 'g' | 'rect' | 'circle' | 'ellipse' | 'line' | 'polyline' | 'text' | 'image';
    attrs: Record<string, string | number>;
    text?: string;
    children?: PreviewNode[];
    control?: {
        role: 'text' | 'input' | 'button' | 'list' | 'image';
        label: string;
        value?: string;
        placeholder?: string;
        disabled?: boolean;
        navigateTo?: string;
        x: number;
        y: number;
        width: number;
        height: number;
    };
}

export interface PreviewApplication {
    documentId: string;
    screens: {
        id: string;
        name: string;
        x: number;
        y: number;
        width: number;
        height: number;
        nodes: PreviewNode[];
    }[];
}

export const MAX_PREVIEW_BYTES = 8 * 1024 * 1024;
const MAX_NODES = 5000;
const MAX_DEPTH = 32;
const TAGS = new Set(['g', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'text', 'image']);
const NUMBERS = new Set([
    'x',
    'y',
    'width',
    'height',
    'rx',
    'ry',
    'r',
    'cx',
    'cy',
    'x1',
    'y1',
    'x2',
    'y2',
    'opacity',
    'stroke-width',
    'font-size'
]);
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const object = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Invalid preview data.');
    }

    return value as Record<string, unknown>;
};
const string = (value: unknown): value is string => typeof value === 'string';
function attribute(key: string, value: unknown) {
    if (NUMBERS.has(key)) {
        return finite(value);
    }
    if (!string(value)) {
        return false;
    }
    switch (key) {
        case 'fill':
        case 'stroke':
            return /^(#[0-9a-f]{6}|none|currentColor)$/i.test(value);
        case 'transform':
            return /^(?:(?:translate|rotate)\([-+\d.eE ,]+\)\s*)+$/.test(value);
        case 'points':
            return /^[-+\d.eE ,]*$/.test(value);
        case 'href':
            return /^data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=]+$/i.test(value);
        default:
            return false;
    }
}

/** Both ends validate before rendering. DOM construction never accepts arbitrary tags or attributes. */
export function readPreview(value: unknown): PreviewApplication {
    if (new TextEncoder().encode(JSON.stringify(value)).byteLength > MAX_PREVIEW_BYTES) {
        throw new Error('Preview exceeds the 8 MiB limit.');
    }
    const app = object(value);
    if (!string(app.documentId) || !Array.isArray(app.screens) || !app.screens.length) {
        throw new Error('Add a visible top-level frame to preview a screen.');
    }
    const keys = new Set<string>();
    const screenIds = new Set<string>();
    const nodes: PreviewNode[] = [];
    const readNode = (value: unknown, depth: number): PreviewNode => {
        const node = object(value);
        if (
            depth > MAX_DEPTH ||
            nodes.length >= MAX_NODES ||
            !string(node.key) ||
            keys.has(node.key) ||
            !string(node.tag) ||
            !TAGS.has(node.tag)
        ) {
            throw new Error('Invalid or excessively complex preview content.');
        }
        keys.add(node.key);
        const attrs = object(node.attrs);
        if (
            !Object.entries(attrs).every(([key, value]) => attribute(key, value)) ||
            (node.text !== undefined && !string(node.text))
        ) {
            throw new Error('Invalid preview drawing attributes.');
        }
        const result: PreviewNode = {
            key: node.key,
            tag: node.tag as PreviewNode['tag'],
            attrs: attrs as PreviewNode['attrs']
        };
        nodes.push(result);
        if (node.text !== undefined) {
            result.text = node.text as string;
        }
        if (node.children !== undefined) {
            if (!Array.isArray(node.children)) {
                throw new Error('Invalid preview children.');
            }
            result.children = node.children.map((child) => readNode(child, depth + 1));
        }
        if (node.control !== undefined) {
            const c = object(node.control);
            if (
                !['text', 'input', 'button', 'list', 'image'].includes(String(c.role)) ||
                !string(c.label) ||
                !['x', 'y', 'width', 'height'].every((key) => finite(c[key])) ||
                (c.width as number) < 0 ||
                (c.height as number) < 0 ||
                ['value', 'placeholder', 'navigateTo'].some(
                    (key) => c[key] !== undefined && !string(c[key])
                ) ||
                (c.disabled !== undefined && typeof c.disabled !== 'boolean')
            ) {
                throw new Error('Invalid preview control.');
            }
            result.control = {
                role: c.role,
                label: c.label,
                value: c.value,
                placeholder: c.placeholder,
                disabled: c.disabled,
                navigateTo: c.navigateTo,
                x: c.x,
                y: c.y,
                width: c.width,
                height: c.height
            } as PreviewNode['control'];
        }

        return result;
    };
    const screens = app.screens.map((value) => {
        const screen = object(value);
        if (
            !string(screen.id) ||
            screenIds.has(screen.id) ||
            !string(screen.name) ||
            !['x', 'y', 'width', 'height'].every((key) => finite(screen[key])) ||
            (screen.width as number) <= 0 ||
            (screen.height as number) <= 0 ||
            !Array.isArray(screen.nodes)
        ) {
            throw new Error('Invalid preview screen.');
        }
        screenIds.add(screen.id);
        // Keys need only be unique within a screen; a document instance belongs to one root.
        keys.clear();

        return {
            id: screen.id,
            name: screen.name,
            x: screen.x as number,
            y: screen.y as number,
            width: screen.width as number,
            height: screen.height as number,
            nodes: screen.nodes.map((node) => readNode(node, 0))
        };
    });
    if (nodes.some((node) => node.control?.navigateTo && !screenIds.has(node.control.navigateTo))) {
        throw new Error('A button refers to a missing or hidden screen. Choose another target.');
    }

    return { documentId: app.documentId, screens };
}
