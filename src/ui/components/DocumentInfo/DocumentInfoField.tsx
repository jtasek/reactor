import React, { FC } from 'react';

interface Props {
  name: string;
  value: any;
}

export const DocumentInfoField: FC<Props> = ({ name, value }) => (
  <tr>
    <td>{name}: </td>
    <td>{value}</td>
  </tr>
);
