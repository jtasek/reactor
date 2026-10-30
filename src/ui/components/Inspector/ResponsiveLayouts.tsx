import React from 'react';
import { useActions, useAppState } from 'src/app/hooks';
import { screenLayouts, screenLayoutProblems } from 'src/app/screenLayouts';
import { PropertyGroup } from './PropertyGroup';
import styles from './styles.css';

export function ResponsiveLayouts({ screenId, disabled }: { screenId: string; disabled: boolean }) {
    const { rules, choices, problems } = useAppState((state) => {
        const document = state.currentDocument;

        return {
            rules: document.frames[screenId]?.responsiveLayouts ?? [],
            choices: [
                { id: screenId, name: 'Default layout' },
                ...screenLayouts(document, screenId)
            ].map(({ id, name }) => ({ id, name })),
            problems: screenLayoutProblems(document, screenId)
        };
    });
    const { editFrame } = useActions();
    const update = (responsiveLayouts: typeof rules) =>
        editFrame({
            kind: 'update',
            id: screenId,
            changes: { responsiveLayouts }
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
                <tr key={index}>
                    <th scope="row">
                        <label htmlFor={`layout-width-${index}`}>From width</label>
                        <input
                            id={`layout-width-${index}`}
                            aria-label={`Layout rule ${index + 1} minimum width`}
                            type="number"
                            min={0}
                            value={rule.minWidth}
                            disabled={disabled}
                            onChange={(event) => {
                                const minWidth = event.target.valueAsNumber;
                                if (!Number.isFinite(minWidth) || minWidth < 0) {
                                    return;
                                }
                                update(
                                    rules.map((entry, i) =>
                                        i === index ? { ...entry, minWidth } : entry
                                    )
                                );
                            }}
                        />
                    </th>
                    <td>
                        <select
                            className={styles.layoutChoice}
                            aria-label={`Layout rule ${index + 1} layout`}
                            value={rule.layoutId}
                            disabled={disabled}
                            onChange={(event) =>
                                update(
                                    rules.map((entry, i) =>
                                        i === index
                                            ? { ...entry, layoutId: event.target.value }
                                            : entry
                                    )
                                )
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
                            onClick={() => update(rules.filter((_entry, i) => i !== index))}
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
                            update([
                                ...rules,
                                {
                                    minWidth: rules.length
                                        ? Math.max(...rules.map((rule) => rule.minWidth)) + 1
                                        : 0,
                                    layoutId: screenId
                                }
                            ])
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
