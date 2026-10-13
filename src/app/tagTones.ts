export const TAG_TONES = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'gray'] as const;

export type TagTone = (typeof TAG_TONES)[number];

export const isTagTone = (value: unknown): value is TagTone =>
    TAG_TONES.some((tone) => tone === value);

/** The name tags are matched by: two spellings of one tag share it. */
export const tagKey = (tag: string) => tag.trim().toLowerCase();
