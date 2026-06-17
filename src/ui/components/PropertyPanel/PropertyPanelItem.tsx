import React from 'react';

export const PropertyPanelItem = ({ name, value }: { name: string; value?: string }) => (
    <tr>
        <td>{name}: </td>
        <td>{value}</td>
    </tr>
);
