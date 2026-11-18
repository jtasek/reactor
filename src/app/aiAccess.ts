// Only the editor page offers AI, so this loads with it rather than at startup.
import type { Application } from './types';

/** Whether AI, or the local test model, is offered and the current document's workspace leaves it on. */
export const aiOffered = (
    state: Pick<Application, 'ai' | 'documentAccess' | 'currentDocumentId'>
) => state.ai !== 'unavailable' && !state.documentAccess[state.currentDocumentId]?.aiOff;
