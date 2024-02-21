import React, { FC, ReactNode } from 'react';

interface Props {
  name:string;
  children?: ReactNode;
}
export const PropertyGroupItem: FC<Props> = ({ name, children }) => (
  <tr>
    <td>{name}</td>
    <td>
      <table>
        <tbody>{children}</tbody>
      </table>
    </td>
  </tr>
);
