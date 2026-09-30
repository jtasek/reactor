import React, { FC, ReactNode } from 'react';
interface Props {
    name: string;
    children?: ReactNode;
}

export const NavBarList: FC<Props> = ({ name, children }) => (
    <li>
        <h3>{name}</h3>
        <ul>{children}</ul>
    </li>
);
