import React, { type FC, useId } from 'react';
import { useActions } from 'src/app/hooks';
import { useModeFields } from 'src/app/modeHooks';
import type { ModeTarget } from 'src/app/modeEdits';
import { PropertyGroup } from './PropertyGroup';
import styles from './styles.css';

export const ModeFields: FC<{ target: ModeTarget }> = ({ target }) => {
    const { dimensions, problems, disabled } = useModeFields(target);
    const { setModeOverride } = useActions();
    const id = useId();

    if (dimensions.length === 0) {
        return null;
    }

    return (
        <PropertyGroup name="Modes">
            {dimensions.map((dimension) => (
                <tr key={dimension.id}>
                    <th scope="row">
                        <label htmlFor={`${id}-${dimension.id}`}>{dimension.name}</label>
                    </th>
                    <td>
                        <select
                            id={`${id}-${dimension.id}`}
                            aria-label={`${dimension.name} mode`}
                            value={dimension.chosen}
                            disabled={disabled}
                            onChange={(event) =>
                                setModeOverride({
                                    target,
                                    dimensionId: dimension.id,
                                    modeId: event.target.value || null
                                })
                            }
                        >
                            <option value="">Inherit</option>
                            {dimension.chosen &&
                                !dimension.modes.some((mode) => mode.id === dimension.chosen) && (
                                    <option value={dimension.chosen} disabled>
                                        Missing mode {dimension.chosen}
                                    </option>
                                )}
                            {dimension.modes.map((mode) => (
                                <option value={mode.id} key={mode.id}>
                                    {mode.name}
                                </option>
                            ))}
                        </select>
                        <small className={styles.frameHint}>
                            {dimension.effective} · {dimension.source}
                        </small>
                    </td>
                </tr>
            ))}
            {problems.map((problem) => (
                <tr key={problem}>
                    <td colSpan={2}>
                        <small className={styles.frameHint} role="status">
                            {problem}
                        </small>
                    </td>
                </tr>
            ))}
        </PropertyGroup>
    );
};
