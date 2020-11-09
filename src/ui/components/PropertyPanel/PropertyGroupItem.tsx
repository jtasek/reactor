import React from 'react';

export const PropertyGroupItem = ({ name, children }) => (
  <tr>
    <td>{name}</td>
    <td>
      <table>
        <tbody>{children}</tbody>
      </table>
    </td>
  </tr>
);
