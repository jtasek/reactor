import React, { FC } from 'react';
import { getPropValue } from '../../../app/utils';
import { PropertyGroupItem } from './PropertyGroupItem';
import { PropertyPanelItem } from './PropertyPanelItem';

interface Props {
  items: [string, any][];
}

export const PropertyList: FC<Props> = ({ items }) => {
  return items.map(([name, value]) => {
    if (typeof value === 'object') {
      return (
        <PropertyGroupItem key={`${name}-group`} name={name}>
          <PropertyList key={name} items={Object.entries(value)} />
        </PropertyGroupItem>
      );
    }
    return <PropertyPanelItem key={name} name={name} value={getPropValue(value)} />;
  });
};
