import React, { FC, KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import type { PropertyRow, PropertyValue } from 'src/app/properties';
import type { Variable } from 'src/app/types';
import { Slider } from '../Slider';
import { SharedOnRelease } from './SharedOnRelease';
import styles from './styles.css';

/** The picker's color for no color, or mixed colors, whose swatch is drawn struck through. */
const NO_COLOR = '#000000';

interface Props {
    row: PropertyRow;
    /** The shapes the panel shows. */
    shapeIds: string[];
    onChange: (shapeIds: string[], key: string, value: PropertyValue) => void;
    /** The variables of the property's kind, which it may use. */
    variables: Variable[];
    /** The variable every shape follows for the property. */
    variable?: Variable;
    /** What the value cannot show, under the field. */
    note?: string;
    onBind: (shapeIds: string[], key: string, variableId: string) => void;
    onUnbind: (shapeIds: string[], key: string) => void;
}

/**
 * One property as a typed field: a checkbox for booleans (indeterminate when
 * mixed), otherwise a text or number input. Typing edits a draft that is applied
 * on Enter, on blur or when the pointer is pressed elsewhere, to the shapes
 * selected when typing began; Escape discards it. The field then shows the
 * shapes' actual value again, so a rejected edit does not linger. Mixed values
 * show an empty input with a "Mixed" placeholder. A property every shape takes
 * from one variable shows the variable instead of a field, so it is changed in the
 * Variables panel, never by accident for every shape using it.
 */
export const PropertyField: FC<Props> = ({
    row,
    shapeIds,
    onChange,
    variables,
    variable,
    note,
    onBind,
    onUnbind
}) => {
    const { property, value, mixed, readOnly } = row;
    const id = `property-${property.key}`;
    const shown = mixed || value === undefined ? '' : String(value);
    const [edit, setEdit] = useState<{ text: string; shapeIds: string[] } | null>(null);
    const input = useRef<HTMLInputElement>(null);

    const apply = useCallback(() => {
        setEdit(null);

        if (!edit) {
            return;
        }

        if (property.kind !== 'number') {
            onChange(edit.shapeIds, property.key, edit.text);

            return;
        }

        const number = edit.text.trim() === '' ? NaN : Number(edit.text);

        if (!Number.isFinite(number)) {
            return;
        }

        onChange(edit.shapeIds, property.key, number);
    }, [edit, onChange, property]);

    // Apply a pending edit before a press elsewhere acts on it: selecting another
    // shape can remove this field before it would lose focus.
    useEffect(() => {
        if (!edit) {
            return;
        }

        const handlePointerDown = (event: PointerEvent) => {
            if (event.target instanceof Node && input.current?.contains(event.target)) {
                return;
            }

            apply();
        };

        document.addEventListener('pointerdown', handlePointerDown, true);

        return () => document.removeEventListener('pointerdown', handlePointerDown, true);
    }, [edit, apply]);

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        // Enter also confirms an input method composition; leave that alone.
        if (event.nativeEvent.isComposing) {
            return;
        }

        if (event.key === 'Enter') {
            apply();
        }

        if (event.key === 'Escape') {
            setEdit(null);
        }
    };

    return (
        <tr>
            <td>
                <label htmlFor={id}>{property.label}</label>
                {!variable && property.write && (
                    <select
                        className={styles.variablePicker}
                        aria-label={`Variable for ${property.label}`}
                        value=""
                        disabled={readOnly || variables.length === 0}
                        onChange={(event) => onBind(shapeIds, property.key, event.target.value)}
                    >
                        <option value="" disabled>
                            ◇
                        </option>
                        {variables.map((item) => (
                            <option key={item.id} value={item.id}>
                                {item.name}
                            </option>
                        ))}
                    </select>
                )}
            </td>
            <td>
                {variable ? (
                    <>
                        <output id={id} className={styles.bound} title={variable.name}>
                            ◆ {variable.name}
                        </output>
                        <button
                            type="button"
                            aria-label={`Stop using ${variable.name} for ${property.label}`}
                            disabled={readOnly}
                            onClick={() => onUnbind(shapeIds, property.key)}
                        >
                            ×
                        </button>
                    </>
                ) : property.kind === 'boolean' ? (
                    <input
                        id={id}
                        type="checkbox"
                        checked={value === true}
                        disabled={readOnly}
                        ref={(input) => {
                            if (input) {
                                input.indeterminate = mixed;
                            }
                        }}
                        onChange={(event) => onChange(shapeIds, property.key, event.target.checked)}
                    />
                ) : property.kind === 'color' ? (
                    <>
                        <SharedOnRelease>
                            <input
                                id={id}
                                type="color"
                                className={styles.color}
                                data-no-color={mixed || !value ? '' : undefined}
                                value={
                                    !mixed && typeof value === 'string' && value ? value : NO_COLOR
                                }
                                disabled={readOnly}
                                onChange={(event) =>
                                    onChange(shapeIds, property.key, event.target.value)
                                }
                            />
                        </SharedOnRelease>
                        {mixed && <span>Mixed</span>}
                        <button
                            type="button"
                            aria-label={`No ${property.label.toLowerCase()}`}
                            aria-pressed={!mixed && value === ''}
                            disabled={readOnly}
                            onClick={() => onChange(shapeIds, property.key, '')}
                        >
                            None
                        </button>
                    </>
                ) : (
                    <input
                        ref={input}
                        id={id}
                        type={property.kind === 'number' ? 'number' : 'text'}
                        step={property.kind === 'number' ? 'any' : undefined}
                        value={edit?.text ?? shown}
                        placeholder={mixed ? 'Mixed' : undefined}
                        readOnly={readOnly}
                        onChange={(event) =>
                            setEdit({
                                text: event.target.value,
                                shapeIds: edit?.shapeIds ?? shapeIds
                            })
                        }
                        onBlur={apply}
                        onKeyDown={handleKeyDown}
                    />
                )}
                {property.kind === 'number' && property.range && !mixed && !variable && (
                    <SharedOnRelease>
                        <Slider
                            label={property.label}
                            min={property.range.min}
                            max={property.range.max}
                            step={property.range.step}
                            value={typeof value === 'number' ? value : property.range.max}
                            disabled={readOnly}
                            onChange={(number) => onChange(shapeIds, property.key, number)}
                        />
                    </SharedOnRelease>
                )}
                {note && (
                    <small className={styles.note} role="note">
                        {note}
                    </small>
                )}
            </td>
        </tr>
    );
};
