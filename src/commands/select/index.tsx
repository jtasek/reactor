import { Command } from 'src/app/types';
import { Context } from 'src/app/hooks';
import { pointInRectangle } from 'src/app/utils';

export const selectShape = ({ state }: Context) => {
  const { events, currentDocument } = state;
  Object.values(currentDocument.shapes).forEach((shape) =>
    pointInRectangle(events.pointer.position, shape)
  );
};

export const SelectCommand: Command = {
  id: 'select',
  name: 'Select',
  category: 'shapes',
  description: 'Selects shapes and groups ',
  icon: {
    group: 'action',
    name: 'pan_tool',
    color: 'rgba(255,255,255)',
    size: 24
  },
  regex: /(?<toolCode>select)\((?<x1>[\d]+),(?<y1>[\d]+),(?<x2>[\d]+),(?<y2>[\d]+)\)/,
  shortcut: 's',
  canExecute: (context: Context, args) => true,
  execute: selectShape,
  factory: (context: Context) => createSelectProps(context, true)
};
