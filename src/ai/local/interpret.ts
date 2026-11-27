import * as appCommands from 'src/commands';
import { mentions, suggestions, type Match, type Term } from './fuzzy';
import { linkExample, readLink, readList, type FlowContext } from './links';
import {
    PROPERTIES,
    STEPS,
    box,
    property,
    shown,
    translate,
    type Box,
    type Changes,
    type Property,
    type PropertyId,
    type ShapeFields
} from './shapes';

export type Operation = Record<string, unknown> & { op: string };

/** What the chat shares with a request, as far as the local model reads it. */
export interface Context {
    selection?: string[];
    shapes?: Record<string, ShapeFields>;
    groups?: Record<string, { name: string; shapes: string[] }>;
    /** What the accessibility check found, with the batch that fixes what it can. */
    accessibility?: { fixes?: Operation[] };
    flow?: FlowContext;
}

/** What the local model makes of a request: operations to propose, and words to say. */
export interface Reading {
    operations: Operation[];
    text: string;
}

/** Where shapes added to an empty document start, and the room between new shapes. */
const LAYOUT = { origin: 40, gap: 24 };

const NEW_SHAPE = {
    rectangle: { width: 160, height: 48 },
    square: { width: 80, height: 80 },
    circle: { x: 32, y: 32 },
    ellipse: { x: 48, y: 32 },
    line: 120,
    fontSize: 24,
    fill: '#3366ff',
    stroke: '#111111'
};

const LIMITS = {
    /** The most shapes one request adds. */
    added: 10,
    /** The most shapes an answer describes one by one. */
    described: 5,
    /** How much "bigger" and "smaller" scale a shape without an amount. */
    scale: 1.25,
    /** Shape names shorter than this are not looked for in a request. */
    nameLength: 3
};

const COLORS: Record<string, string> = {
    red: '#e5484d',
    orange: '#f76b15',
    yellow: '#ffc53d',
    green: '#30a46c',
    teal: '#12a594',
    blue: '#3366ff',
    purple: '#8e4ec6',
    violet: '#8e4ec6',
    pink: '#d6409f',
    brown: '#8d6e63',
    black: '#111111',
    white: '#ffffff',
    gray: '#8b8d98',
    grey: '#8b8d98'
};

const COUNTS: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10
};

type Intent =
    | 'add'
    | 'delete'
    | 'duplicate'
    | 'group'
    | 'ungroup'
    | 'align'
    | 'distribute'
    | 'move'
    | 'rename'
    | 'set'
    | 'make'
    | 'increase'
    | 'decrease'
    | 'rotate'
    | 'describe'
    | 'help';

const INTENTS: Term<Intent>[] = [
    { id: 'add', phrases: ['add', 'create', 'draw', 'insert', 'new'] },
    { id: 'delete', phrases: ['delete', 'remove', 'erase', 'trash'] },
    { id: 'duplicate', phrases: ['duplicate', 'clone', 'copy'] },
    { id: 'ungroup', phrases: ['ungroup'] },
    { id: 'group', phrases: ['group'] },
    { id: 'align', phrases: ['align', 'line up'] },
    { id: 'distribute', phrases: ['distribute', 'space', 'spread'] },
    { id: 'move', phrases: ['move', 'shift', 'nudge'] },
    { id: 'rename', phrases: ['rename', 'call'] },
    {
        id: 'set',
        phrases: ['set', 'change', 'update', 'edit', 'replace', 'give', 'recolor', 'recolour']
    },
    // "make a circle" draws one; "make it red" changes the selection.
    { id: 'make', phrases: ['make'] },
    { id: 'increase', phrases: ['increase', 'raise', 'grow', 'enlarge', 'more'] },
    { id: 'decrease', phrases: ['decrease', 'reduce', 'lower', 'shrink', 'less'] },
    { id: 'rotate', phrases: ['rotate', 'turn', 'spin'] },
    {
        id: 'describe',
        phrases: ['describe', 'properties', 'props', 'info', 'inspect', 'details', 'what']
    },
    { id: 'help', phrases: ['help', 'commands', 'examples', 'can you do'] }
];

type Kind = 'rectangle' | 'square' | 'circle' | 'ellipse' | 'line' | 'text';

const SHAPES: Term<Kind>[] = [
    { id: 'rectangle', phrases: ['rectangle', 'rect', 'box'] },
    { id: 'square', phrases: ['square'] },
    { id: 'circle', phrases: ['circle', 'dot'] },
    { id: 'ellipse', phrases: ['ellipse', 'oval'] },
    { id: 'line', phrases: ['line'] },
    { id: 'text', phrases: ['text', 'label', 'heading', 'title'] }
];

const COLOR_TERMS: Term[] = Object.keys(COLORS).map((id) => ({ id, phrases: [id] }));

const DIRECTIONS: Term<'left' | 'right' | 'up' | 'down'>[] = [
    { id: 'left', phrases: ['left'] },
    { id: 'right', phrases: ['right'] },
    { id: 'up', phrases: ['up', 'upwards'] },
    { id: 'down', phrases: ['down', 'downwards'] }
];

