import React, { FC, KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import { CircleMinus, CirclePlus } from 'lucide-react';
import type { PropertyRow, PropertyValue } from 'src/app/properties';
import type { Variable } from 'src/app/types';
import { Slider } from '../Slider';
import { SharedOnRelease } from './SharedOnRelease';
import { Icon } from '../Icon';
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
    unavailableVariables?: string[];
    /** The variable every shape follows for the property. */
    variable?: Variable;
    /** What the value cannot show, under the field. */
    note?: string;
    onBind: (shapeIds: string[], key: string, variableId: string) => void;
    onUnbind: (shapeIds: string[], key: string) => void;
    exposure?: { active: boolean; disabled: boolean; onToggle: () => void };
}

/**
 * One property as a typed field: a checkbox for booleans (indeterminate when
 * mixed), otherwise a text or number input. Typing edits a draft that is applied
 * on Enter, on blur or when the pointer is pressed elsewhere, to the shapes
 * selected when typing began; Escape discards it. The field then shows the
 * shapes' actual value again, so a rejected edit does not linger. Mixed values
 * show an empty input with a "Mixed" placeholder. A property every shape takes
 * from one variable shows the variable instead of a field, so it is changed in the
 * Variables panel, never by accident for every shape using it. Enter also leaves
 * the Name field.
 */
export const PropertyField: FC<Props> = ({
    row,
    shapeIds,
    onChange,
    variables,
    unavailableVariables = [],
    variable,
    note,
    onBind,
    onUnbind,
    exposure
}) => {
    const { property, value, mixed, readOnly } = row;
    const id = `property-${property.key}`;
    const shown = mixed || value === undefined ? '' : String(value);
    const variableHint =
        variables.length > 0
            ? `Use a variable for ${property.label}`
            : 'No compatible variables. Create one in the Variables panel.';
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
            if (property.key === 'name') {
                event.currentTarget.blur();
                return;
            }

            apply();
        }

        if (event.key === 'Escape') {
            setEdit(null);
        }
    };

    return (
        <tr data-property={property.key}>
            <td>
                <label htmlFor={id}>{property.label}</label>
                {exposure && (
                    <button
                        type="button"
                        className={styles.exposeButton}
                        title={
                            exposure.active
                                ? 'Use the source value in every instance'
                                : 'Let instances change this property'
                        }
                        aria-label={
                            exposure.active
                                ? `Stop exposing ${property.label}`
                                : `Expose ${property.label} to instances`
                        }
                        aria-pressed={exposure.active}
                        disabled={exposure.disabled}
                        onClick={exposure.onToggle}
                    >
                        <Icon
                            icon={{
                                component: exposure.active ? CircleMinus : CirclePlus,
                                size: 16
                            }}
                        />
                    </button>
                )}
                {!variable && property.write && (
                    <select
                        className={styles.variablePicker}
                        aria-label={`Variable for ${property.label}`}
                        title={readOnly ? 'This property is read-only' : variableHint}
                        value=""
                        disabled={readOnly || variables.length === 0}
                        onChange={(event) => onBind(shapeIds, property.key, event.target.value)}
                    >
                        <option value="" disabled>
                            ◇
                        </option>
                        {variables.map((item) => (
                            <option
                                key={item.id}
                                value={item.id}
                                disabled={unavailableVariables.includes(item.id)}
                            >
                                {item.name}
                                {unavailableVariables.includes(item.id)
                                    ? ' — modes unavailable for this property'
                                    : ''}
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
                {exposure?.active && (
                    <small className={styles.exposureStatus} role="status">
                        Editable properties
                    </small>
                )}
            </td>
        </tr>
    );
};
