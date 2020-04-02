import React, {FC} from 'react';

import styles from './styles.css';
import { Action } from '../../../app/types';
import { useApp } from '../../../app';
import { executeCommand } from '../../../app/actions';

interface Props {
  action: Action;
}

export const CommandLine: FC<Props> = (action) => (
  <div
    className={styles.commandline}
  >
    <input
      type="search"
      placeholder="type command..."
      onChange={action}
    />
  </div>
);

export default () => {
  const {, {executeCommand}  } = useApp();

  <CommandLine action={executeCommand} />
};
