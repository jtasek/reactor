import { Command } from 'src/app/types';
import { createGroup, createLayer } from 'src/app/factories';
import { Context } from '../../app';

export const layerSelection = (context: Context) => {
  const { state } = context;

  const layer = createLayer({ shapesIds: state.currentDocument?.selectedShapesIds });

  state.currentDocument.layers[layer.id] = layer;
};

export const LayerCommand: Command = {
  id: 'layer',
  name: 'Layer',
  category: 'layers',
  description: 'Layer current selection',
  icon: {
    group: 'action',
    name: 'tab',
    size: 24
  },
  regex: /(?<toolCode>layer)\('(?<shapeName>\w+)',(?<x>\d+),(?<y>\d+)\)/,
  shortcut: 'm',
  canExecute: ({ state }: Context) => state.currentDocument?.selectedShapes.length > 0,
  execute: layerSelection
};

export const deleteSelectedLayers = ({ state }: Context) => {
  const { selectedLayersIds } = state.currentDocument;

  selectedLayersIds?.forEach((layerId) => delete state.currentDocument.layers[layerId]);
};

export const UnlayerCommand: Command = {
  id: 'unlayer',
  name: 'Unlayer',
  category: 'layers',
  description: 'Delete selected layer',
  icon: {
    group: 'action',
    name: 'tab_unselected',
    size: 24
  },
  regex: /(?<toolCode>unlayer)\('(?<shapeName>\w+)',(?<x>\d+),(?<y>\d+)\)/,
  shortcut: 'm',
  canExecute: ({ state }: Context) => state.currentDocument.selectedLayersIds.length > 0,
  execute: deleteSelectedLayers
};
