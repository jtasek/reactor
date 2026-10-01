import { Command } from 'src/app/types';
import { editableSelectedShapesIds } from 'src/app/membership';

export const LayerCommand: Command = {
    id: 'layer',
    name: 'Layer',
    category: 'layers',
    description: 'Move selected shapes to a new layer',
    icon: {
        group: 'action',
        name: 'tab',
        size: 24
    },
    shortcut: 'mod+alt+l',
    canExecute: ({ state }) => editableSelectedShapesIds(state.currentDocument).length > 0,
    execute: ({ actions }) => actions.layerSelection()
};

export const UnlayerCommand: Command = {
    id: 'unlayer',
    name: 'Unlayer',
    category: 'layers',
    description: 'Take selected shapes off their layers',
    icon: {
        group: 'action',
        name: 'tab_unselected',
        size: 24
    },
    shortcut: 'mod+alt+shift+l',
    canExecute: ({ state }) => {
        const { currentDocument } = state;
        const layered = new Set(
            Object.values(currentDocument.layers).flatMap((layer) => layer.shapesIds)
        );

        return editableSelectedShapesIds(currentDocument).some((id) => layered.has(id));
    },
    execute: ({ actions }) => actions.unlayerSelection()
};
