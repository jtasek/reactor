import React, { FC } from 'react';
import { HashTable } from 'src/app/types';
import { NavBarListItem } from './NavBarListItem';
import styles from './styles.css';

interface Props {
  name: string;
  items?: HashTable<any>;
  onClick: (id: string) => void;
}

export const NavBarList: FC<Props> = ({ name, items, onClick }) => (
  <li>
    {name}
    {items && items.length === 0 && (
      <ul>
        {items.map((item) => (
          <NavBarListItem key={item.id} item={item} onClick={onClick} />
        ))}
      </ul>
    )}
  </li>
);
