import React, { FC } from 'react';

import styles from './styles.css';
import { Action } from '../../../app/types';
import { useApp } from '../../../app';
import { action } from 'overmind';

interface Props {
  action: Action<any>;
}

export const CommandLine: FC<Props> = ({ action }) => (
  <div className={styles.commandline}>
    <input type="search" placeholder="type command..." onChange={(e) => action(e.target.value)} />
  </div>
);

export default () => {
  const {
    actions: { executeCommand }
  } = useApp();

  <CommandLine action={executeCommand} />;
};
