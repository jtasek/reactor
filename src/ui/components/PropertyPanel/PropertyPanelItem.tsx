import React from 'react';

export const PropertyPanelItem = ({ name, value }) => (
  <tr>
    <td>{name}: </td>
    <td>{value}</td>
  </tr>
);
