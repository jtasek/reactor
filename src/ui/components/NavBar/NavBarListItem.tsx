import React, { FC } from 'react';
import styles from './styles.css';
interface Props {
    id: string;
    name: string;
    selected: boolean;
    active?: boolean;
    onClick: (id: string) => void;
}

export const NavBarListItem: FC<Props> = ({ id, name, selected, active = false, onClick }) => {
    const className = selected ? styles.selected : active ? styles.active : '';

    return (
        <li className={className}>
            <a onClick={() => onClick(id)}>{name}</a>
        </li>
    );
};
