import { Frame } from 'lucide-react';
import type { Tool } from 'src/tools/types';
import { MIN_FRAME_SIZE } from 'src/app/services/documentStorage';
import { DesignRect } from '../Rect';

export const FrameTool: Tool = {
    id: 'frame',
    name: 'Frame',
    category: 'surface',
    description: 'Draw a screen frame',
    shortcut: 'f',
    icon: { component: Frame, size: 24 },
    designComponent: DesignRect,
    canExecute: ({ state }) =>
        state.events.pointer.size.width >= MIN_FRAME_SIZE &&
        state.events.pointer.size.height >= MIN_FRAME_SIZE &&
        !state.currentDocument.locked &&
        !state.currentDocument.editingComponentId,
    execute: ({ state, actions }) => {
        actions.editFrame({
            kind: 'add',
            position: { ...state.events.pointer.topLeft },
            size: { ...state.events.pointer.size }
        });
    },
    shouldDeactivate: () => true
};
