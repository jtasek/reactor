import React, { FC } from 'react';
import styles from './styles.css';

export interface Props {
    min: number;
    max: number;
    step: number;
    value: number;
    onChange: (value: number) => void;
    /** Its accessible name, where no label element names it. */
    label?: string;
    disabled?: boolean;
}

export const Slider: FC<Props> = ({ min, max, step, value, onChange, label, disabled }) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        const newValue = parseFloat(e.target.value);
        if (value !== newValue) {
            onChange(newValue);
        }
    };

    return (
        <div className={styles.slider}>
            <input
                type="range"
                aria-label={label}
                disabled={disabled}
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={handleChange}
            />
            <div className={styles.track}>
                <div className={styles.lower} style={{ flex: `${value / max} 1 0%` }} />
                <div className={styles.upper} style={{ flex: `${1 - value / max} 1 0%` }} />
            </div>
        </div>
    );
};
