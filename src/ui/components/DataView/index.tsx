import React, { FC } from 'react';
import { useAppState } from 'src/app/hooks';
import { DataView } from './DataView';

export const ConnectedDataView: FC = () => {
  const { visible } = useAppState().ui.dataView;

  if (!visible) {
    return null;
  }

  return <DataView sources={['source 1', 'source 2']} />;
};
