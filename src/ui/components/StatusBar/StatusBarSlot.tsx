import React, { FC } from 'react';

interface Props {
  name: string;
}

export const StatusBarSlot: FC<Props> = ({ name, children }) => <span id={name}>{children}</span>;
