import React, { FC, ReactNode } from 'react';

interface Props {
    name: string;
    value: ReactNode;
}

export const DocumentInfoField: FC<Props> = ({ name, value }) => (
    <tr>
        <td>{name}: </td>
        <td>{value}</td>
    </tr>
);