type Edge = 'left' | 'right' | 'top' | 'bottom' | 'center' | 'middle';

const EDGES: Term<Edge>[] = [
    { id: 'left', phrases: ['left'] },
    { id: 'right', phrases: ['right'] },
    { id: 'top', phrases: ['top'] },
    { id: 'bottom', phrases: ['bottom'] },
    { id: 'center', phrases: ['center', 'centre', 'centers', 'centres'] },
    { id: 'middle', phrases: ['middle', 'middles'] }
];

const AXES: Term<'horizontal' | 'vertical'>[] = [
    { id: 'horizontal', phrases: ['horizontal', 'horizontally', 'row'] },
    { id: 'vertical', phrases: ['vertical', 'vertically', 'column'] }
];

const SCOPES: Term[] = [{ id: 'all', phrases: ['all', 'every', 'everything', 'each'] }];

/** Words that change a property without naming it: which, and whether up or down. */
const RELATIVE: Array<Term & { changes: Array<[PropertyId, 1 | -1]>; scales?: true }> = [
    {
        id: 'bigger',
        phrases: ['bigger', 'larger'],
        changes: [
            ['width', 1],
            ['height', 1],
            ['fontSize', 1]
        ],
        scales: true
    },
    {
        id: 'smaller',
        phrases: ['smaller'],
        changes: [
            ['width', -1],
            ['height', -1],
            ['fontSize', -1]
        ],
        scales: true
    },
    { id: 'wider', phrases: ['wider'], changes: [['width', 1]] },
    { id: 'narrower', phrases: ['narrower'], changes: [['width', -1]] },
    { id: 'taller', phrases: ['taller', 'higher'], changes: [['height', 1]] },
    { id: 'shorter', phrases: ['shorter'], changes: [['height', -1]] },
    { id: 'rounder', phrases: ['rounder', 'rounded'], changes: [['cornerRadius', 1]] },
    { id: 'bolder', phrases: ['bolder'], changes: [['fontWeight', 1]] },
    { id: 'lighter', phrases: ['lighter', 'thinner'], changes: [['fontWeight', -1]] },
    {
        id: 'fainter',
        phrases: ['fainter', 'faded', 'fade', 'transparent'],
        changes: [['opacity', -1]]
    }
];

/** Words that are a property and its value at once. */
const PRESETS: Array<Term & { sets: [PropertyId, number] }> = [
    { id: 'bold', phrases: ['bold'], sets: ['fontWeight', 700] },
    { id: 'regular', phrases: ['regular', 'normal'], sets: ['fontWeight', 400] },
    { id: 'opaque', phrases: ['opaque', 'solid'], sets: ['opacity', 1] },
    { id: 'sharp', phrases: ['sharp'], sets: ['cornerRadius', 0] }
];

/** Small words that carry no request, left out of "did you mean". */
const FILLER = new Set(
    'a an the it them this that these those to as by of in on at and or with for is are be my its their please just now then so too very can you i me into from than px selected selection shape shapes item items thing things'.split(
        ' '
    )
);

export const SELECT_FIRST = 'Select what to change on the canvas first, then ask again.';

/** What asks for the whole list rather than a few examples. */
const EVERYTHING: Term[] = [{ id: 'all', phrases: ['all', 'everything', 'full', 'list'] }];

const HELP_LINES = {
    intro: 'Say what you want in plain words. As you type, press Tab to finish the sentence.',
    more: '`help all` lists everything I understand.',
    selectFirst: 'select a shape first',
    add: ['`add a red rectangle`', '`add text "Hello"`'],
    one: ['`move right 40`', '`duplicate`'],
    several: ['`align left`', '`group`'],
    test: [
        '- `/slow add 5 circles` streams slowly, so it can be stopped',
        '- `/repair add a circle` sends a broken answer first',
        '- `/words Hello` answers in words only',
        '- `/fail limit` fails as the server would; also busy, off, refused, incomplete, network'
    ]
};

const selectedShapes = (context: Context) =>
    (context.selection ?? [])
        .map((id) => context.shapes?.[id])
        .filter((shape) => shape !== undefined);

/** What can be said to change `selected`, each property with its value when one shape is selected. */
export function changeExamples(selected: ShapeFields[]): Array<{ example: string; now?: string }> {
    const has = (id: PropertyId) =>
        selected.every((shape) => property(id).read(shape) !== undefined);
    const valued = (id: PropertyId, example: string) =>
        has(id)
            ? [
                  {
                      example,
                      now: selected.length === 1 ? shown(property(id), selected[0]) : undefined
                  }
              ]
            : [];

    return [
        ...(has('value') ? [{ example: 'change text to "Hi"' }] : []),
        { example: 'make it green' },
        ...valued('cornerRadius', 'corner radius 12'),
        ...valued('fontSize', 'font size 32'),
        ...valued('width', 'wider by 40'),
        ...valued('opacity', 'opacity 50%'),
        ...valued('rotation', 'rotate 45')
    ];
}

/**
 * A few examples from each kind of request. With shapes selected, the changes are
 * about those shapes.
 */
