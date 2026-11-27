import { MATCHING, similarity } from './fuzzy';
import type { Operation, Reading } from './interpret';

/** The pages, their controls and what each does, as the chat shares them. */
export interface FlowContext {
    startScreenId?: string;
    screens: Record<
        string,
        { name: string; controls: Record<string, { name: string; label?: string; does?: string }> }
    >;
}

interface Control {
    id: string;
    name: string;
    label?: string;
    screenId: string;
    screen: string;
}

const OPEN = '(?:open|opens|go to|goes to|navigate to|navigates to|link to|links to)';
const PRESS = '(?:click|clicks|tap|taps|press|presses|hit|hits|select|selects)';
const WHO = '(?:(?:i|you|we|they|someone|the user|a user|people)\\s+)?';
const ON = '(?:\\s+on\\s+(?:the\\s+)?(.+?))?';

/**
 * Each way of asking, with the place of the control, its page and the page it opens. A `loose`
 * sentence reads like other requests too ("make Title wider to fit"), so it is a link only when
 * both the control and the page fit.
 */
const SENTENCES: Array<{
    pattern: RegExp;
    control: number;
    on?: number;
    page?: number;
    loose?: boolean;
}> = [
    {
        // "open Details when I click Continue (on Home)"
        pattern: new RegExp(
            `^${OPEN}\\s+(?:the\\s+)?(.+?)\\s+(?:when|if|after|once)\\s+${WHO}${PRESS}\\s+(?:on\\s+)?(?:the\\s+)?(.+?)${ON}$`
        ),
        page: 1,
        control: 2,
        on: 3
    },
    {
        // "when I click Continue (on Home), open Details"
        pattern: new RegExp(
            `^(?:when|if|after|once)\\s+${WHO}${PRESS}\\s+(?:on\\s+)?(?:the\\s+)?(.+?)${ON},?\\s+(?:then\\s+)?${OPEN}\\s+(?:the\\s+)?(.+)$`
        ),
        control: 1,
        on: 2,
        page: 3
    },
    {
        // "link Continue to Details"
        pattern: new RegExp(
            `^(?:link|connect)\\s+(?:the\\s+)?(.+?)${ON}\\s+(?:to|${OPEN})\\s+(?:the\\s+)?(.+)$`
        ),
        control: 1,
        on: 2,
        page: 3
    },
    {
        // "make Continue open Details"
        pattern: new RegExp(
            `^(?:make|let)\\s+(?:the\\s+)?(.+?)${ON}\\s+${OPEN}\\s+(?:the\\s+)?(.+)$`
        ),
        control: 1,
        on: 2,
        page: 3,
        loose: true
    },
    {
        // "Continue opens Details"
        pattern: new RegExp(
            `^(?:the\\s+)?(.+?)${ON}\\s+(?:should\\s+)?${OPEN}\\s+(?:the\\s+)?(.+)$`
        ),
        control: 1,
        on: 2,
        page: 3,
        loose: true
    },
    {
        // "unlink Continue", "remove the link from Continue"
        pattern: new RegExp(
            `^(?:unlink|remove the (?:link|action) (?:from|on))\\s+(?:the\\s+)?(.+?)${ON}$`
        ),
        control: 1,
        on: 2
    }
];

/** "start on Login", "start the prototype at Login", "make Login the start page" */
const START = [
    /^start(?:\s+the\s+prototype)?\s+(?:on|at|from|with)\s+(?:the\s+)?(.+)$/,
    /^make\s+(?:the\s+)?(.+?)\s+the\s+(?:start|first)(?:\s+(?:page|screen))?$/
];

