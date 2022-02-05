import React, { FC } from 'react';
import styles from './styles.css';

interface Props {
  item: { id: string; name: string, selected: boolean };
  onClick: (id: string) => void;
}

export const NavBarListItem: FC<Props> = ({ item, onClick }) => (
  <li className={item.selected ? styles.selected : ""}>
    <a onClick={() => onClick(item.id)}>{item.name}</a>
  </li>
);
