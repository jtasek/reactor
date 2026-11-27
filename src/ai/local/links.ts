import { MATCHING, similarity } from './fuzzy';
import type { Operation, Reading } from './interpret';

/** The pages, their controls and what each does, as the chat shares them. */
export interface FlowContext {
    startScreenId?: string;
    /** The page the player shows, where a control named without a page is looked for first. */
    currentScreenId?: string;
    screens: Record<
        string,
        { name: string; controls: Record<string, { name: string; label?: string; does?: string }> }
    >;
    states?: Record<string, { name: string; type: string; initial: unknown }>;
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
            `^${OPEN}\\s+(?:the\\s+)?(.+?)\\s+(?:when|if|after|once)\\s+${WHO}${PRESS}\\s+(?:on\\s+)?(?:the\\s+)?(.+?)${ON}$`,
            'i'
        ),
        page: 1,
        control: 2,
        on: 3
    },
    {
        // "when I click Continue (on Home), open Details"
        pattern: new RegExp(
            `^(?:when|if|after|once)\\s+${WHO}${PRESS}\\s+(?:on\\s+)?(?:the\\s+)?(.+?)${ON},?\\s+(?:then\\s+)?${OPEN}\\s+(?:the\\s+)?(.+)$`,
            'i'
        ),
        control: 1,
        on: 2,
        page: 3
    },
    {
        // "link Continue to Details"
        pattern: new RegExp(
            `^(?:link|connect)\\s+(?:the\\s+)?(.+?)${ON}\\s+(?:to|${OPEN})\\s+(?:the\\s+)?(.+)$`,
            'i'
        ),
        control: 1,
        on: 2,
        page: 3
    },
    {
        // "make Continue open Details"
        pattern: new RegExp(
            `^(?:make|let)\\s+(?:the\\s+)?(.+?)${ON}\\s+${OPEN}\\s+(?:the\\s+)?(.+)$`,
            'i'
        ),
        control: 1,
        on: 2,
        page: 3,
        loose: true
    },
    {
        // "Continue opens Details"
        pattern: new RegExp(
            `^(?:the\\s+)?(.+?)${ON}\\s+(?:should\\s+)?${OPEN}\\s+(?:the\\s+)?(.+)$`,
            'i'
        ),
        control: 1,
        on: 2,
        page: 3,
        loose: true
    },
    {
        // "unlink Continue", "remove the link from Continue"
        pattern: new RegExp(
            `^(?:unlink|remove the (?:link|action) (?:from|on))\\s+(?:the\\s+)?(.+?)${ON}$`,
            'i'
        ),
        control: 1,
        on: 2
    }
];

/** "start on Login", "start the prototype at Login", "make Login the start page" */
const START = [
    /^start(?:\s+the\s+prototype)?\s+(?:on|at|from|with)\s+(?:the\s+)?(.+)$/i,
    /^make\s+(?:the\s+)?(.+?)\s+the\s+(?:start|first)(?:\s+(?:page|screen))?$/i
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
    if (typed.trim().toLowerCase() === name.trim().toLowerCase()) {
        return 1;
    }
    const [a, b] = [normal(typed), normal(name)];
    if (!a || !b) {
        return 0;
    }
    if (a === b) {
        return MATCHING.sameName;
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
    const asked = sentence.replace(/[.!]+$/, '');
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
        const match = asked.match(pattern);
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
        const match = asked.match(pattern);
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
        const fits = best(typed, controls, (control) =>
            control.label ? [control.name, control.label] : [control.name]
        );
        const shown = fits.filter((control) => control.screenId === flow.currentScreenId);
        const found = !within && shown.length === 1 ? shown : fits;
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
            return says(
                [
                    `Which “${typed}”? Pick one:`,
                    ...found.map(
                        (control) =>
                            `- ${code(asked.replace(typed, where ? control.name : `${control.name} on ${control.screen}`))}`
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

/** "list actions", "show events on Home", "what states are there" */
const LIST =
    /^(?:list|show(?: me)?|what(?: are)?)\s+(?:all\s+)?(?:the\s+)?(actions?|events?|pages?|screens?|controls?|links?|states?)(?:\s+(?:are\s+there|(?:are\s+)?(?:on|for|of)\s+(?:the\s+)?(.+?)))?$/i;

/**
 * An answer in words to a request to list what the flow has: the actions a tap can take, the
 * events that start one, the pages, the controls or the states; undefined for other requests.
 */
export function readList(prompt: string, flow: FlowContext | undefined): Reading | undefined {
    const match = prompt
        .trim()
        .replace(/[.!?]+$/, '')
        .replace(/\s+/g, ' ')
        .match(LIST);
    if (!flow || !match) {
        return undefined;
    }
    const says = (lines: string[]): Reading => ({ operations: [], text: lines.join('\n') });
    const what = match[1].toLowerCase().replace(/s$/, '');
    const all = Object.entries(flow.screens).map(([id, screen]) => ({ id, ...screen }));
    // The canvas shares no pages while something is selected.
    if (all.length === 0) {
        return says(['No pages are shared. Clear the selection, or ask on Flow or Prototype.']);
    }
    const named = match[2] ? best(match[2], all, (screen) => [screen.name]) : [];
    if (match[2] && named.length !== 1) {
        return says([
            `${named.length ? 'Several pages are named like' : 'No page is named like'} ${code(match[2])}. Pages: ${all.map((screen) => code(screen.name)).join(' · ')}`
        ]);
    }
    // A page asked for, else the page the player shows, else every page.
    const screens = match[2]
        ? named
        : all.filter((screen) => screen.id === flow.currentScreenId).length
          ? all.filter((screen) => screen.id === flow.currentScreenId)
          : all;
    const controls = (now: (does: string | undefined) => string | undefined) =>
        screens.flatMap((screen) => {
            const rows = Object.values(screen.controls).flatMap((control) => {
                const shown = now(control.does);

                return shown === undefined ? [] : [`- ${control.name}: ${shown}`];
            });

            return [`**On ${screen.name}**`, ...(rows.length ? rows : ['- none'])];
        });
    const link = linkExample(flow);

    if (what === 'action') {
        return says([
            '**What a tap can do**',
            `- open a page${link ? `: \`${link}\`` : ''}`,
            '- show or hide another item on the same page',
            '- show one of an item’s variants',
            '- set, toggle or reset a state',
            '- nothing, to take an action away',
            ...controls((does) => does ?? 'does nothing yet')
        ]);
    }
    if (what === 'event') {
        return says([
            '**What starts an action**',
            '- a tap or click on a control, or Space and Enter while it has focus',
            '- Enter in a text field that has an action',
            ...controls((does) =>
                does === undefined ? 'no action' : does.startsWith('on Enter') ? 'Enter' : 'tap'
            )
        ]);
    }
    if (what === 'page' || what === 'screen') {
        return says([
            '**Pages**',
            ...all.map(
                (screen) =>
                    `- ${screen.name}${screen.id === flow.startScreenId ? ' (start)' : ''}${screen.id === flow.currentScreenId ? ' (shown now)' : ''}`
            )
        ]);
    }
    if (what === 'state') {
        const states = Object.values(flow.states ?? {});

        return says(
            states.length
                ? [
                      '**States**',
                      ...states.map(
                          (state) =>
                              `- ${state.name}: ${state.type === 'boolean' ? 'yes or no' : state.type}, starts ${JSON.stringify(state.initial ?? null)}`
                      )
                  ]
                : ['There are no states yet.']
        );
    }

    return says(controls((does) => does ?? 'does nothing yet'));
}
