import type { PreviewDrawing, PreviewNode, PreviewStateValue } from '../shared/previewProtocol';
import { evaluateCondition } from '../shared/conditions';
import { TEXT_ASCENT_RATIO, TEXT_CHAR_WIDTH_RATIO } from '../shared/textMetrics';
import { DEFAULT_ACCESSIBILITY_RULES, type AccessibilityRules } from './accessibilityRules';

type Screen = PreviewDrawing['screens'][number];
type Control = NonNullable<PreviewNode['control']>;
interface Box {
    x: number;
    y: number;
    width: number;
    height: number;
}
type Rgb = [number, number, number];

/** What a person using assistive technology meets: a control's role and name. */
export interface AuditName {
    key: string;
    role: Control['role'];
    name: string;
}

export interface AuditContrast {
    /** The text line's node key. */
    key: string;
    text: string;
    /** The text's own color, before opacity. */
    color: string;
    /** What it is read against, with what is drawn below composited. */
    background: string;
    /** The text's opacity, multiplied through its groups. */
    opacity: number;
    ratio: number;
    required: number;
    /** Set when the text is checked in a variant or a hidden state rather than at start. */
    when?: AuditWhen;
}

export type AuditWhen = { variant: string } | { shown: true };

export type AuditProblem =
    | ({ kind: 'contrast' } & AuditContrast)
    | {
          kind: 'name';
          key: string;
          role: Control['role'];
          name: string;
          /** The text drawn on the control, which its name should include. */
          visible: string;
          when?: AuditWhen;
      }
    | { kind: 'focusOrder'; key: string; name: string; after: string; afterKey: string };

export interface AuditReport {
    /** Every control's name, in focus order for the focusable ones. */
    names: AuditName[];
    /** Names of the controls Tab reaches, in the order it reaches them. */
    focusOrder: string[];
    contrast: AuditContrast[];
    problems: AuditProblem[];
}

/**
 * Chooses what the audit reads for a node: its variant, record or nothing when hidden.
 * Without one, every screen is read as it starts, and variants and hidden instances are
 * checked as well, each against what is drawn below it.
 */
export type AuditPick = (node: PreviewNode) => PreviewNode | undefined;

const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];

export function readHex(color: string): Rgb | undefined {
    const match = /^#([0-9a-f]{6})$/i.exec(color);

    return match
        ? ([0, 2, 4].map((index) => parseInt(match[1].slice(index, index + 2), 16)) as Rgb)
        : undefined;
}

export const hex = (rgb: Rgb) =>
    `#${rgb.map((value) => Math.round(value).toString(16).padStart(2, '0')).join('')}`;

const channel = (value: number) => {
    const c = value / 255;

    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]: Rgb) =>
    0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

/** WCAG contrast ratio of two opaque colors. */
export function contrastRatio(a: Rgb, b: Rgb) {
    const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);

    return (light + 0.05) / (dark + 0.05);
}

const blend = (top: Rgb, bottom: Rgb, alpha: number): Rgb =>
    top.map((value, index) => value * alpha + bottom[index] * (1 - alpha)) as Rgb;

/** The contrast text of this size and weight needs. */
export function requiredContrast(
    size: number,
    weight: number,
    rules: AccessibilityRules = DEFAULT_ACCESSIBILITY_RULES
) {
    return size >= rules.largeTextSize || (weight >= 700 && size >= rules.largeBoldTextSize)
        ? rules.largeTextContrast
        : rules.textContrast;
}

const number = (value: string | number | undefined, fallback: number) =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/** The offset a group's translate moves its drawing by; rotation is left out. */
function translation(transform: string | number | undefined) {
    const match =
        typeof transform === 'string'
            ? /translate\(\s*([-+\d.eE]+)[\s,]+([-+\d.eE]+)\s*\)/.exec(transform)
            : null;

    return match ? { x: Number(match[1]), y: Number(match[2]) } : { x: 0, y: 0 };
}

interface Paint {
    contains: (x: number, y: number) => boolean;
    /** Undefined for images, whose colors the audit can't know. */
    color?: Rgb;
    alpha: number;
}

function paintOf(node: PreviewNode, dx: number, dy: number, alpha: number): Paint | undefined {
    const { attrs } = node;
    if (node.tag === 'image') {
        const box = boxOf(attrs, dx, dy);

        return { contains: inside(box), alpha };
    }
    const color = typeof attrs.fill === 'string' ? readHex(attrs.fill) : undefined;
    if (!color) {
        return undefined;
    }
    if (node.tag === 'rect') {
        return { contains: inside(boxOf(attrs, dx, dy)), color, alpha };
    }
    if (node.tag === 'ellipse') {
        const cx = number(attrs.cx, 0) + dx;
        const cy = number(attrs.cy, 0) + dy;
        const rx = number(attrs.rx, 0);
        const ry = number(attrs.ry, 0);

        return {
            contains: (x, y) =>
                rx > 0 && ry > 0 && ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1,
            color,
            alpha
        };
    }

    return undefined;
}