const normal = (text: string) =>
    text
        .toLowerCase()
        .replace(/[“”"'‘’.!?]/g, '')
        .replace(/\b(?:button|link|page|screen)s?$/, '')
        .replace(/\s+/g, ' ')
        .trim();

/** How well a typed name fits a name the document has, from 0 to 1. */
function likeness(typed: string, name: string) {
    const [a, b] = [normal(typed), normal(name)];
    if (!a || !b) {
        return 0;
    }
    if (a === b) {
        return 1;
    }
    if (b.split(' ').includes(a) || a.split(' ').includes(b)) {
        return MATCHING.abbreviation;
    }

    return similarity(a, b) >= MATCHING.similar ? similarity(a, b) : 0;
}

/** The best fits of a typed name; several only when they fit equally well. */
function best<T>(typed: string, items: T[], names: (item: T) => string[]) {
    const scored = items
        .map((item) => ({
            item,
            score: Math.max(0, ...names(item).map((name) => likeness(typed, name)))
        }))
        .filter(({ score }) => score > 0);
    const top = Math.max(0, ...scored.map(({ score }) => score));

    return scored.filter(({ score }) => score === top).map(({ item }) => item);
}

const code = (text: string) => `\`${text}\``;

/**
 * A request to change what a tap does or where the prototype starts, read from the pages the
 * chat shares; undefined when it asks for something else.
 */
export function readLink(prompt: string, flow: FlowContext | undefined): Reading | undefined {
    if (!flow) {
        return undefined;
    }
    const sentence = prompt.trim().replace(/\s+/g, ' ');
    const lower = sentence.toLowerCase().replace(/[.!]+$/, '');
    const screens = Object.entries(flow.screens).map(([id, screen]) => ({ id, ...screen }));
    const says = (text: string): Reading => ({ operations: [], text });
    const pageNamed = (typed: string) => {
        const found = best(typed, screens, (screen) => [screen.name]);

        return found.length === 1
            ? found[0]
            : says(
                  `${found.length ? `Several pages are named like` : 'No page is named like'} ${code(typed)}. Pages: ${screens.map((screen) => code(screen.name)).join(' · ')}`
              );
    };

    for (const pattern of START) {
        const match = lower.match(pattern);
        if (match) {
            const page = pageNamed(match[1]);

            return 'text' in page
                ? page
                : {
                      operations: [{ op: 'updateFrame', frame: page.id, changes: { start: true } }],
                      text: ''
                  };
        }
    }
    for (const { pattern, control: at, on, page: to, loose } of SENTENCES) {
        const match = lower.match(pattern);
        if (!match) {
            continue;
        }
        const typed = match[at];
        const where = on === undefined ? undefined : match[on];
        const within = where ? pageNamed(where) : undefined;
        if (within && 'text' in within) {
            return loose ? undefined : within;
        }
        const controls: Control[] = screens
            .filter((screen) => !within || screen.id === within.id)
            .flatMap((screen) =>
                Object.entries(screen.controls).map(([id, control]) => ({
                    id,
                    ...control,
                    screenId: screen.id,
                    screen: screen.name
                }))
            );
        const found = best(typed, controls, (control) =>
            control.label ? [control.name, control.label] : [control.name]
        );
        if (found.length === 0) {
            if (loose) {
                return undefined;
            }

            return says(
                `No control${within ? ` on ${code(within.name)}` : ''} is named like ${code(typed)}. Controls: ${controls.map((control) => code(control.name)).join(' · ') || 'none yet; add a button on the canvas first.'}`
            );
        }
        const target = to === undefined ? undefined : pageNamed(match[to]);
        if (target && 'text' in target) {
            return loose ? undefined : target;
        }
        if (found.length > 1) {
            const asked = sentence.replace(
                new RegExp(typed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
                '%'
            );

            return says(
                [
                    `Which ${code(typed)}? Pick one:`,
                    ...found.map(
                        (control) =>
                            `- ${code(asked.replace('%', `${control.name} on ${control.screen}`))}`
                    )
                ].join('\n')
            );
        }
        const operation: Operation = {
            op: 'setAction',
            control: found[0].id,
            action: target ? { type: 'navigate', screenId: target.id } : null
        };

        return { operations: [operation], text: '' };
    }

    return undefined;
}

/** A link sentence made from the pages the chat shares, for help. */
export function linkExample(flow: FlowContext | undefined): string | undefined {
    const screens = Object.values(flow?.screens ?? {});
    const from = screens.find((screen) => Object.keys(screen.controls).length > 0);
    const to = screens.find((screen) => screen !== from);
    const control = from && Object.values(from.controls)[0];

    return control && to
        ? `open ${to.name} when I click ${control.label ?? control.name}`
        : undefined;
}
