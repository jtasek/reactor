import React from 'react';

import styles from './styles.css';
import { Action } from '../../../app/types';
import { useApp } from '../../../app';

interface Props {
  action: Action;
  visible: boolean;
}

export const CommandLine = ({ visible, action }: Props) => (
  <div
    className={styles.commandline}
    style={!visible ? { display: 'none' } : { display: 'inline-block' }}
  >
    <input
      type="search"
      placeholder="type command..."
      onChange={e => action({ command: e.target.value })}
    />
  </div>
);

export const CommandLine2 = () => {
  const {
    state: { ui },
    actions
  } = useApp();

  <CommandLine visible={ui.controls.commandLine.visible} action={actions.} />
};
