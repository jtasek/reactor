import React, { FC, ReactNode } from 'react';

interface Props {
    name: string;
    children?: ReactNode;
}

/** A section of related properties (e.g. Shape or Text) under its own heading. */
export const PropertyGroup: FC<Props> = ({ name, children }) => (
    <tbody data-property-group={name}>
        <tr>
            <th colSpan={2} scope="colgroup">
                {name}
            </th>
        </tr>
        {children}
    </tbody>
);
