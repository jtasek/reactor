import React, { FC } from 'react';

export interface Props {
  sources: string[];
}

export const DataView: FC<Props> = ({ sources }) => <div>Data sources: {sources.concat(', ')}</div>;
