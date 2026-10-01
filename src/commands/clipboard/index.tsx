import { Command } from 'src/app/types';
import { Context } from '../../app';
import { isShapeLocked } from 'src/app/utils';
import { takesEditorInput } from 'src/events/input';

export const copySelection = ({ actions, effects }: Context) => {
    const text = actions.copySelection();

    if (text !== null) {
        void effects.clipboard.copy(text);
    }
};

export const cutSelection = ({ actions, effects }: Context) => {
    const text = actions.cutSelection();

    if (text !== null) {
        void effects.clipboard.copy(text);
    }
};

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
    regex: /(?<toolCode>copy)\('(?<shapeName>\w+)'\)/,
    canExecute: ({ state }) =>
        takesEditorInput(state) && state.currentDocument?.selectedShapesIds.length > 0,
    execute: copySelection
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
    regex: /(?<toolCode>cut)\('(?<shapeName>\w+)'\)/,
    canExecute: ({ state }) =>
        takesEditorInput(state) &&
        state.currentDocument?.selectedShapesIds.some(
            (id) => !isShapeLocked(state.currentDocument, id)
        ),
    execute: cutSelection
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
    regex: /(?<toolCode>paste)\(\)/,
    canExecute: ({ state }) => takesEditorInput(state),
    execute: ({ effects }) => {
        void effects.clipboard.paste();
    }
};