export function help(context: Context = {}): string {
    const selected = selectedShapes(context);
    const one = selected.length === 1;
    const subject =
        selected.length === 0
            ? HELP_LINES.selectFirst
            : one
              ? String(selected[0].name ?? '')
              : `${selected.length} shapes`;
    const items = (lines: string[]) => lines.map((line) => `- ${line}`);
    const link = linkExample(context.flow);

    return [
        HELP_LINES.intro,
        '**Add**',
        ...items(HELP_LINES.add),
        `**Change** ${subject}`,
        ...items(
            changeExamples(selected)
                .slice(0, 2)
                .map(({ example, now }) => `\`${example}\`${now ? ` now ${now}` : ''}`)
        ),
        `**Arrange** ${selected.length === 0 ? HELP_LINES.selectFirst : ''}`.trim(),
        ...items(selected.length > 1 ? HELP_LINES.several : HELP_LINES.one),
        ...(link ? ['**Link**', ...items([`\`${link}\``, '`list actions`'])] : []),
        '',
        HELP_LINES.more
    ].join('\n');
}

/** Everything the local model understands, from the words it knows. */
export function capabilities(): string {
    const first = (terms: readonly Term[]) => terms.map((term) => term.phrases[0]).join(', ');

    return [
        '# Everything I understand',
        'Typos, plurals and short forms are fine.',
        '**Add** shapes',
        first(SHAPES),
        'with a count, a color, a size and a name',
        '- `add 3 red circles named "Dot"`',
        '- `add a 200x60 rectangle`',
        '- `add text "Hello" font size 32 bold`',
        '**Change** properties',
        PROPERTIES.map((item) => item.label).join(', '),
        '- `width 200 height 60`',
        '- `set stroke to blue`',
        '- `rename to "Card"`',
        `by a step: ${first(RELATIVE)}`,
        '- `make it wider by 40`',
        `at once: ${first(PRESETS)}`,
        '**Colors**',
        `${Object.keys(COLORS).join(', ')}, or a hex like #112233`,
        '**Arrange**',
        '- `move right 40`',
        `- \`align top\` also ${EDGES.filter(({ id }) => id !== 'top')
            .map(({ id }) => id)
            .join(', ')}`,
        '- `distribute horizontally` or vertically',
        '- `duplicate`',
        '- `group as "Row"` and `ungroup`',
        '- `delete it`',
        '**Link** pages',
        '- `open Details when I click Continue`',
        '- `link Next on Home to Details`',
        '- `start on Login`',
        '**Which shapes**',
        'the selection, a shape’s name, or `all circles`',
        '**Ask**',
        '- `props` what the selection has',
        '- `list actions` on Flow and Prototype; also events, pages, controls, states',
        '- `help` a few examples',
        '**Test** the chat',
        ...HELP_LINES.test
    ].join('\n');
}

/** The help when nothing is selected. */
export const HELP = help();

const HELP_HINT = 'Send `help` for examples.';

type Token = { raw: string; start: number; end: number; used?: true } & (
    | { kind: 'word'; word: string }
    | { kind: 'text'; text: string }
    | { kind: 'color'; color: string }
    | { kind: 'size'; width: number; height: number }
    | { kind: 'number'; value: number }
);

