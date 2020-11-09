import React, { FC } from 'react';
import { useState } from 'src/app/hooks';
import { Zoom } from './Zoom';

export const DesignZoom: FC = () => {
  const { pointer } = useState().events;

  return <Zoom {...pointer} />;
};
