import { Command } from 'src/app/types';
import { isShapeLocked } from 'src/app/utils';
import { takesEditorInput } from 'src/events/input';

export const CopyCommand: Command = {
    id: 'copy',
    name: 'Copy',
    category: 'tools',
    description: 'Copy selected shapes',
    icon: {
        group: 'content',
        name: 'content_copy',
        size: 24
    },
    shortcut: 'mod+c',
    clipboardEvent: 'copy',
    canExecute: ({ state }) =>
        takesEditorInput(state) && state.currentDocument?.selectedShapesIds.length > 0,
    execute: ({ actions, effects }) => {
        const text = actions.copySelection();

        if (text !== null) {
            void effects.clipboard.copy(text);
        }
    }
};

export const CutCommand: Command = {
    id: 'cut',
    name: 'Cut',
    category: 'tools',
    description: 'Cut selected shapes',
    icon: {
        group: 'content',
        name: 'content_cut',
        size: 24
    },
    shortcut: 'mod+x',
    clipboardEvent: 'cut',
    canExecute: ({ state }) =>
        takesEditorInput(state) &&
        state.currentDocument?.selectedShapesIds.some(
            (id) => !isShapeLocked(state.currentDocument, id)
        ),
    execute: ({ actions, effects }) => {
        const cut = actions.selectionToCut();

        if (cut) {
            void effects.clipboard.cut(cut);
        }
    }
};

export const PasteCommand: Command = {
    id: 'paste',
    name: 'Paste',
    category: 'tools',
    description: 'Paste copied shapes',
    icon: {
        group: 'content',
        name: 'content_paste',
        size: 24
    },
    shortcut: 'mod+v',
    clipboardEvent: 'paste',
    canExecute: ({ state }) => takesEditorInput(state),
    execute: ({ effects }) => {
        void effects.clipboard.paste();
    }
};
