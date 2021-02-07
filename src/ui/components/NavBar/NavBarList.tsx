import React, { FC } from 'react';
import { NavBarListItem } from './NavBarListItem';
import styles from './styles.css';

interface Props {
  name: string;
  items?: { id: string; name: string }[];
  onClick: (id: string) => void;
}

export const NavBarList: FC<Props> = ({ name, items, onClick }) => (
  <li>
    {name}
    {items && items.length > 0 && (
      <ul>
        {items.map((item) => (
          <NavBarListItem key={item.id} item={item} onClick={onClick} />
        ))}
      </ul>
    )}
  </li>
);
