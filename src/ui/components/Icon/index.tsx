import React, { FC } from 'react';
import { Icon as IconType } from 'src/app/types';

export interface Props {
  icon?: IconType;
}

export const Icon: FC<Props> = ({ icon }) => {
  if (!icon) {
    return null;
  }

  return (
    <svg stroke={icon.color} fill={icon.color} height={icon.size} width={icon.size}>
      <use
        xlinkHref={`/icons/svg-sprite-${icon.group}-symbol.svg#ic_${icon.name}_24px`}
        fill="currentColor"
      />
    </svg>
  );
};
