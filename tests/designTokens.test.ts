import { readFileSync } from 'node:fs';

interface Token {
    name: string;
    value: string | Record<string, string>;
}

interface DesignTokens {
    color: { themes: { id: string }[]; tokens: Token[] };
    shadow: { tokens: Token[] };
    [family: string]: unknown;
}

const designTokens = JSON.parse(readFileSync('design/tokens.json', 'utf8')) as DesignTokens;
const siteCss = readFileSync('static/styles/site.css', 'utf8');
const firstTheme = designTokens.color.themes[0].id;

const tokenValue = ({ value }: Token) => (typeof value === 'string' ? value : value[firstTheme]);

const families = Object.values(designTokens).filter(
    (family): family is { tokens: Token[] } =>
        typeof family === 'object' && family !== null && 'tokens' in family
);
const tokens = new Map(families.flatMap(({ tokens }) => tokens.map((t) => [t.name, t] as const)));

const rootBlock = /:root\s*{([^}]*)}/.exec(siteCss)?.[1] ?? '';
const properties = new Map(
    [...rootBlock.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value])
);

const channel = (value: string) => Number(value.endsWith('%') ? value.slice(0, -1) : value);

function rgba(red: number, green: number, blue: number, alpha: number) {
    return `rgba(${red}, ${green}, ${blue}, ${Number(alpha.toFixed(3))})`;
}

function hexColor(hex: string) {
    const digits = hex.length <= 4 ? [...hex].map((digit) => digit + digit) : hex.match(/../g)!;
    const [red, green, blue, alpha = 255] = digits.map((pair) => parseInt(pair, 16));
    return rgba(red, green, blue, alpha / 255);
}

function functionColor(args: string) {
    const [red, green, blue, alpha = '1'] = args.split(/[\s,/]+/).filter(Boolean);
    const opacity = alpha.endsWith('%') ? channel(alpha) / 100 : Number(alpha);
    return rgba(channel(red), channel(green), channel(blue), opacity);
}

/** Writes a CSS value one way, so the same color or shadow compares equal however it is spelled. */
function normalize(value: string) {
    return value
        .replace(/var\(--([\w-]+)\)/g, '{$1}')
        .replace(/#([0-9a-f]{3,8})\b/gi, (_, hex: string) => hexColor(hex.toLowerCase()))
        .replace(/rgba?\(([^)]*)\)/g, (_, args: string) => functionColor(args))
        .replace(/\s+/g, ' ')
        .trim();
}

describe('design tokens', () => {
    it('defines every custom property of site.css as a design token with the same value', () => {
        for (const [name, value] of properties) {
            const token = tokens.get(name);
            expect(token, `--${name} is not in design/tokens.json`).toBeDefined();
            expect(normalize(value), `--${name}`).toBe(normalize(tokenValue(token!)));
        }
    });

    it('defines every color and shadow token in site.css', () => {
        const names = [...designTokens.color.tokens, ...designTokens.shadow.tokens].map(
            ({ name }) => name
        );

        expect(names.filter((name) => !properties.has(name))).toEqual([]);
    });
});
