import React, { type FC, useEffect, useState } from 'react';
import type { AxisSizing, Size } from 'src/app/types';
import { useSizingTarget } from 'src/app/frameHooks';
import { useActions } from 'src/app/hooks';
import { PropertyGroup } from './PropertyGroup';
import styles from './styles.css';

const Constraint: FC<{
    label: string;
    value?: number;
    disabled: boolean;
    onCommit: (value: number | undefined) => void;
}> = ({ label, value, disabled, onCommit }) => {
    const id = `sizing-${label.toLowerCase().replaceAll(' ', '-')}`;
    const [draft, setDraft] = useState(value === undefined ? '' : String(value));
    useEffect(() => setDraft(value === undefined ? '' : String(value)), [value]);

    return (
        <tr>
            <th scope="row">
                <label htmlFor={id}>{label}</label>
            </th>
            <td>
                <input
                    id={id}
                    aria-label={label}
                    type="number"
                    min={0}
                    step="any"
                    placeholder="None"
                    disabled={disabled}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onBlur={() => {
                        if (!draft.trim()) {
                            onCommit(undefined);

                            return;
                        }
                        const number = Number(draft);
                        if (!Number.isFinite(number) || number < 0) {
                            setDraft(value === undefined ? '' : String(value));

                            return;
                        }
                        onCommit(number);
                    }}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            event.preventDefault();
                            event.currentTarget.blur();
                        }
                    }}
                />
            </td>
        </tr>
    );
};

export const SizingFields: FC<{ frameId?: string; shapeId?: string }> = ({ frameId, shapeId }) => {
    const { supported, sizing, size, disabled, problem, documentId, shownSize } = useSizingTarget(
        frameId,
        shapeId
    );
    const { editFrame, applyOperations } = useActions();

    if (!supported || !size || !shownSize) {
        return problem ? (
            <PropertyGroup name="Sizing">
                <tr>
                    <td colSpan={2}>
                        <small className={styles.frameHint} role="status">
                            {problem}
                        </small>
                    </td>
                </tr>
            </PropertyGroup>
        ) : null;
    }

    const change = (axis: keyof Size, rule: AxisSizing) => {
        const next = { ...sizing, [axis]: rule };
        const fixed = rule.mode === 'fixed' && (sizing[axis]?.mode ?? 'fixed') !== 'fixed';
        const dimensions = fixed ? { ...size, [axis]: shownSize[axis] } : undefined;
        if (frameId) {
            editFrame({
                kind: 'update',
                id: frameId,
                changes: {
                    sizing: next,
                    ...(dimensions ? { size: dimensions } : {})
                }
            });

            return;
        }
        applyOperations({
            documentId,
            by: { kind: 'person' },
            operations: [
                {
                    op: 'updateShape',
                    shape: shapeId!,
                    changes: {
                        sizing: next,
                        ...(dimensions ? { size: dimensions } : {})
                    }
                }
            ]
        });
    };

    return (
        <PropertyGroup name="Sizing">
            {(['width', 'height'] as const).map((axis) => {
                const label = axis === 'width' ? 'Width' : 'Height';
                const rule = sizing[axis] ?? { mode: 'fixed' as const };

                return (
                    <React.Fragment key={axis}>
                        <tr>
                            <th scope="row">
                                <label htmlFor={`sizing-${axis}`}>{label} sizing</label>
                            </th>
                            <td>
                                <select
                                    id={`sizing-${axis}`}
                                    aria-label={`${label} sizing`}
                                    value={rule.mode}
                                    disabled={disabled}
                                    onChange={(event) =>
                                        change(axis, {
                                            ...rule,
                                            mode: event.target.value as AxisSizing['mode']
                                        })
                                    }
                                >
                                    <option value="fixed">Fixed</option>
                                    <option value="hug">Hug contents</option>
                                    <option value="fill">Fill available</option>
                                </select>
                            </td>
                        </tr>
                        {(['min', 'max'] as const).map((bound) => (
                            <Constraint
                                key={bound}
                                label={`${bound === 'min' ? 'Min' : 'Max'} ${axis}`}
                                value={rule[bound]}
                                disabled={disabled}
                                onCommit={(value) => change(axis, { ...rule, [bound]: value })}
                            />
                        ))}
                    </React.Fragment>
                );
            })}
            {shapeId && problem && (
                <tr>
                    <td colSpan={2}>
                        <small className={styles.frameHint} role="status">
                            {problem}
                        </small>
                    </td>
                </tr>
            )}
        </PropertyGroup>
    );
};
