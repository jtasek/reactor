/** Every tag color, in the order the swatches show them. */
export const TAG_TONES = [
    'red',
    'orange',
    'yellow',
    'green',
    'teal',
    'blue',
    'purple',
    'pink',
    'gray'
] as const;

export type TagTone = (typeof TAG_TONES)[number];

/**
 * The colors a tag gets from its name when none was chosen. This list keeps its
 * original order and length, so adding swatches never recolors existing tags.
 */
export const AUTOMATIC_TAG_TONES: readonly TagTone[] = [
    'red',
    'orange',
    'yellow',
    'green',
    'blue',
    'purple',
    'gray'
];

/** What each color is called in the interface. */
export const TAG_TONE_LABELS: Readonly<Record<TagTone, string>> = {
    red: 'Red',
    orange: 'Orange',
    yellow: 'Yellow',
    green: 'Green',
    teal: 'Teal',
    blue: 'Blue',
    purple: 'Lilac',
    pink: 'Magenta',
    gray: 'Gray'
};

export const isTagTone = (value: unknown): value is TagTone =>
    TAG_TONES.some((tone) => tone === value);

/** The name tags are matched by: two spellings of one tag share it. */
export const tagKey = (tag: string) => tag.trim().toLowerCase();
