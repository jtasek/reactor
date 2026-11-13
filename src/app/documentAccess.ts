import type { Application } from './types';

/** View permissions are local to an account; never part of a shared document. */
export interface DocumentAccess {
    workspaceId?: string;
    role: 'viewer' | 'editor' | 'admin' | 'unknown';
}

export const isReadOnly = (
    state: Pick<Application, 'account' | 'documentAccess' | 'currentDocumentId'> &
        Partial<Pick<Application, 'outdatedDocuments'>>,
    id = state.currentDocumentId
) => {
    const role = state.documentAccess[id]?.role;
    return (
        isOutdated(state, id) ||
        role === 'viewer' ||
        role === 'unknown' ||
        (role === undefined && state.account.kind === 'signedIn')
    );
};

export const canDeleteDocument = (
    state: Pick<Application, 'account' | 'documentAccess'>,
    id: string
) =>
    state.documentAccess[id]?.role === 'admin' ||
    (!state.documentAccess[id] && state.account.kind !== 'signedIn');

/** Whether a newer editor changed the document, so this copy may only show it until it reloads. */
export const isOutdated = (
    state: Partial<Pick<Application, 'outdatedDocuments'>>,
    id: string
): boolean => !!state.outdatedDocuments?.[id];
