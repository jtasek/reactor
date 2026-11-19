import React, { type FC, useEffect, useState } from 'react';
import type { Side, SpacingBox } from 'src/app/boxModel';
import type { Sides } from 'src/app/types';
import styles from './styles.css';

/** Each side's shared value, or undefined where the selection's values differ. */
export type ShownSides = { [side in Side]: number | undefined };

const AXES: { label: string; glyph: string; sides: [Side, Side] }[] = [
    { label: 'across', glyph: '↔', sides: ['left', 'right'] },
    { label: 'down', glyph: '↕', sides: ['top', 'bottom'] }
];
// Each axis opens into its own two sides, in the same place.
const EACH: { side: Side; glyph: string }[] = [
    { side: 'left', glyph: '←' },
    { side: 'right', glyph: '→' },
    { side: 'top', glyph: '↑' },
    { side: 'bottom', glyph: '↓' }
];

const SpaceInput: FC<{
    label: string;
    glyph: string;
    value: number | undefined;
    disabled: boolean;
    onCommit: (value: number) => void;
}> = ({ label, glyph, value, disabled, onCommit }) => {
    const shown = value === undefined ? '' : String(value);
    const [draft, setDraft] = useState(shown);
    useEffect(() => setDraft(shown), [shown]);
    const commit = () => {
        const number = Number(draft);

        if (draft.trim() === '' || !Number.isFinite(number) || number < 0) {
            setDraft(shown);

            return;
        }
        if (number !== value) {
            onCommit(number);
        }
    };

    return (
        <label className={styles.space} title={label}>
            <span aria-hidden="true">{glyph}</span>
            <input
                aria-label={label}
                type="number"
                min={0}
                step="any"
                placeholder={value === undefined ? 'Mixed' : undefined}
                disabled={disabled}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={commit}
                onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                        event.preventDefault();
                        event.currentTarget.blur();
                    }
                    if (event.key === 'Escape') {
                        setDraft(shown);
                    }
                }}
            />
        </label>
    );
};

const symmetric = (value: ShownSides) =>
    value.left === value.right &&
    value.top === value.bottom &&
    value.left !== undefined &&
    value.top !== undefined;

/**
 * Margin or padding as one value across and one down, which the "each side"
 * button splits into four; spacing that differs side to side shows four. Give it
 * a `key` for what it edits, so another selection starts as its own sides say.
 */
export const SpacingRow: FC<{
    box: SpacingBox;
    /** What the spacing does, shown over its name. */
    hint?: string;
    value: ShownSides;
    disabled: boolean;
    /** Names the row with a row heading, as the frame's own fields do. */
    rowHeader?: boolean;
    onChange: (changes: Partial<Sides>) => void;
}> = ({ box, hint, value, disabled, rowHeader, onChange }) => {
    // Four fields stay while a side is being typed, even once the sides match again.
    const [split, setSplit] = useState(() => !symmetric(value));
    const label = box === 'margin' ? 'Margin' : 'Padding';
    const each = split || !symmetric(value);
    const Name = rowHeader ? 'th' : 'td';

    return (
        <tr data-spacing={box}>
            <Name {...(rowHeader ? { scope: 'row' } : {})}>
                <span className={styles.spacingLabel} data-box={box} title={hint}>
                    {label}
                </span>
                <button
                    type="button"
                    className={styles.eachSide}
                    aria-label={`${label} on each side`}
                    title={each ? 'Edit across and down' : 'Edit each side'}
                    aria-pressed={each}
                    disabled={disabled || (each && !symmetric(value))}
                    onClick={() => setSplit(!each)}
                >
                    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                        <path d="M4 2.5h8M4 13.5h8M2.5 4v8M13.5 4v8" />
                    </svg>
                </button>
            </Name>
            <td>
                <div className={styles.spacing}>
                    {each
                        ? EACH.map(({ side, glyph }) => (
                              <SpaceInput
                                  key={side}
                                  label={`${label} ${side}`}
                                  glyph={glyph}
                                  value={value[side]}
                                  disabled={disabled}
                                  onCommit={(number) => onChange({ [side]: number })}
                              />
                          ))
                        : AXES.map(({ label: axis, glyph, sides }) => (
                              <SpaceInput
                                  key={axis}
                                  label={`${label} ${axis}`}
                                  glyph={glyph}
                                  value={value[sides[0]]}
                                  disabled={disabled}
                                  onCommit={(number) =>
                                      onChange({ [sides[0]]: number, [sides[1]]: number })
                                  }
                              />
                          ))}
                </div>
            </td>
        </tr>
    );
};

/** What `sides` of each of a selection show: a side's value where they all agree. */
export function shownSides(list: Sides[]): ShownSides {
    const pick = (side: Side) =>
        list.every((sides) => sides[side] === list[0]?.[side]) ? list[0]?.[side] : undefined;

    return { top: pick('top'), right: pick('right'), bottom: pick('bottom'), left: pick('left') };
}
