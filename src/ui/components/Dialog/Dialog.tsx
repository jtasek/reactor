import React, { FC } from 'react';
import styles from './styles.css';
// import { Overlay } from '../Overlay';

import { Icon } from '../Icon';

const closeIcon = { group: 'content', name: 'clear', color: 'none', size: 18 };

export const CloseButton: FC = () => <Icon {...closeIcon} />;

export interface Props {
  visible: boolean;
  stateChart: any;
}

export const Dialog: FC<Props> = ({ visible, stateChart }) => {
  if (!visible) {
    return null;
  }

  if (!stateChart) {
    throw Error('Please provide a state chart');
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'absolute' }}>
      {/* <Overlay /> */}
      <div className={styles.dialog}>
        <CloseButton />
        <h4>props.title</h4>
        <p>props.description</p>
        <form>
          <fieldset>props.children</fieldset>
        </form>
        <div className={styles.actions}>
          <button data-action="close">Close</button>
        </div>
      </div>
    </div>
  );
};
