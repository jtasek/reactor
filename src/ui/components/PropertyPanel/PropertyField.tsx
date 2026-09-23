import React, { FC, KeyboardEvent } from 'react';
import type { PropertyRow, PropertyValue } from 'src/app/properties';

interface Props {
    row: PropertyRow;
    onChange: (key: string, value: PropertyValue) => void;
}

/**
 * One property as a typed field: a checkbox for booleans (indeterminate when
 * mixed), otherwise a text or number input that commits on Enter or blur and
 * reverts on Escape. Mixed values show an empty input with a "Mixed" placeholder.
 */
export const PropertyField: FC<Props> = ({ row: { property, value, mixed }, onChange }) => {
    const id = `property-${property.key}`;
    const shown = mixed || value === undefined ? '' : String(value);

    const commit = (input: HTMLInputElement) => {
        if (!property.write || input.value === shown) {
            return;
        }

        if (property.kind !== 'number') {
            onChange(property.key, input.value);

            return;
        }

        const number = input.value.trim() === '' ? NaN : Number(input.value);

        if (Number.isFinite(number)) {
            onChange(property.key, number);
        } else {
            input.value = shown;
        }
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            commit(event.currentTarget);
        }

        if (event.key === 'Escape') {
            event.currentTarget.value = shown;
            event.currentTarget.blur();
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
                        disabled={!property.write}
                        ref={(input) => {
                            if (input) {
                                input.indeterminate = mixed;
                            }
                        }}
                        onChange={(event) => onChange(property.key, event.target.checked)}
                    />
                ) : (
                    <input
                        // Remount when the value changes elsewhere, e.g. while dragging.
                        key={shown}
                        id={id}
                        type={property.kind === 'number' ? 'number' : 'text'}
                        step={property.kind === 'number' ? 'any' : undefined}
                        defaultValue={shown}
                        placeholder={mixed ? 'Mixed' : undefined}
                        readOnly={!property.write}
                        onBlur={(event) => commit(event.currentTarget)}
                        onKeyDown={handleKeyDown}
                    />
                )}
            </td>
        </tr>
    );
};
