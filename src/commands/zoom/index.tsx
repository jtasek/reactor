import { Command } from 'src/app/types';
import { zoomIn, zoomOut, zoomReset } from './actions';
import { Context } from '../../app';

export const ZoomInCommand: Command = {
  id: 'zoom-in',
  name: 'Zoom in',
  category: 'surface',
  description: 'Zoom in',
  icon: {
    group: 'action',
    name: 'zoom_in',
    size: 24
  },
  regex: /(?<toolCode>zoomin)\((?<factor>[\d]+)\)/,
  shortcut: 'z',
  canExecute: (context: Context) => true,
  execute: zoomIn
};

export const ZoomOutCommand: Command = {
  id: 'zoom-out',
  name: 'Zoom out',
  category: 'surface',
  description: 'Zoom out',
  icon: {
    group: 'action',
    name: 'zoom_out',
    size: 24
  },
  regex: /(?<toolCode>zoomout)\((?<factor>[\d]+)\)/,
  shortcut: 'z',
  canExecute: (context: Context) => true,
  execute: zoomOut
};

export const ZoomResetCommand: Command = {
  id: 'zoom-reset',
  name: 'Zoom reset',
  category: 'surface',
  description: 'Zoom reset',
  icon: {
    group: 'action',
    name: 'youtube_searched_for',
    size: 24
  },
  regex: /(?<toolCode>zoomreset)\((?<factor>[\d]+)\)/,
  shortcut: 'z',
  canExecute: (context: Context) => true,
  execute: zoomReset
};
