import { useAppState } from '../app/hooks';
import { variableContext } from '../app/variableModes';
import { projectPreview } from './project';

export interface PreviewProjection {
    serialized: string | null;
    problem: string | null;
    warnings: string[];
    /** True while a pointer gesture runs; the preview catches up when it ends. */
    paused: boolean;
}

/** Read the projection while Overmind tracks its actual dependencies. Serializing the
 * small DTO also avoids sending an unchanged view after selection-only edits. During a
 * drag only the gesture kind is read, so pointer moves don't rebuild the preview. */
export const usePreviewProjection = () =>
    useAppState((state): PreviewProjection => {
        if (state.events.pointer.gesture.kind !== 'idle') {
            return { serialized: null, problem: null, warnings: [], paused: true };
        }
        const document = state.currentDocument;
        const warnings: string[] = [];
        try {
            const application = projectPreview(
                document,
                variableContext(document, state.previewModes[document.id]),
                warnings
            );

            return {
                serialized: JSON.stringify(application),
                problem: null,
                warnings: [...new Set(warnings)],
                paused: false
            };
        } catch (error) {
            return {
                serialized: null,
                problem: error instanceof Error ? error.message : 'Preview could not be updated.',
                warnings: [],
                paused: false
            };
        }
    });
