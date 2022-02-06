import React, { FC } from 'react';
import { useAppState } from 'src/app/hooks';
import type { Tool } from 'src/tools/types';
import { Zoom } from './Zoom';

export const ZoomTool: FC = () => {
  const { pointer } = useAppState().events;

  return <Zoom {...pointer} />;
};

export default {
  code: 'zoom',
  name: 'Zoom',
  description: 'Zooms in and out',
  //factory: (): void => alert('Factory not implemented'),
  tool: ZoomTool,
  component: Zoom,
  icon: {
    group: 'action',
    name: 'search',
    color: 'rgba(255,255,255)',
    size: 24
  },
  regex: /(?<toolCode>zoom)\((?<factor>[\d]+)\)/,
  shortcut: 'z',
  type: 'zoom'
} as Tool;
