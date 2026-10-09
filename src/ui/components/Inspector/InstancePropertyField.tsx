import React, { ChangeEvent, FC, memo } from 'react';
import type { ShapeProperty, PropertyValue } from 'src/app/properties';
import { isHexColor } from 'src/app/utils';

export const InstancePropertyField: FC<{
    id: string;
    kind: ShapeProperty['kind'];
    value: PropertyValue | undefined;
    mixed: boolean;
    onChange: (value: PropertyValue) => void;
}> = memo(({ id, kind, value, mixed, onChange }) => {
    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        if (kind === 'boolean') {
            onChange(event.target.checked);

            return;
        }
        if (kind === 'number') {
            onChange(Number(event.target.value));

            return;
        }
        onChange(event.target.value);
    };
    const handleClear = () => onChange('');

    if (kind === 'boolean') {
        return (
            <input
                id={id}
                type="checkbox"
                checked={value === true && !mixed}
                onChange={handleChange}
            />
        );
    }
    if (kind === 'color') {
        return (
            <>
                <input
                    id={id}
                    type="color"
                    value={typeof value === 'string' && isHexColor(value) ? value : '#000000'}
                    onChange={handleChange}
                />
                <button type="button" onClick={handleClear}>
                    None
                </button>
                {mixed && <span>Mixed</span>}
            </>
        );
    }

    return (
        <input
            id={id}
            type={kind === 'number' ? 'number' : 'text'}
            value={mixed ? '' : String(value ?? '')}
            placeholder={mixed ? 'Mixed' : undefined}
            onChange={handleChange}
        />
    );
});

InstancePropertyField.displayName = 'InstancePropertyField';
