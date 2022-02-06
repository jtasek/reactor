import React, { FC } from 'react';
import styles from './styles.css';
interface Props {
  name: string;
}

export const NavBarList: FC<Props> = ({ name, children }) => (
  <li>
    <h3>{name}</h3>
    <ul>{children}</ul>
  </li>
);
