import React, { FC, KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import type { PropertyRow, PropertyValue } from 'src/app/properties';

interface Props {
    row: PropertyRow;
    /** The shapes the panel shows. */
    shapeIds: string[];
    onChange: (shapeIds: string[], key: string, value: PropertyValue) => void;
}

/**
 * One property as a typed field: a checkbox for booleans (indeterminate when
 * mixed), otherwise a text or number input. Typing edits a draft that is applied
 * on Enter, on blur or when the pointer is pressed elsewhere, to the shapes
 * selected when typing began; Escape discards it. The field then shows the
 * shapes' actual value again, so a rejected edit does not linger. Mixed values
 * show an empty input with a "Mixed" placeholder.
 */
export const PropertyField: FC<Props> = ({ row, shapeIds, onChange }) => {
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
            </td>
            <td>
                {property.kind === 'boolean' ? (
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
            </td>
        </tr>
    );
};
