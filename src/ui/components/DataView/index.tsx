import React, { FC } from 'react';
import { useControls } from 'src/app/hooks';
import { DataView } from './DataView';

export const ConnectedDataView: FC = () => {
  const { dataView } = useControls();

  if (!dataView.visible) {
    return null;
  }

  return <DataView sources={['source 1', 'source 2']} />;
};
