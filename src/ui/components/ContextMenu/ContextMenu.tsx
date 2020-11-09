import React, { FC } from 'react';
import { Position } from 'src/app/types';

import styles from './styles.css';
import { useState } from 'src/app/hooks';

export interface Props {
  position: Position;
}

export const ContextMenu: FC<Props> = ({ position, children }) => (
  <ul
    className={styles.contextMenu}
    style={{
      top: position.y,
      left: position.x
    }}
  >
    {children}
  </ul>
);

export const ConnectedContextMenu: FC = () => {
  const { events } = useState();

  return <ContextMenu {...events.pointer}></ContextMenu>;
};
