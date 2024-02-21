import { Command } from 'src/app/types';

import { Context } from '../../app';

export const deleteSelectedShapes = ({ state }: Context) => {
  const { selectedShapesIds } = state.currentDocument;

  selectedShapesIds?.forEach((shapeId) => delete state.currentDocument.shapes[shapeId]);
};

export const DeleteCommand: Command = {
  id: 'delete',
  name: 'Delete',
  category: 'shapes',
  description: 'Delete selected shapes',
  icon: {
    group: 'action',
    name: 'delete',
    size: 24
  },
  regex: /(?<toolCode>delete)\('(?<shapeName>\w+)'\)/,
  shortcut: 'm',
  canExecute: ({ state }: Context) => state.currentDocument?.selectedShapes.length > 0,
  execute: deleteSelectedShapes
};
