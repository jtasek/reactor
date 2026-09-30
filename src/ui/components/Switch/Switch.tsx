import React, { FC } from 'react';
import styles from './styles.css';

export interface Props {
    /** What the switch turns on, read out rather than shown. */
    label: string;
    value: boolean;
    onChange: (value: boolean) => void;
}

export const Switch: FC<Props> = ({ label, value, onChange }) => (
    <label>
        <span className={styles.label}>{label}</span>
        <input
            type="checkbox"
            name="distructionfreemode"
            checked={value}
            onChange={function (e) {
                e.preventDefault();
                onChange(!value);
            }}
        />
        <div className={styles.track}>
            <div className={styles.thumb} />
        </div>
    </label>
);
