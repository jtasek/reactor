import React, { FC } from 'react';
import { useActions, useAppState } from 'src/app/hooks';
import type { Smoothing } from 'src/app/smoothingSetting';
import { InspectorTable, PropertyGroup } from './PropertyGroup';
import styles from './styles.css';

const LEVELS: { level: Smoothing; label: string }[] = [
    { level: 'off', label: 'Off' },
    { level: 'low', label: 'Low' },
    { level: 'high', label: 'High' }
];

/** The Pencil's own setting, shown while the Pencil is the tool in hand. */
export const PencilSettings: FC = () => {
    const smoothing = useAppState((state) => state.tools.pencilSmoothing);
    const actions = useActions();

    return (
        <InspectorTable>
            <PropertyGroup name="Pencil">
                <tr>
                    <th scope="row" id="pencil-smoothing">
                        Smoothing
                    </th>
                    <td>
                        <div
                            role="group"
                            aria-labelledby="pencil-smoothing"
                            className={`${styles.segments} ${styles.iconSwitch}`}
                        >
                            {LEVELS.map(({ level, label }) => (
                                <button
                                    key={level}
                                    type="button"
                                    aria-pressed={smoothing === level}
                                    onClick={() => actions.tools.setPencilSmoothing(level)}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </td>
                </tr>
            </PropertyGroup>
        </InspectorTable>
    );
};
