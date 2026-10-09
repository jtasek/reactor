import type { Command } from 'src/app/types';

export const CreateComponentCommand: Command = {
    id: 'create-component',
    name: 'Create component',
    category: 'groups',
    description: 'Make the selected shapes a reusable component',
    icon: { group: 'content', name: 'library_add', size: 24 },
    shortcut: 'mod+alt+c',
    canExecute: ({ state }) => {
        const document = state.currentDocument;
        const selected = document.editableSelectedShapesIds;

        return (
            !document.locked &&
            selected.length > 0 &&
            selected.every((id) =>
                Object.values(document.components).every(
                    (component) => !component.shapesIds.includes(id)
                )
            )
        );
    },
    execute: ({ actions }) => actions.createComponentFromSelection()
};

export const SelectComponentSourceCommand: Command = {
    id: 'select-component-source',
    name: 'Select component source',
    category: 'groups',
    description: 'Select the shapes that define this instance',
    icon: { group: 'action', name: 'find_in_page', size: 24 },
    canExecute: ({ state }) =>
        state.currentDocument.selectedShapes.some((shape) => shape.type === 'instance'),
    execute: ({ state, actions }) => {
        const instance = state.currentDocument.selectedShapes.find(
            (shape) => shape.type === 'instance'
        );

        if (instance?.type !== 'instance') {
            return;
        }
        actions.selectComponentSource(instance.componentId);
    }
};

export const ResetComponentOverridesCommand: Command = {
    id: 'reset-component-overrides',
    name: 'Reset component overrides',
    category: 'groups',
    description: 'Use the source values for selected instances',
    icon: { group: 'action', name: 'restore', size: 24 },
    canExecute: ({ state }) =>
        state.currentDocument.selectedShapes.some(
            (shape) => shape.type === 'instance' && Object.keys(shape.overrides).length > 0
        ),
    execute: ({ state, actions }) =>
        actions.resetInstanceOverrides({
            instanceIds: state.currentDocument.selectedShapesIds
        })
};

export const DetachInstanceCommand: Command = {
    id: 'detach-instance',
    name: 'Detach instance',
    category: 'groups',
    description: 'Replace the selected instance with independent shapes',
    icon: { group: 'content', name: 'content_copy', size: 24 },
    canExecute: ({ state }) =>
        state.currentDocument.editableSelectedShapesIds.some(
            (id) => state.currentDocument.shapes[id]?.type === 'instance'
        ),
    execute: ({ state, actions }) =>
        actions.detachInstances(state.currentDocument.editableSelectedShapesIds)
};
