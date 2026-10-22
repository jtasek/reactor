import { useAppState } from '../app/hooks';
import { variableContext } from '../app/variableModes';
import { projectPreview } from './project';

/** Read the projection while Overmind tracks its actual dependencies. Serializing the
 * small DTO also avoids sending an unchanged view after selection-only edits. */
export const usePreviewProjection = () =>
    useAppState((state) => {
        const document = state.currentDocument;
        try {
            const application = projectPreview(
                document,
                variableContext(document, state.previewModes[document.id])
            );

            return { serialized: JSON.stringify(application), problem: null };
        } catch (error) {
            return {
                serialized: null,
                problem: error instanceof Error ? error.message : 'Preview could not be updated.'
            };
        }
    });
