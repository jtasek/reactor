import React, { ChangeEvent, FC, memo } from 'react';
import type { ShapeProperty, PropertyValue } from 'src/app/properties';
import { isHexColor } from 'src/app/utils';
import styles from './styles.css';

export const InstancePropertyField: FC<{
    id: string;
    label: string;
    kind: ShapeProperty['kind'];
    value: PropertyValue | undefined;
    mixed: boolean;
    onChange: (value: PropertyValue) => void;
}> = memo(({ id, label, kind, value, mixed, onChange }) => {
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
                aria-label={label}
                type="checkbox"
                checked={value === true && !mixed}
                onChange={handleChange}
            />
        );
    }
    if (kind === 'color') {
        return (
            <span className={styles.instanceColor}>
                <input
                    id={id}
                    aria-label={label}
                    type="color"
                    value={typeof value === 'string' && isHexColor(value) ? value : '#000000'}
                    onChange={handleChange}
                />
                <span>
                    {typeof value === 'string' && value ? value.slice(1).toUpperCase() : 'None'}
                </span>
                <button type="button" onClick={handleClear} aria-label={`Clear ${label}`}>
                    None
                </button>
                {mixed && <span>Mixed</span>}
            </span>
        );
    }

    return (
        <input
            id={id}
            aria-label={label}
            type={kind === 'number' ? 'number' : 'text'}
            value={mixed ? '' : String(value ?? '')}
            placeholder={mixed ? 'Mixed' : undefined}
            onChange={handleChange}
        />
    );
});

InstancePropertyField.displayName = 'InstancePropertyField';
