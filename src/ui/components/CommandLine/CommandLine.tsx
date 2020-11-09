import React, { FC } from 'react';

import styles from './styles.css';

export interface Props {
  onChange: (command: string) => void;
}

export const CommandLine: FC<Props> = ({ onChange }) => (
  <div className={styles.commandLine}>
    <input type="search" placeholder="type command..." onChange={(e) => onChange(e.target.value)} />
  </div>
);