const boxOf = (attrs: PreviewNode['attrs'], dx: number, dy: number): Box => ({
    x: number(attrs.x, 0) + dx,
    y: number(attrs.y, 0) + dy,
    width: number(attrs.width, 0),
    height: number(attrs.height, 0)
});
const inside = (box: Box) => (x: number, y: number) =>
    x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height;

/** What is drawn at a point, composited over the page; undefined over an image. */
function backdrop(paints: readonly Paint[], x: number, y: number): Rgb | undefined {
    let color: Rgb | undefined = WHITE;
    for (const paint of paints) {
        if (!paint.contains(x, y)) {
            continue;
        }
        // An image's colors are unknown until something opaque covers it.
        color =
            paint.color && (color || paint.alpha >= 1)
                ? blend(paint.color, color ?? WHITE, paint.alpha)
                : undefined;
    }

    return color;
}

const words = (text: string) => text.replace(/\s+/g, ' ').trim();

/** Texts a node draws, in drawing order, as the start state shows them. */
function visibleText(node: PreviewNode, pick: AuditPick): string {
    const shown = pick(node);
    if (!shown) {
        return '';
    }

    return words(
        [
            shown.tag === 'text' ? (shown.text ?? '') : '',
            ...(shown.children ?? []).map((child) => visibleText(child, pick))
        ].join(' ')
    );
}

/** What a screen shows as it opens: initial variants, and visibility as the start states decide it. */
const startPick =
    (states: Readonly<Record<string, PreviewStateValue>>): AuditPick =>
    (node) => {
        const visibility = node.visibility;
        const shown = visibility?.condition
            ? evaluateCondition(visibility.condition, (operand) =>
                  operand.kind === 'state' ? states[operand.stateId] : undefined
              )
            : (visibility?.initial ?? true);
        if (!shown) {
            return undefined;
        }
        const variant = node.initialVariant ? node.variants?.[node.initialVariant] : undefined;

        return variant ?? node;
    };

/**
 * Checks one screen as the player draws it: the contrast of each text line against what
 * is drawn below it, the names of controls, and whether Tab follows the reading order.
 * Positions come from the drawing, so text is placed by an estimate of its width.
 */
