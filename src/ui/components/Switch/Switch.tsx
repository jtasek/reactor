import React, { FC } from 'react';
import styles from './styles.css';

export interface Props {
  value: boolean;
  onChange: (value: boolean) => void;
}

export const Switch: FC<Props> = ({ value, onChange }) => (
  <label>
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
