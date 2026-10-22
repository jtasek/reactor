/** The complete sandbox contract. Contains no document records, user data or executable code. */
export interface PreviewNode {
    key: string;
    tag: 'g' | 'rect' | 'circle' | 'ellipse' | 'line' | 'polyline' | 'text' | 'image';
    attrs: Record<string, string | number>;
    text?: string;
    /** SHA-256 key into the application's verified raster image table. */
    image?: string;
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

/** Drawing projected from the graph, before image bytes have been prepared. */
export interface PreviewDrawing {
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

export interface PreviewApplication extends PreviewDrawing {
    images: Record<string, string>;
}

/** Bound on the drawing itself, measured as JSON without its image table. */
export const MAX_PREVIEW_BYTES = 8 * 1024 * 1024;
/** Bound on the image bytes one preview shows, measured as decoded files, not base64 text. */
export const MAX_PREVIEW_IMAGE_BYTES = 8 * 1024 * 1024;
/** Matches the editor's per-image limit (`MAX_IMAGE_BYTES`). */
const MAX_PREVIEW_IMAGE_FILE_BYTES = 5 * 1024 * 1024;
const IMAGE_URL = /^data:image\/(png|jpeg|gif|webp);base64,([a-z0-9+/]*={0,2})$/i;
/** Version 2 adds the verified image table; older runtimes silently omit image references. */
export const PREVIEW_PROTOCOL_VERSION = 2;
export const MAX_PREVIEW_NODES = 5000;
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
            return (
                /^(#[0-9a-f]{6}|none|currentColor)$/i.test(value) ||
                (key === 'stroke' && value === 'var(--shape-stroke-color)')
            );
        case 'transform':
            return /^(?:(?:translate|rotate)\([-+\d.eE ,]+\)\s*)+$/.test(value);
        case 'points':
            return /^[-+\d.eE ,]*$/.test(value);
        case 'preserveAspectRatio':
            return value === 'xMidYMid meet';
        default:
            return false;
    }
}

/** Decoded size of a raster data URL, or undefined when it is not one. */
function imageBytes(url: unknown) {
    const data = string(url) ? IMAGE_URL.exec(url)?.[2] : undefined;
    if (data === undefined || data.length % 4 !== 0) {
        return undefined;
    }

    return (data.length / 4) * 3 - (data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0);
}

/** Validates an image table entry by entry. Each data URL needs checking only once:
 * the editor checks it when it is prepared, the runtime when it first arrives. */
export function readPreviewImages(value: unknown): Record<string, string> {
    return Object.fromEntries(
        Object.entries(object(value ?? {})).map(([hash, url]) => {
            const bytes = imageBytes(url);
            if (!/^[a-f0-9]{64}$/.test(hash) || bytes === undefined) {
                throw new Error('Invalid preview image resource.');
            }
            if (bytes > MAX_PREVIEW_IMAGE_FILE_BYTES) {
                throw new Error(
                    'A preview image is larger than 5 MiB. Replace it with a smaller one.'
                );
            }

            return [hash, url as string];
        })
    );
}

/** Both ends validate before rendering. DOM construction never accepts arbitrary tags or attributes.
 * Images in `value.images` are validated here; `known` holds images validated earlier, which a
 * drawing may refer to without sending them again. The result's table has only the images it uses. */
export function readPreview(
    value: unknown,
    known: Readonly<Record<string, string>> = {}
): PreviewApplication {
    const app = object(value);
    const sent = readPreviewImages(app.images);
    if (
        new TextEncoder().encode(JSON.stringify({ ...app, images: undefined })).byteLength >
        MAX_PREVIEW_BYTES
    ) {
        throw new Error('Preview exceeds the 8 MiB limit.');
    }
    if (!string(app.documentId) || !Array.isArray(app.screens) || !app.screens.length) {
        throw new Error('Add a visible top-level frame to preview a screen.');
    }
    const available = (hash: string) =>
        Object.hasOwn(sent, hash)
            ? sent[hash]
            : Object.hasOwn(known, hash)
              ? known[hash]
              : undefined;
    const images: Record<string, string> = {};
    const keys = new Set<string>();
    const screenIds = new Set<string>();
    const nodes: PreviewNode[] = [];
    const readNode = (value: unknown, depth: number): PreviewNode => {
        const node = object(value);
        if (
            depth > MAX_DEPTH ||
            nodes.length >= MAX_PREVIEW_NODES ||
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
        if (node.tag === 'image') {
            const url = string(node.image) ? available(node.image) : undefined;
            if (url === undefined) {
                throw new Error('A preview image resource is missing.');
            }
            result.image = node.image as string;
            images[result.image] = url;
        } else if (node.image !== undefined) {
            throw new Error('Only image elements may reference raster resources.');
        }
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

    const imageTotal = Object.values(images).reduce((total, url) => total + imageBytes(url)!, 0);
    if (imageTotal > MAX_PREVIEW_IMAGE_BYTES) {
        throw new Error('Preview images exceed the 8 MiB limit. Remove or reduce some images.');
    }

    return { documentId: app.documentId, screens, images };
}
