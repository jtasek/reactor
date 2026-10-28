import React, { type FC, useId } from 'react';
import { useActions, useAppState } from 'src/app/hooks';
import { FRAME_NUMBER_KEYS, acceptsFrameNumber, frameNumber } from 'src/app/frameVariables';
import { isReadOnly } from 'src/app/documentAccess';
import { isFrameLocked } from 'src/app/frameState';
import { PropertyGroup } from './PropertyGroup';
import { resolveVariable } from 'src/app/variableResolver';
import styles from './styles.css';

/** Bind authored layout inputs; view mode choices resolve their values before stack layout. */
export const FrameVariables: FC<{ id: string }> = ({ id }) => {
    const fields = useAppState((state) => {
        const document = state.currentDocument;
        const frame = document.frames[id];
        const variables = Object.values(document.variables).filter(
            (variable) => variable.type === 'number'
        );

        return {
            frame,
            variables,
            values: Object.fromEntries(
                variables.map((variable) => [
                    variable.id,
                    resolveVariable(variable, document.variables)
                ])
            ),
            disabled:
                isReadOnly(state) ||
                isFrameLocked(document, id) ||
                state.events.pointer.gesture.kind !== 'idle'
        };
    });
    const { editFrame } = useActions();
    const prefix = useId();
    const { frame, variables, disabled, values } = fields;

    // Only fields that can follow a variable, or already do so they can be cleared.
    const keys = FRAME_NUMBER_KEYS.filter(
        (key) =>
            frame?.bindings?.[key] ||
            (frame && acceptsFrameNumber(frame, key, frameNumber(frame, key) ?? NaN))
    );

    if (
        !frame ||
        frame.kind === 'view' ||
        keys.length === 0 ||
        (variables.length === 0 && Object.keys(frame.bindings ?? {}).length === 0)
    ) {
        return null;
    }

    return (
        <PropertyGroup name="Layout variables">
            {keys.map((key) => (
                <tr key={key}>
                    <th scope="row">
                        <label htmlFor={`${prefix}-${key}`}>{key}</label>
                    </th>
                    <td>
                        <select
                            id={`${prefix}-${key}`}
                            aria-label={`Variable for frame ${key}`}
                            value={frame.bindings?.[key] ?? ''}
                            disabled={disabled}
                            onChange={(event) =>
                                editFrame({
                                    kind: 'update',
                                    id,
                                    changes: {
                                        bindings: Object.fromEntries([
                                            ...Object.entries(frame.bindings ?? {}).filter(
                                                ([field]) => field !== key
                                            ),
                                            ...(event.target.value
                                                ? [[key, event.target.value]]
                                                : [])
                                        ])
                                    }
                                })
                            }
                        >
                            <option value="">No variable</option>
                            {frame.bindings?.[key] &&
                                !variables.some(
                                    (variable) => variable.id === frame.bindings?.[key]
                                ) && (
                                    <option value={frame.bindings[key]} disabled>
                                        Missing variable
                                    </option>
                                )}
                            {variables.map((variable) => (
                                <option
                                    key={variable.id}
                                    value={variable.id}
                                    disabled={
                                        !acceptsFrameNumber(frame, key, Number(values[variable.id]))
                                    }
                                >
                                    {variable.name}
                                </option>
                            ))}
                        </select>
                        <small className={styles.frameHint}>
                            Base {frameNumber(frame, key)} · mode values resolve per Screen view.
                        </small>
                    </td>
                </tr>
            ))}
        </PropertyGroup>
    );
};
