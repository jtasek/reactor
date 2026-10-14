import { Command } from 'src/app/types';
import { Context } from 'src/app';
import { takesEditorInput } from 'src/events/input';

const canChange = (state: Context['state']) =>
    takesEditorInput(state) && !state.currentDocument.locked;

export const UndoCommand: Command = {
    id: 'undo',
    name: 'Undo',
    category: 'history',
    description: 'Undo your last change, leaving other people’s',
    icon: {
        group: 'content',
        name: 'undo',
        size: 24
    },
    shortcut: 'mod+z',
    canExecute: ({ state }) => canChange(state) && state.currentDocument.history.canUndo,
    execute: ({ state, effects }) => effects.collaboration.undo(state.currentDocumentId)
};

export const RedoCommand: Command = {
    id: 'redo',
    name: 'Redo',
    category: 'history',
    description: 'Redo the change you last undid',
    icon: {
        group: 'content',
        name: 'redo',
        size: 24
    },
    shortcut: 'mod+shift+z',
    canExecute: ({ state }) => canChange(state) && state.currentDocument.history.canRedo,
    execute: ({ state, effects }) => effects.collaboration.redo(state.currentDocumentId)
};
