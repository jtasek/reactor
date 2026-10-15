// Only the editor page offers AI, so these hooks load with it rather than with
// `hooks.ts`, which every page needs as it opens.
import { useAppState } from './hooks';

/** Whether AI is offered to the person signed in. */
export const useAiAvailable = () => useAppState((state) => state.ai === 'available');

/** The document AI is asked to change while its chat is open, if it is the one shown. */
export const useAiEdit = () =>
    useAppState((state) => {
        const documentId = state.aiEditDocumentId;
        const currentDocumentId = state.currentDocumentId;
        const available = state.ai === 'available';

        return available && documentId === currentDocumentId ? documentId : undefined;
    });