export function auditScreen(
    screen: Pick<Screen, 'nodes'>,
    rules: AccessibilityRules = DEFAULT_ACCESSIBILITY_RULES,
    livePick?: AuditPick,
    /** Start values of named states, which decide what shows at start without `livePick`. */
    states: Readonly<Record<string, PreviewStateValue>> = {}
): AuditReport {
    const atStart = startPick(states);
    const pick = livePick ?? atStart;
    const names: AuditName[] = [];
    const contrast: AuditContrast[] = [];
    const problems: AuditProblem[] = [];
    const focusable: { key: string; name: string; box: Box }[] = [];

    interface Walk {
        dx: number;
        dy: number;
        alpha: number;
        paints: Paint[];
        /** Text under a disabled control or a native field is not the author's to check. */
        exempt: boolean;
        when?: AuditWhen;
        /** Alternatives are checked for contrast and names only; Tab order reads the start. */
        alternative: boolean;
    }

    const visit = (authored: PreviewNode, walk: Walk) => {
        if (!livePick) {
            // Checked once shown, against what is drawn below it now; its variants follow.
            if (authored.visibility && !atStart(authored)) {
                visit(
                    { ...authored, visibility: undefined },
                    {
                        ...walk,
                        paints: [...walk.paints],
                        when: walk.when ?? { shown: true },
                        alternative: true
                    }
                );

                return;
            }
            if (authored.variants && authored.initialVariant) {
                Object.entries(authored.variants).forEach(([id, variant]) => {
                    if (id !== authored.initialVariant) {
                        visit(
                            { ...variant, variants: undefined, visibility: undefined },
                            {
                                ...walk,
                                paints: [...walk.paints],
                                when: walk.when ?? { variant: id },
                                alternative: true
                            }
                        );
                    }
                });
            }
        }
        const node = pick(authored);
        if (!node) {
            return;
        }
        const offset = translation(node.attrs.transform);
        const dx = walk.dx + offset.x;
        const dy = walk.dy + offset.y;
        const alpha = walk.alpha * number(node.attrs.opacity, 1);
        const control = node.control;
        const isField = control?.role === 'input' || control?.role === 'button';
        if (node.tag === 'text' && !walk.exempt && node.text?.trim()) {
            checkText(node, { ...walk, dx, dy, alpha });
        }
        if (node.tag !== 'g' && node.tag !== 'text') {
            const paint = paintOf(node, dx, dy, alpha);
            if (paint) {
                walk.paints.push(paint);
            }
        }
        node.children?.forEach((child) =>
            visit(child, {
                ...walk,
                dx,
                dy,
                alpha,
                exempt:
                    walk.exempt || (isField && (control?.role === 'input' || !!control?.disabled))
            })
        );
        if (!control || (control.role === 'image' && control.label === '')) {
            return;
        }
        if (control.role === 'text') {
            return;
        }
        const name = words(control.label);
        if (!walk.alternative) {
            names.push({ key: node.key, role: control.role, name });
        }
        if (!isField) {
            return;
        }
        const visible =
            control.role === 'button' ? visibleText({ ...node, control: undefined }, pick) : '';
        if (!name || (visible && !name.toLowerCase().includes(visible.toLowerCase()))) {
            problems.push({
                kind: 'name',
                key: node.key,
                role: control.role,
                name,
                visible,
                ...(walk.when ? { when: walk.when } : {})
            });
        }
        if (!walk.alternative && !control.disabled) {
            focusable.push({
                key: node.key,
                name,
                box: {
                    x: control.x + dx,
                    y: control.y + dy,
                    width: control.width,
                    height: control.height
                }
            });
        }
    };

    const checkText = (node: PreviewNode, walk: Walk) => {
        const size = number(node.attrs['font-size'], 16);
        const weight = number(node.attrs['font-weight'], 400);
        const own = (typeof node.attrs.fill === 'string' && readHex(node.attrs.fill)) || BLACK;
        const x = number(node.attrs.x, 0) + walk.dx;
        const baseline = number(node.attrs.y, 0) + walk.dy;
        const width = node.text!.length * size * TEXT_CHAR_WIDTH_RATIO;
        const middle = baseline - size * (TEXT_ASCENT_RATIO - 0.5);
        const behind = [0.1, 0.5, 0.9].map((share) =>
            backdrop(walk.paints, x + width * share, middle)
        );
        if (behind.some((color) => !color)) {
            return;
        }
        const required = requiredContrast(size, weight, rules);
        const [ratio, background] = behind
            .map(
                (color) => [contrastRatio(blend(own, color!, walk.alpha), color!), color!] as const
            )
            .sort((a, b) => a[0] - b[0])[0];
        const result: AuditContrast = {
            key: node.key,
            text: node.text!,
            color: hex(own),
            background: hex(background),
            opacity: walk.alpha,
            // Never rounded up: 4.499 fails 4.5 and must not read as 4.5.
            ratio: Math.floor(ratio * 100) / 100,
            required,
            ...(walk.when ? { when: walk.when } : {})
        };
        contrast.push(result);
        if (ratio < required) {
            problems.push({ kind: 'contrast', ...result });
        }
    };

    const paints: Paint[] = [];
    screen.nodes.forEach((node) =>
        visit(node, { dx: 0, dy: 0, alpha: 1, paints, exempt: false, alternative: false })
    );

    focusable.forEach((item, index) => {
        const previous = focusable[index - 1];
        if (previous && readsBefore(item.box, previous.box)) {
            problems.push({
                kind: 'focusOrder',
                key: item.key,
                name: item.name,
                after: previous.name,
                afterKey: previous.key
            });
        }
    });
    const focusKeys = new Map(focusable.map(({ key }, index) => [key, index]));

    return {
        names: names.sort(
            (a, b) => (focusKeys.get(a.key) ?? Infinity) - (focusKeys.get(b.key) ?? Infinity)
        ),
        focusOrder: focusable.map(({ name }) => name),
        contrast,
        problems
    };
}

/** Whether `a` comes before `b` when reading rows top to bottom, each left to right. */
function readsBefore(a: Box, b: Box) {
    const overlap = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
    const sameRow = overlap > Math.min(a.height, b.height) / 2;

    return sameRow ? a.x + a.width <= b.x : a.y + a.height <= b.y;
}

/** A color like `color` in hue that reaches `ratio` against each background, closest first. */
export function adjustedColor(
    color: string,
    targets: readonly { background: string; required: number; opacity: number }[]
): string | undefined {
    const own = readHex(color);
    const backgrounds = targets.map(({ background }) => readHex(background));
    if (!own || backgrounds.some((background) => !background)) {
        return undefined;
    }
    const passes = (candidate: Rgb) =>
        targets.every(
            ({ required, opacity }, index) =>
                contrastRatio(
                    blend(candidate, backgrounds[index]!, opacity),
                    backgrounds[index]!
                ) >= required
        );
    for (let step = 1; step <= 100; step++) {
        const share = step / 100;
        const candidates = [blend(BLACK, own, share), blend(WHITE, own, share)].map(
            (rgb) => rgb.map(Math.round) as Rgb
        );
        const found = candidates.find(passes);
        if (found) {
            return hex(found);
        }
    }

    return undefined;
}
