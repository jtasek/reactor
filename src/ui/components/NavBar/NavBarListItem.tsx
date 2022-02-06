import React, { FC } from 'react';
import styles from './styles.css';
interface Props {
  id: string;
  name: string;
  selected: boolean;
  onClick: (id: string) => void;
}

export const NavBarListItem: FC<Props> = ({ id, name, selected, onClick }) => (
  <li className={selected ? styles.selected : ''}>
    <a onClick={() => onClick(id)}>{name}</a>
  </li>
);
