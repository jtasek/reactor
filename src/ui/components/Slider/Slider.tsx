import React, { FC } from 'react';
import styles from './styles.css';

export interface Props {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: any) => void;
}

export const Slider: FC<Props> = ({ min, max, step, value, onChange }) => {
  const handleChange = (e) => {
    e.preventDefault();
    const newValue = parseFloat(e.target.value);
    if (value !== newValue) {
      onChange(newValue);
    }
  };

  return (
    <div className={styles.slider}>
      <input type="range" min={min} max={max} step={step} value={value} onChange={handleChange} />
      <div className={styles.track}>
        <div className={styles.lower} style={{ flex: `${value / max} 1 0%` }} />
        <div className={styles.upper} style={{ flex: `${1 - value / max} 1 0%` }} />
      </div>
    </div>
  );
};
