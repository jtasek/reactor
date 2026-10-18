import type { Document, Variable } from './types';
import type { DesignSystemPackage } from './designSystemPackages';
import { PACKAGE_MAX_BYTES, readDesignSystemPackage } from './designSystemPackages';
import { readPackageIdentity } from './packageIdentity';

/** DTCG 2025.10 subset. The native graph stays independent of this interchange format. */
export const DTCG_SCHEMA = 'https://www.designtokens.org/schemas/2025.10/format.json';
const EXTENSION = 'io.github.jtasek.reactor';
const MAX_DEPTH = 32;
const MAX_TOKENS = 1000;
const CHANNEL_MAX = 255;
type Fields = Record<string, unknown>;
type Token = { path: string[]; fields: Fields; type: unknown };
const keyOf = (path: string[]) => JSON.stringify(path);
const at = (path: string[]) => path.join('.') || '(document)';
function fail(path: string[], reason: string): never {
    throw new Error(`${at(path)}: ${reason}`);
}
function fields(value: unknown, path: string[]): Fields {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return fail(path, 'Expected an object.');
    return value as Fields;
}
function supportedFields(value: Fields, allowed: string[], path: string[]) {
    for (const key of Object.keys(value))
        if (!allowed.includes(key))
            fail(
                path,
                `Unsupported property ${key}. Use the native format to retain unsupported definitions.`
            );
}
function extension(value: Fields, path: string[]): Fields | undefined {
    if (value.$extensions === undefined) return;
    const extensions = fields(value.$extensions, path);
    supportedFields(extensions, [EXTENSION], path);
    return Object.hasOwn(extensions, EXTENSION) ? fields(extensions[EXTENSION], path) : undefined;
}
function checkName(name: string, path: string[]) {
    if (!name.trim() || name !== name.trim() || name.startsWith('$') || /[.{}$/]/.test(name))
        fail(path, 'This name cannot be represented as a Reactor token path.');
}
function byteColor(value: unknown, path: string[]): string {
    const color = fields(value, path);
    supportedFields(color, ['colorSpace', 'components', 'alpha', 'hex'], path);
    if (color.colorSpace !== 'srgb') fail(path, 'Only sRGB colors are supported.');
    if (color.alpha !== undefined && color.alpha !== 1)
        fail(path, 'Only opaque colors are supported.');
    if (!Array.isArray(color.components) || color.components.length !== 3)
        fail(path, 'A color needs three numeric sRGB components.');
    if (
        color.hex !== undefined &&
        (typeof color.hex !== 'string' || !/^#[\da-f]{6}$/i.test(color.hex))
    )
        fail(path, 'Invalid color hex fallback.');
    return `#${color.components
        .map((component) => {
            if (
                typeof component !== 'number' ||
                !Number.isFinite(component) ||
                component < 0 ||
                component > 1
            )
                return fail(path, 'sRGB components must be numbers between 0 and 1.');
            return Math.round(component * CHANNEL_MAX)
                .toString(16)
                .padStart(2, '0');
        })
        .join('')}`;
}
function literal(type: unknown, value: unknown, path: string[]): string | number {
    if (type === 'color') return byteColor(value, path);
    if (type === 'number' && typeof value === 'number' && Number.isFinite(value)) return value;
    return fail(
        path,
        type === 'number'
            ? 'Expected a finite unitless number.'
            : `Unsupported token type ${String(type)}. Supported types: color and number.`
    );
}
function reference(token: Token): string[] | undefined {
    const value = token.fields.$value;
    if (typeof value === 'string') {
        const match = /^\{([^{}]+)\}$/.exec(value);
        if (!match) return fail(token.path, 'Expected a whole-token alias such as {color.ink}.');
        return match[1].split('.');
    }
    if (token.fields.$ref !== undefined) {
        const ref = token.fields.$ref;
        if (typeof ref !== 'string' || !ref.startsWith('#'))
            return fail(token.path, 'Only local whole-token JSON Pointer aliases are supported.');
        let pointer: string;
        try {
            pointer = decodeURIComponent(ref.slice(1));
        } catch {
            return fail(token.path, 'Invalid URI fragment encoding in JSON Pointer.');
        }
        if (!pointer.startsWith('/'))
            return fail(token.path, 'Only local whole-token JSON Pointer aliases are supported.');
        const segments = pointer
            .slice(1)
            .split('/')
            .map((segment) => {
                if (/~(?![01])/.test(segment))
                    return fail(token.path, 'Invalid JSON Pointer escape.');
                return segment.replace(/~1/g, '/').replace(/~0/g, '~');
            });
        if (segments.pop() !== '$value')
            return fail(token.path, 'Property-level JSON Pointer references are unsupported.');
        return segments;
    }
}

/** Converts a supported file into an ordinary validated native package, without writes. */
export function parseDesignTokenInterchange(
    text: string,
    filename = 'tokens.json'
): DesignSystemPackage {
    if (new TextEncoder().encode(text).length > PACKAGE_MAX_BYTES)
        throw new Error('The package is larger than 1 MiB.');
    const root = fields(JSON.parse(text), []);
    if (root.$schema !== undefined && root.$schema !== DTCG_SCHEMA)
        fail([], 'Unsupported DTCG schema version.');
    const meta = extension(root, []);
    if (meta) {
        supportedFields(meta, ['version', 'id', 'name'], []);
        if (meta.version !== 1) fail([], 'Unsupported Reactor interchange extension version.');
    }
    const packageId = meta ? meta.id : `dtcg:${filename}`;
    const name = meta ? meta.name : filename;
    const tokens = new Map<string, Token>();
    const walk = (value: unknown, path: string[], inheritedType: unknown) => {
        if (path.length > MAX_DEPTH) fail(path, 'Token groups are nested too deeply.');
        const node = fields(value, path);
        const type = node.$type === undefined ? inheritedType : node.$type;
        if (type !== undefined && type !== 'color' && type !== 'number')
            fail(
                path,
                `Unsupported token type ${String(type)}. Supported types: color and number.`
            );
        if (Object.hasOwn(node, '$value') || Object.hasOwn(node, '$ref')) {
            if (path.length === 0) fail(path, 'A token must have a name.');
            supportedFields(node, ['$value', '$ref', '$type', '$extensions'], path);
            if (Object.hasOwn(node, '$value') && Object.hasOwn(node, '$ref'))
                fail(path, 'A token cannot have both $value and $ref.');
            if (tokens.size >= MAX_TOKENS)
                fail(path, 'A package must contain at most 1000 tokens.');
            tokens.set(keyOf(path), { path, fields: node, type });
            return;
        }
        const allowed = path.length === 0 ? ['$type', '$extensions', '$schema'] : ['$type'];
        for (const [key, child] of Object.entries(node).sort(([a], [b]) =>
            a < b ? -1 : a > b ? 1 : 0
        )) {
            if (allowed.includes(key)) continue;
            if (key === '$root') {
                walk(child, [...path, key], type);
                continue;
            }
            if (key.startsWith('$')) fail(path, `Unsupported property ${key}.`);
            checkName(key, [...path, key]);
            walk(child, [...path, key], type);
        }
    };
    walk(root, [], undefined);
    const built = new Map<string, { variable: Variable; resolved: string | number }>();
    const build = (
        token: Token,
        within: string[]
    ): { variable: Variable; resolved: string | number } => {
        const key = keyOf(token.path);
        const existing = built.get(key);
        if (existing) return existing;
        if (within.includes(key) || within.length >= MAX_DEPTH)
            fail(token.path, 'Circular or too deep alias reference.');
        const target = reference(token);
        const targetToken = target === undefined ? undefined : tokens.get(keyOf(target));
        if (target && !targetToken) fail(token.path, `Missing token ${at(target)}.`);
        const source = targetToken ? build(targetToken, [...within, key]) : undefined;
        const type = token.type ?? source?.variable.type;
        if (source && type !== source.variable.type)
            fail(token.path, 'Alias and source types differ.');
        const resolved = source ? source.resolved : literal(type, token.fields.$value, token.path);
        if (type !== 'number' && type !== 'color')
            return fail(token.path, 'Unsupported token type.');
        const tokenMeta = extension(token.fields, token.path);
        if (tokenMeta) supportedFields(tokenMeta, ['id', 'source', 'fallback'], token.path);
        const namePath =
            token.path[token.path.length - 1] === '$root' ? token.path.slice(0, -1) : token.path;
        if (!namePath.length) fail(token.path, 'A root token needs a named group.');
        const name = namePath.join('/');
        const id = tokenMeta ? tokenMeta.id : `dtcg:${name}`;
        const identity =
            tokenMeta?.source === undefined
                ? readPackageIdentity({ packageId, tokenId: id })
                : readPackageIdentity(tokenMeta.source);
        const fallback = tokenMeta?.fallback;
        if (fallback !== undefined && !source)
            fail(token.path, 'Only aliases may retain a fallback.');
        const defaultValue =
            fallback === undefined
                ? resolved
                : type === 'number'
                  ? literal(type, fallback, token.path)
                  : typeof fallback === 'string' && /^#[\da-f]{6}$/i.test(fallback)
                    ? fallback
                    : fail(token.path, 'Invalid alias color fallback.');
        const variable = {
            id,
            name,
            type,
            source: identity,
            values: { default: defaultValue },
            ...(source ? { alias: source.variable.id } : {})
        } as Variable;
        const result = { variable, resolved };
        built.set(key, result);
        return result;
    };
    const variables = [...tokens.values()].map((token) => build(token, []).variable);
    return readDesignSystemPackage({
        format: 'reactor-design-system',
        version: 1,
        id: packageId,
        name,
        dimensions: [],
        variables
    });
}

/** Refuse unsupported definitions rather than dropping them or flattening mode/alias semantics. */
export function exportDesignTokenInterchange(document: Document): string {
    const data = readDesignSystemPackage({
        format: 'reactor-design-system',
        version: 1,
        id: document.id,
        name: document.name,
        variables: Object.values(document.variables),
        dimensions: Object.values(document.dimensions)
    });
    if (data.dimensions.length)
        throw new Error(
            'DTCG mode interchange is unsupported. Use the native format to retain dimensions and modes.'
        );
    const paths = new Map<string, string[]>();
    for (const variable of data.variables) {
        if (variable.type !== 'color' && variable.type !== 'number')
            throw new Error(
                `${variable.name}: DTCG export supports color and number tokens. Use the native format to retain ${variable.type} variables.`
            );
        const path = variable.name.split('/');
        path.forEach((segment) => checkName(segment, path));
        paths.set(variable.id, path);
    }
    for (const [id, path] of paths) {
        if (
            [...paths.values()].some(
                (other) =>
                    other.length > path.length && path.every((segment, i) => other[i] === segment)
            )
        )
            paths.set(id, [...path, '$root']);
    }
    const output: Fields = {
        $schema: DTCG_SCHEMA,
        $extensions: { [EXTENSION]: { version: 1, id: data.id, name: data.name } }
    };
    const colorValue = (value: string) => ({
        colorSpace: 'srgb',
        components: [1, 3, 5].map(
            (index) => parseInt(value.slice(index, index + 2), 16) / CHANNEL_MAX
        ),
        alpha: 1,
        hex: value
    });
    for (const variable of data.variables) {
        const path = paths.get(variable.id)!;
        if (path.length > MAX_DEPTH) fail(path, 'Token groups are nested too deeply.');
        let group = output;
        for (const segment of path.slice(0, -1)) {
            if (!Object.hasOwn(group, segment))
                Object.defineProperty(group, segment, { value: {}, enumerable: true });
            group = group[segment] as Fields;
        }
        const literalValue =
            variable.type === 'color'
                ? colorValue(variable.values.default)
                : variable.values.default;
        const token = {
            $type: variable.type,
            $value:
                variable.alias === undefined
                    ? literalValue
                    : `{${paths.get(variable.alias)!.join('.')}}`,
            $extensions: {
                [EXTENSION]: {
                    id: variable.id,
                    source: variable.source,
                    ...(variable.alias === undefined ? {} : { fallback: variable.values.default })
                }
            }
        };
        Object.defineProperty(group, path[path.length - 1], { value: token, enumerable: true });
    }
    // Keep exports stable regardless of document insertion order.
    const text = `${JSON.stringify(output, null, 2)}\n`;
    if (new TextEncoder().encode(text).length > PACKAGE_MAX_BYTES)
        throw new Error('The package is larger than 1 MiB.');
    return text;
}
