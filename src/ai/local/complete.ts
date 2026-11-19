import { changeExamples, type Context } from './interpret';
import type { ShapeFields } from './shapes';

/** Sentences the prompt can finish, the likelier first, and how much must be typed first. */
export const COMPLETION = {
    least: 2,
    always: [
        'add a red rectangle',
        'add a circle',
        'add text "Hello"',
        'add 3 circles',
        'help',
        'help all',
        'props'
    ],
    selected: [
        'make it bigger',
        'make it smaller',
        'make it wider by 40',
        'make it taller by 40',
        'make it red',
        'make it blue',
        'move right 40',
        'move left 40',
        'move up 40',
        'move down 40',
        'duplicate',
        'delete it',
        'rename to "Card"',
        'set fill to red',
        'set stroke to blue',
        'stroke blue',
        'fill red',
        'width 200',
        'height 60',
        'taller by 40',
        'bigger',
        'smaller',
        'narrower by 40',
        'shorter by 40',
        'x 100',
        'y 100'
    ],
    several: [
        'align left',
        'align right',
        'align top',
        'align bottom',
        'align center',
        'distribute horizontally',
        'distribute vertically',
        'group',
        'ungroup'
    ]
};

/**
 * The rest of the sentence `draft` begins, for the shapes selected: nothing when no
 * sentence starts that way, or `draft` is too short to guess from.
 */
export function complete(draft: string, context: Context): string {
    const typed = draft.replace(/^\s+/, '').toLowerCase();
    const selected = (context.selection ?? [])
        .map((id) => context.shapes?.[id])
        .filter((shape): shape is ShapeFields => shape !== undefined);

    if (typed.length < COMPLETION.least || draft.includes('\n')) {
        return '';
    }
    const sentences = [
        ...(selected.length > 0
            ? [...changeExamples(selected).map(({ example }) => example), ...COMPLETION.selected]
            : []),
        ...(selected.length > 1 ? COMPLETION.several : []),
        ...COMPLETION.always
    ];
    const sentence = sentences.find(
        (candidate) => candidate.length > typed.length && candidate.toLowerCase().startsWith(typed)
    );

    return sentence ? sentence.slice(typed.length) : '';
}
