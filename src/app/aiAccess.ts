// Only the editor page offers AI, so this loads with it rather than at startup.
import type { Application } from './types';

/** Whether the server offers AI and the current document's workspace leaves it on. */
export const aiOffered = (
    state: Pick<Application, 'ai' | 'documentAccess' | 'currentDocumentId'>
) => state.ai === 'available' && !state.documentAccess[state.currentDocumentId]?.aiOff;
