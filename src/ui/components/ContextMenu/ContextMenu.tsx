import React, { FC } from 'react';
import { Position } from 'src/app/types';

import styles from './styles.css';
import { usePointer } from 'src/app/hooks';
import { ConnectedContextMenuItems } from './ContextMenuItems';

export interface Props {
  position: Position;
}

export const ContextMenu: FC<Props> = ({ position, children }) => (
  <ul
    className={styles.contextMenu}
    style={{
      position: 'absolute',
      top: position.y,
      left: position.x
    }}
  >
    {children}
  </ul>
);

export const ConnectedContextMenu: FC = () => {
  const { position } = usePointer();

  return (
    <ContextMenu position={position}>
      <ConnectedContextMenuItems />
    </ContextMenu>
  );
};
