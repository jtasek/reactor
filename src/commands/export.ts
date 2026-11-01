import { ImageDown } from 'lucide-react';
import type { Command } from 'src/app/types';
import { takesEditorInput } from 'src/events/input';
import { exportableFrame } from 'src/app/screens';

export const ExportSvgCommand: Command = {
    id: 'export-svg',
    name: 'Export SVG',
    description: 'Download the selected Screen, Screen view or objects as SVG',
    category: 'document',
    icon: { component: ImageDown, size: 24 },
    canExecute: ({ state }) =>
        takesEditorInput(state) &&
        state.events.pointer.gesture.kind === 'idle' &&
        !state.guideDragActive &&
        (state.currentDocument.selectedShapesIds.length > 0 ||
            Boolean(exportableFrame(state.currentDocument, state.currentDocument.selectedFrameId))),
    execute: async (context) => {
        const documentId = context.state.currentDocumentId;
        const selection = () =>
            JSON.stringify([
                context.state.currentDocument.selectedFrameId,
                context.state.currentDocument.selectedShapesIds
            ]);
        const target = selection();
        try {
            const { downloadSvg } = await import('src/export/download');
            if (context.state.currentDocumentId !== documentId || selection() !== target) {
                throw new Error('The selection changed while loading export. Please try again.');
            }
            if (!ExportSvgCommand.canExecute(context)) {
                return;
            }
            await downloadSvg(context);
        } catch (error) {
            context.actions.displayError(
                error instanceof Error ? error.message : 'SVG export failed.'
            );
        }
    }
};
