import React, { useEffect, useState } from 'react';
import { useActions, useAppState, useEffects } from 'src/app/hooks';
import { screenLayouts, screenLayoutProblems, screenLayoutRules } from 'src/app/screenLayouts';
import type { ResponsiveLayoutRule } from 'src/app/types';
import { PropertyGroup } from './PropertyGroup';
import styles from './styles.css';

/** Saves a rule's width once, on Enter or leaving the field, not per keystroke. */
function RuleWidth({
    index,
    value,
    disabled,
    onCommit
}: {
    index: number;
    value: number;
    disabled: boolean;
    onCommit: (minWidth: number) => void;
}) {
    const [draft, setDraft] = useState(String(value));
    useEffect(() => setDraft(String(value)), [value]);

    return (
        <input
            id={`layout-width-${index}`}
            aria-label={`Layout rule ${index + 1} minimum width`}
            type="number"
            min={0}
            value={draft}
            disabled={disabled}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => {
                const minWidth = Number(draft);
                if (!draft.trim() || !Number.isFinite(minWidth) || minWidth < 0) {
                    setDraft(String(value));

                    return;
                }
                if (minWidth !== value) {
                    onCommit(minWidth);
                }
            }}
            onKeyDown={(event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    event.currentTarget.blur();
                }
            }}
        />
    );
}

export function ResponsiveLayouts({ screenId, disabled }: { screenId: string; disabled: boolean }) {
    const { rules, choices, problems } = useAppState((state) => {
        const document = state.currentDocument;

        return {
            rules: screenLayoutRules(document, screenId),
            choices: [
                { id: screenId, name: 'Default layout' },
                ...screenLayouts(document, screenId)
            ].map(({ id, name }) => ({ id, name })),
            problems: screenLayoutProblems(document, screenId)
        };
    });
    const { editFrame } = useActions();
    const { newId } = useEffects();
    // Rules are keyed by ID, so this copy's edit touches only the rule it changes.
    const update = (id: string, rule: ResponsiveLayoutRule | undefined) =>
        editFrame({
            kind: 'update',
            id: screenId,
            changes: {
                responsiveLayouts: Object.fromEntries([
                    ...rules
                        .filter((entry) => entry.id !== id)
                        .map(({ id: key, minWidth, layoutId }) => [key, { minWidth, layoutId }]),
                    ...(rule ? [[id, rule]] : [])
                ])
            }
        });

    return (
        <PropertyGroup name="Automatic layouts">
            <tr>
                <td colSpan={2}>
                    <small className={styles.frameHint}>
                        Shared by this screen’s Auto views. The greatest minimum width wins; below
                        all rules, use Default. Manual choices stay unchanged.
                    </small>
                </td>
            </tr>
            {rules.map((rule, index) => (
                <tr key={rule.id}>
                    <th scope="row">
                        <label htmlFor={`layout-width-${index}`}>From width</label>
                        <RuleWidth
                            index={index}
                            value={rule.minWidth}
                            disabled={disabled}
                            onCommit={(minWidth) =>
                                update(rule.id, { minWidth, layoutId: rule.layoutId })
                            }
                        />
                    </th>
                    <td>
                        <select
                            className={styles.layoutChoice}
                            aria-label={`Layout rule ${index + 1} layout`}
                            value={rule.layoutId}
                            disabled={disabled}
                            onChange={(event) =>
                                update(rule.id, {
                                    minWidth: rule.minWidth,
                                    layoutId: event.target.value
                                })
                            }
                        >
                            {!choices.some(({ id }) => id === rule.layoutId) && (
                                <option value={rule.layoutId}>Missing layout</option>
                            )}
                            {choices.map(({ id, name }) => (
                                <option key={id} value={id}>
                                    {name}
                                </option>
                            ))}
                        </select>
                        <button
                            type="button"
                            disabled={disabled}
                            aria-label={`Remove layout rule ${index + 1}`}
                            onClick={() => update(rule.id, undefined)}
                        >
                            Remove rule
                        </button>
                    </td>
                </tr>
            ))}
            <tr>
                <td colSpan={2}>
                    <button
                        type="button"
                        disabled={disabled}
                        onClick={() =>
                            update(newId(), {
                                minWidth: rules.length
                                    ? Math.max(...rules.map((rule) => rule.minWidth)) + 1
                                    : 0,
                                layoutId: screenId
                            })
                        }
                    >
                        Add width rule
                    </button>
                </td>
            </tr>
            {problems.map((problem) => (
                <tr key={problem}>
                    <td colSpan={2}>
                        <small role="status" className={styles.frameHint}>
                            {problem}
                        </small>
                    </td>
                </tr>
            ))}
        </PropertyGroup>
    );
}
