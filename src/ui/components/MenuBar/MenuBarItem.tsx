import React, { FC } from 'react';

interface Props {
  label: string;
  url: string;
}

export const MenuBarItem: FC<Props> = (label, url) => (
  <li>
    <a href={url}>{label}</a>
  </li>
);