const TOKEN =
    /["“]([^"”]*)["”]|#([0-9a-f]{6}|[0-9a-f]{3})\b|(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)|((?<![a-z])-?\d+(?:\.\d+)?)|[a-z]+/gi;

function tokenize(prompt: string): Token[] {
    return [...prompt.matchAll(TOKEN)].map((match): Token => {
        const [raw, text, hex, width, height, value] = match;
        const place = { raw, start: match.index, end: match.index + raw.length };

        if (text !== undefined) {
            return { ...place, kind: 'text', text };
        }
        if (hex !== undefined) {
            const full = hex.length === 3 ? [...hex].map((digit) => digit + digit).join('') : hex;

            return { ...place, kind: 'color', color: `#${full.toLowerCase()}` };
        }
        if (width !== undefined) {
            return { ...place, kind: 'size', width: Number(width), height: Number(height) };
        }
        if (value !== undefined) {
            return { ...place, kind: 'number', value: Number(value) };
        }

        return { ...place, kind: 'word', word: raw.toLowerCase() };
    });
}

let made = 0;

/** An ID no other answer of this page carries; `crypto.randomUUID` needs a secure origin. */
export const localId = () => `local-${Date.now().toString(36)}-${++made}`;

const nameOf = (shape: ShapeFields) => String(shape.name ?? shape.type ?? 'shape');
const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;
const list = (items: string[]) => items.map((item) => `\`${item}\``).join(' · ');

/** A property to give a value, or to change by an amount, on each shape it applies to. */
interface Assignment {
    /** In order of preference: "color" is a font color on text and a fill elsewhere. */
    candidates: PropertyId[];
    value?: string | number;
    /** Added to, or multiplied with, the current value instead of replacing it. */
    by?: { sign: 1 | -1; amount?: number; scale?: true };
}

/** One request, read once: its tokens and what each vocabulary finds in them. */
class Request {
    readonly tokens: Token[];
    readonly words: Array<string | undefined>;
    /** Properties the request names without a value it could read. */
    readonly unvalued: Property[] = [];

    constructor(readonly prompt: string) {
        this.tokens = tokenize(prompt);
        this.words = this.tokens.map((token) => (token.kind === 'word' ? token.word : undefined));
    }

    /** The terms of `vocabulary` among the words no earlier reading has used. */
    find<Id extends string>(vocabulary: readonly Term<Id>[]): Match<Id>[] {
        return mentions(
            this.words.map((word, index) => (this.tokens[index].used ? undefined : word)),
            vocabulary
        );
    }

    use({ at, length }: { at: number; length: number }) {
        for (let index = at; index < at + length; index++) {
            this.tokens[index].used = true;
        }
    }

    /** The nearest unused token `accepts`, after `from` up to `until`, else before `from`. */
    value<T extends Token>(
        accepts: (token: Token) => token is T,
        from: number,
        until: number,
        back: number
    ): T | undefined {
        const free = (index: number) => !this.tokens[index].used && accepts(this.tokens[index]);

        for (let index = from; index < until; index++) {
            if (free(index)) {
                this.tokens[index].used = true;

                return this.tokens[index] as T;
            }
        }
        for (let index = back - 1; index >= 0; index--) {
            if (this.tokens[index].kind === 'word' && this.tokens[index].used) {
                break;
            }
            if (free(index)) {
                this.tokens[index].used = true;

                return this.tokens[index] as T;
            }
        }

        return undefined;
    }

    /** The words after "to", "as" or "=" that follow token `index`, as typed. */
    tail(index: number): string | undefined {
        const marker = this.tokens.findIndex(
            (token, at) => at >= index && token.kind === 'word' && ['to', 'as'].includes(token.word)
        );
        const from =
            marker >= 0
                ? this.tokens[marker].end
                : this.prompt.indexOf('=', this.tokens[index]?.end);

        if (from < 0) {
            return undefined;
        }
        const rest = this.prompt.slice(marker >= 0 ? from : from + 1).trim();

        return rest || undefined;
    }
}

const isNumber = (token: Token): token is Token & { kind: 'number' } => token.kind === 'number';
const isText = (token: Token): token is Token & { kind: 'text' } => token.kind === 'text';
const isColor = (token: Token): token is Token & { kind: 'color' } => token.kind === 'color';

/** Reads named colors as color tokens, so "grene" and "#30a46c" are the same kind of value. */
function readColors(request: Request) {
    request.find(COLOR_TERMS).forEach(({ id, at }) => {
        const token = request.tokens[at];

        request.tokens[at] = {
            raw: token.raw,
            start: token.start,
            end: token.end,
            kind: 'color',
            color: COLORS[id]
        };
        request.words[at] = undefined;
    });
}

/**
 * The properties a request names with their values, then what it says without naming
 * a property: a bare color, a size as 200x60, relative words and presets.
 */
function assignments(request: Request, relative: 1 | -1 | undefined): Assignment[] {
    const result: Assignment[] = [];

    // Whole words first, so "bold" is not read as a mistyped "boldness".
    request.find(PRESETS).forEach((match) => {
        const [id, value] = PRESETS.find((preset) => preset.id === match.id)!.sets;

        request.use(match);
        result.push({ candidates: [id], value });
    });
    request.find(RELATIVE).forEach((match) => {
        const { changes, scales } = RELATIVE.find((item) => item.id === match.id)!;
        const amount = request.value(isNumber, match.at + 1, request.tokens.length, match.at);

        request.use(match);
        changes.forEach(([id, sign]) =>
            result.push({
                candidates: [id],
                by: { sign, amount: amount?.value, ...(scales && !amount ? { scale: true } : {}) }
            })
        );
    });

    const found = request.find(PROPERTIES);
    const spans = [...new Map(found.map((match) => [match.at, match])).values()];

    spans.forEach((span) => request.use(span));
    spans.forEach((span, index) => {
        const candidates = PROPERTIES.filter((item) =>
            found.some((match) => match.at === span.at && match.id === item.id)
        );
        const kind = candidates[0].kind;
        const end = span.at + span.length;
        const until = spans[index + 1]?.at ?? request.tokens.length;
        const ids = candidates.map((item) => item.id);

        if (kind === 'number') {
            const token = request.value(isNumber, end, until, span.at);

            if (relative) {
                result.push({ candidates: ids, by: { sign: relative, amount: token?.value } });
            } else if (token) {
                result.push({ candidates: ids, value: token.value });
            } else {
                request.unvalued.push(candidates[0]);
            }
        } else if (kind === 'color') {
            const token = request.value(isColor, end, until, span.at);

            if (token) {
                result.push({ candidates: ids, value: token.color });
            } else {
                request.unvalued.push(candidates[0]);
            }
        } else {
            const value = request.value(isText, end, until, span.at)?.text ?? request.tail(end);

            if (value) {
                result.push({ candidates: ids, value });
            } else {
                request.unvalued.push(candidates[0]);
            }
        }
    });

    request.tokens.forEach((token) => {
        if (token.used) {
            return;
        }
        if (token.kind === 'color') {
            token.used = true;
            result.push({ candidates: ['fontColor', 'fill'], value: token.color });
        } else if (token.kind === 'size') {
            token.used = true;
            result.push({ candidates: ['width'], value: token.width });
            result.push({ candidates: ['height'], value: token.height });
        }
    });

    return result;
}

/** Applies `wanted` to one shape: the fields that change, and the properties that do not apply. */
function change(shape: ShapeFields, wanted: Assignment[]) {
    const draft = { ...shape };
    const changes: Changes = {};
    const missing: string[] = [];

    wanted.forEach(({ candidates, value, by }) => {
        const item = candidates
            .map(property)
            .find((candidate) => candidate.read(draft) !== undefined);
        const current = item?.read(draft);
        let next = value;

        if (item && by && typeof current === 'number') {
            next = by.scale
                ? current * (by.sign > 0 ? LIMITS.scale : 1 / LIMITS.scale)
                : current + by.sign * amountFor(item, by.amount);
            next = Math.round(Math.max(0, next) * 100) / 100;
        }

        const written = item && next !== undefined ? item.write(draft, next) : undefined;

        if (written) {
            Object.assign(draft, written);
            Object.assign(changes, written);
        } else if (!by?.scale) {
            // "bigger" grows whatever a shape has: a size, a radius or a font size.
            missing.push(property(candidates[0]).label);
        }
    });

    return { draft, changes, missing };
}

/** Opacity is asked for in percent and kept as a fraction. */
const amountFor = (item: Property, amount: number | undefined) =>
    amount === undefined
        ? (item.step ?? 1)
        : item.id === 'opacity' && amount > 1
          ? amount / 100
          : amount;

function changeAll(ids: string[], context: Context, wanted: Assignment[]): Reading {
    const operations: Operation[] = [];
    const notes = new Set<string>();

    ids.forEach((id) => {
        const shape = context.shapes![id];
        const { changes, missing } = change(shape, wanted);

        if (Object.keys(changes).length > 0) {
            operations.push({ op: 'updateShape', shape: id, changes });
        }
        missing.forEach((label) => notes.add(`${nameOf(shape)} has no ${label} to change.`));
    });

    return { operations, text: [...notes].slice(0, LIMITS.described).join('\n') };
}

/** The shapes a request is about: all it says, those it names, else the selection. */
function targets(request: Request, context: Context): string[] {
    const shapes = context.shapes ?? {};
    const scope = request.find(SCOPES)[0];

    if (scope) {
        const noun = request.find(SHAPES)[0];
        const type =
            noun?.id === 'square' ? 'rectangle' : noun?.id === 'circle' ? 'ellipse' : noun?.id;

        request.use(scope);
        if (noun) {
            request.use(noun);
        }

        return Object.keys(shapes).filter((id) => !type || shapes[id].type === type);
    }

    const named = Object.keys(shapes).filter((id) => {
        const name = String(shapes[id].name ?? '').toLowerCase();
        const at =
            name.length >= LIMITS.nameLength ? request.prompt.toLowerCase().indexOf(name) : -1;

        if (at < 0) {
            return false;
        }
        const covered = request.tokens.filter(
            (token) => token.start >= at && token.end <= at + name.length && token.kind !== 'text'
        );
        const whole =
            covered.length > 0 &&
            covered[0].start === at &&
            covered.at(-1)!.end === at + name.length;

        if (whole) {
            covered.forEach((token) => (token.used = true));
        }

        return whole;
    });

    return named.length > 0
        ? named
        : (context.selection ?? []).filter((id) => Object.hasOwn(shapes, id));
}

function add(request: Request, noun: Match<Kind>, context: Context): Reading {
    const kind = noun.id;
    const before = request.tokens
        .slice(0, noun.at)
        .findLast(
            (token) =>
                !token.used &&
                ((token.kind === 'number' && Number.isInteger(token.value) && token.value > 0) ||
                    (token.kind === 'word' && Object.hasOwn(COUNTS, token.word)))
        );
    const count = Math.min(
        before?.kind === 'number'
            ? before.value
            : before?.kind === 'word'
              ? COUNTS[before.word]
              : 1,
        LIMITS.added
    );

    if (before) {
        before.used = true;
    }
    request.use(noun);

    const wanted = assignments(request, undefined);
    const quoted = request.tokens.find((token) => !token.used && token.kind === 'text');
    const loose = quoted?.kind === 'text' ? quoted.text : undefined;
    const top =
        Math.max(
            LAYOUT.origin - LAYOUT.gap,
            ...Object.values(context.shapes ?? {}).map((shape) => {
                const bounds = box(shape);

                return bounds ? bounds.top + bounds.height : 0;
            })
        ) + LAYOUT.gap;
    let left = LAYOUT.origin;
    const operations: Operation[] = [];

    for (let index = 0; index < count; index++) {
        const numbered = (text: string) => (count > 1 ? `${text} ${index + 1}` : text);
        const base: ShapeFields =
            kind === 'circle' || kind === 'ellipse'
                ? {
                      type: 'ellipse',
                      position: { x: 0, y: 0 },
                      radius: NEW_SHAPE[kind],
                      fill: NEW_SHAPE.fill
                  }
                : kind === 'line'
                  ? {
                        type: 'line',
                        start: { x: 0, y: 0 },
                        end: { x: NEW_SHAPE.line, y: 0 },
                        stroke: NEW_SHAPE.stroke
                    }
                  : kind === 'text'
                    ? {
                          type: 'text',
                          position: { x: 0, y: 0 },
                          value: numbered(loose ?? 'Text'),
                          fontSize: NEW_SHAPE.fontSize
                      }
                    : {
                          type: 'rectangle',
                          position: { x: 0, y: 0 },
                          size: NEW_SHAPE[kind],
                          fill: NEW_SHAPE.fill
                      };
        const { draft } = change(
            base,
            wanted.map((assignment) =>
                assignment.candidates[0] === 'name' && typeof assignment.value === 'string'
                    ? { ...assignment, value: numbered(assignment.value) }
                    : assignment
            )
        );

        if (loose && kind !== 'text' && draft.name === undefined) {
            draft.name = numbered(loose);
        }

        const placed = box(draft)!;
        const explicit = wanted.some(
            ({ candidates }) => candidates[0] === 'x' || candidates[0] === 'y'
        );
        const shape = explicit
            ? draft
            : { ...draft, ...translate(draft, left - placed.left, top - placed.top) };

        left += placed.width + LAYOUT.gap;
        operations.push({ op: 'addShape', key: localId(), shape });
    }

    return { operations, text: '' };
}

function move(request: Request, ids: string[], context: Context): Reading | undefined {
    const directions = request.find(DIRECTIONS);

    if (directions.length === 0) {
        return undefined;
    }
    let dx = 0;
    let dy = 0;

    directions.forEach((direction) => request.use(direction));
    directions.forEach((direction, index) => {
        const until = directions[index + 1]?.at ?? request.tokens.length;
        const distance =
            request.value(isNumber, direction.at + 1, until, direction.at)?.value ?? STEPS.move;

        dx += direction.id === 'left' ? -distance : direction.id === 'right' ? distance : 0;
        dy += direction.id === 'up' ? -distance : direction.id === 'down' ? distance : 0;
    });

    return moveEach(
        ids.map((id) => ({ id, dx, dy })),
        context
    );
}

function moveEach(moves: Array<{ id: string; dx: number; dy: number }>, context: Context): Reading {
    const fixed: string[] = [];
    const operations = moves.flatMap(({ id, dx, dy }) => {
        const shape = context.shapes![id];
        const changes = dx || dy ? translate(shape, dx, dy) : {};

        if (!changes) {
            fixed.push(nameOf(shape));
        }

        return changes && Object.keys(changes).length > 0
            ? [{ op: 'updateShape', shape: id, changes }]
            : [];
    });

    return {
        operations,
        text: fixed.length > 0 ? `I can't move ${fixed.join(', ')} from here.` : ''
    };
}

type Boxed = { id: string; bounds: Box };

const boxes = (ids: string[], context: Context): Boxed[] =>
    ids.flatMap((id) => {
        const bounds = box(context.shapes![id]);

        return bounds ? [{ id, bounds }] : [];
    });

function align(request: Request, ids: string[], context: Context): Reading {
    const axis = request.find(AXES)[0]?.id;
    const found = request.find(EDGES)[0]?.id;
    const edge = found === 'center' && axis === 'vertical' ? 'middle' : found;
    const placed = boxes(ids, context);

    if (!edge) {
        return {
            operations: [],
            text: `Say which edge: ${list(EDGES.map(({ id }) => `align ${id}`))}`
        };
    }
    if (placed.length < 2) {
        return { operations: [], text: 'Select two or more shapes to align them.' };
    }

    const left = Math.min(...placed.map(({ bounds }) => bounds.left));
    const right = Math.max(...placed.map(({ bounds }) => bounds.left + bounds.width));
    const top = Math.min(...placed.map(({ bounds }) => bounds.top));
    const bottom = Math.max(...placed.map(({ bounds }) => bounds.top + bounds.height));
    const reading = moveEach(
        placed.map(({ id, bounds }) => ({
            id,
            dx:
                edge === 'left'
                    ? left - bounds.left
                    : edge === 'right'
                      ? right - bounds.left - bounds.width
                      : edge === 'center'
                        ? (left + right) / 2 - bounds.left - bounds.width / 2
                        : 0,
            dy:
                edge === 'top'
                    ? top - bounds.top
                    : edge === 'bottom'
                      ? bottom - bounds.top - bounds.height
                      : edge === 'middle'
                        ? (top + bottom) / 2 - bounds.top - bounds.height / 2
                        : 0
        })),
        context
    );

    return reading.operations.length > 0 || reading.text
        ? reading
        : { operations: [], text: `They are already aligned ${edge}.` };
}

function distribute(request: Request, ids: string[], context: Context): Reading {
    const vertical = request.find(AXES)[0]?.id === 'vertical';
    const start = (bounds: Box) => (vertical ? bounds.top : bounds.left);
    const length = (bounds: Box) => (vertical ? bounds.height : bounds.width);
    const placed = boxes(ids, context).sort((a, b) => start(a.bounds) - start(b.bounds));

    if (placed.length < 3) {
        return { operations: [], text: 'Select three or more shapes to space them equally.' };
    }

    const last = placed.at(-1)!.bounds;
    const room = start(last) + length(last) - start(placed[0].bounds);
    const gap =
        (room - placed.reduce((sum, { bounds }) => sum + length(bounds), 0)) / (placed.length - 1);
    let next = start(placed[0].bounds);
    const reading = moveEach(
        placed.map(({ id, bounds }) => {
            const delta = next - start(bounds);

            next += length(bounds) + gap;

            return { id, dx: vertical ? 0 : delta, dy: vertical ? delta : 0 };
        }),
        context
    );

    return reading.operations.length > 0 || reading.text
        ? reading
        : { operations: [], text: 'They are already spaced equally.' };
}

function duplicate(ids: string[], context: Context): Reading {
    const skipped: string[] = [];
    const operations = ids.flatMap((id) => {
        const shape = context.shapes![id];
        const moved = translate(shape, STEPS.copy, STEPS.copy);

        if (!moved || shape.type === 'image' || shape.type === 'instance') {
            skipped.push(nameOf(shape));

            return [];
        }

        return [
            {
                op: 'addShape',
                key: localId(),
                shape: { ...shape, ...moved, name: `${nameOf(shape)} copy` }
            }
        ];
    });

    return {
        operations,
        text: skipped.length > 0 ? `I can't duplicate ${skipped.join(', ')} from here.` : ''
    };
}

function describe(ids: string[], context: Context, only: Property[]): string {
    const shapes = context.shapes ?? {};

    if (ids.length === 0) {
        const types = new Map<string, number>();

        Object.values(shapes).forEach((shape) =>
            types.set(String(shape.type), (types.get(String(shape.type)) ?? 0) + 1)
        );
        if (types.size === 0) {
            return 'This document has no shapes yet. Try `add a rectangle`.';
        }

        return [
            `This document has ${plural(Object.keys(shapes).length, 'shape')}: ${[...types]
                .map(([type, count]) => plural(count, type))
                .join(', ')}.`,
            'Select some and send `props` to see what you can change.'
        ].join('\n');
    }

    return [
        ...ids.slice(0, LIMITS.described).flatMap((id) => [
            `**${nameOf(shapes[id])}** ${String(shapes[id].type)}`,
            ...PROPERTIES.flatMap((item) => {
                const asked = only.length === 0 || only.includes(item);
                const value = item.id === 'name' || !asked ? undefined : shown(item, shapes[id]);

                return value === undefined ? [] : [`- ${item.label}: ${value}`];
            })
        ]),
        // A blank line ends the last shape's list, so what follows is about all of them.
        '',
        ...(ids.length > LIMITS.described ? [`And ${ids.length - LIMITS.described} more.`] : []),
        'Change any of these by name, such as `opacity 50%` or `width 200`.'
    ].join('\n');
}

/** What to say when a request was not understood: near misses, then what is possible. */
function unsure(request: Request, ids: string[], context: Context): string {
    const vocabulary: Term[] = [
        ...INTENTS,
        ...PROPERTIES,
        ...SHAPES,
        ...COLOR_TERMS,
        ...EDGES,
        ...RELATIVE
    ];
    const command = mentions(
        request.words,
        Object.values(appCommands).map((item) => ({
            id: item.id,
            phrases: [item.name.toLowerCase()]
        }))
    )[0];
    const lines: string[] = [];

    if (command) {
        const { name, shortcut } = Object.values(appCommands).find(
            (item) => item.id === command.id
        )!;

        return [
            `“${name}” is a command of the app, not a change to the document, so there is nothing for me to propose.`,
            `Run it from the command line${shortcut ? ` or press \`${shortcut.split(',')[0]}\`` : ''}.`
        ].join('\n');
    }

    const unknown = request.tokens.flatMap((token) =>
        token.kind === 'word' && !token.used && !FILLER.has(token.word) ? [token.word] : []
    );
    const near = [...new Set(unknown.flatMap((word) => suggestions(word, vocabulary)))];

    if (request.unvalued.length > 0) {
        const examples: Record<Property['kind'], string> = {
            number: '200',
            color: 'red',
            text: '"Hello"'
        };

        return [
            `What should the ${request.unvalued.map((item) => item.label).join(' and ')} be?`,
            `Say it with a value: ${list(request.unvalued.map((item) => `${item.label} ${examples[item.kind]}`))}`
        ].join('\n');
    }
    lines.push(
        unknown.length > 0
            ? `I didn't understand ${unknown.map((word) => `“${word}”`).join(', ')}.`
            : 'I understood the words, but not what to change.'
    );
    if (near.length > 0) {
        lines.push(`Did you mean ${list(near)}?`);
    }
    if (ids.length > 0) {
        const shared = PROPERTIES.filter((item) =>
            ids.every((id) => item.read(context.shapes![id]) !== undefined)
        );

        lines.push(`For the selection you can change ${list(shared.map((item) => item.label))}`);
    }
    lines.push(HELP_HINT);

    return lines.join('\n');
}

/** What the local model makes of `prompt`, given what the chat shares with it. */
export function interpret(prompt: string, context: Context): Reading {
    const request = new Request(prompt);
    const intents = request.find(INTENTS);
    const has = (id: Intent) => intents.some((intent) => intent.id === id);
    const says = (text: string): Reading => ({ operations: [], text });

    if (request.tokens.length === 0 || prompt.trim() === '?') {
        return says(help(context));
    }
    if (intents.find(({ id }) => id === 'help')?.at === 0) {
        return says(request.find(EVERYTHING).length > 0 ? capabilities() : help(context));
    }
    const listed = readList(prompt, context.flow);
    if (listed) {
        return listed;
    }
    const linked = readLink(prompt, context.flow);
    if (linked) {
        return linked;
    }
    intents.forEach((intent) => request.use(intent));
    readColors(request);

    // "add a circle" draws one whatever is selected; "add a stroke" changes the selection.
    const adding = has('add') && request.find(SHAPES).length > 0;
    const ids = adding ? [] : targets(request, context);
    const noun = request.find(SHAPES)[0];
    const changing = intents.some(({ id }) => !['add', 'make', 'help', 'describe'].includes(id));

    // "a red circle" alone draws one too, when it is not about shapes that exist.
    if (noun && (adding || (ids.length === 0 && !changing && !has('describe')))) {
        return add(request, noun, context);
    }

    const needsTargets = (reading: () => Reading): Reading =>
        ids.length > 0 ? reading() : says(SELECT_FIRST);

    if (has('delete')) {
        return needsTargets(() => ({
            operations: [{ op: 'deleteShapes', shapes: ids }],
            text: ''
        }));
    }
    if (has('duplicate')) {
        return needsTargets(() => duplicate(ids, context));
    }
    if (has('ungroup')) {
        return needsTargets(() => {
            const groups = Object.entries(context.groups ?? {}).filter(([, group]) =>
                group.shapes.some((id) => ids.includes(id))
            );

            return groups.length > 0
                ? { operations: groups.map(([group]) => ({ op: 'deleteGroup', group })), text: '' }
                : says('None of these shapes is in a group.');
        });
    }
    if (has('group')) {
        return needsTargets(() => {
            const name = request.tokens.find(isText)?.text ?? request.tail(0) ?? 'Group';

            return ids.length > 1
                ? { operations: [{ op: 'addGroup', name, shapes: ids }], text: '' }
                : says('Select two or more shapes to group them.');
        });
    }
    if (has('align')) {
        return needsTargets(() => align(request, ids, context));
    }
    if (has('distribute')) {
        return needsTargets(() => distribute(request, ids, context));
    }
    if (has('describe') && !has('help')) {
        const asked = request.find(PROPERTIES).map(({ id }) => property(id));

        return says(describe(ids, context, asked));
    }
    if (has('move')) {
        const moved = ids.length > 0 ? move(request, ids, context) : undefined;

        if (moved) {
            return moved;
        }
    }
    if (has('rename')) {
        const name = request.tokens.find(isText)?.text ?? request.tail(0);

        if (name) {
            return needsTargets(() =>
                changeAll(ids, context, [{ candidates: ['name'], value: name }])
            );
        }
    }

    const relative = has('increase') ? 1 : has('decrease') ? -1 : undefined;
    const wanted = assignments(request, relative);
    const loose = request.tokens.find((token) => !token.used && token.kind === 'text');
    const turned = has('rotate')
        ? request.tokens.find(
              (token): token is Token & { kind: 'number' } => !token.used && token.kind === 'number'
          )
        : undefined;

    if (turned) {
        turned.used = true;
        // "rotate 45" turns further; "rotate to 45" sets the angle.
        wanted.push(
            request.words.includes('to')
                ? { candidates: ['rotation'], value: turned.value }
                : { candidates: ['rotation'], by: { sign: 1, amount: turned.value } }
        );
    }
    // Quoted words without a property are the text of text shapes.
    if (loose?.kind === 'text' && (has('set') || has('make'))) {
        loose.used = true;
        wanted.push({ candidates: ['value'], value: loose.text });
    }

    if (has('move') && wanted.length === 0) {
        // "move to 100, 200" places the selection.
        const [x, y] = request.tokens.filter((token) => !token.used && token.kind === 'number');

        if (x?.kind === 'number' && y?.kind === 'number') {
            wanted.push(
                { candidates: ['x'], value: x.value },
                { candidates: ['y'], value: y.value }
            );
        }
    }
    if (wanted.length > 0) {
        return needsTargets(() => {
            const reading = changeAll(ids, context, wanted);

            return reading.operations.length > 0 || reading.text
                ? reading
                : says('That would change nothing.');
        });
    }
    if (has('help')) {
        return says(help(context));
    }
    if (ids.length === 0 && (changing || has('move') || has('rename'))) {
        return says(SELECT_FIRST);
    }

    return says(unsure(request, ids, context));
}
