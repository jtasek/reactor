// Only the editor page offers AI, so these hooks load with it rather than with
// `hooks.ts`, which every page needs as it opens.
import { useAppState } from './hooks';

/** Whether AI is offered to the person signed in. */
export const useAiAvailable = () => useAppState((state) => state.ai === 'available');

/** The document AI is asked to change while its dialog is open, if it is the one shown. */
export const useAiEdit = () =>
    useAppState((state) =>
        state.aiEditDocumentId === state.currentDocumentId ? state.aiEditDocumentId : undefined
    );
