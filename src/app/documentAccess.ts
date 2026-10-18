import type { Application } from './types';

/** View permissions are local to an account; never part of a shared document. */
export interface DocumentAccess {
    workspaceId?: string;
    role: 'viewer' | 'editor' | 'admin' | 'unknown';
}

export const isReadOnly = (
    state: Pick<Application, 'account' | 'documentAccess' | 'currentDocumentId'>,
    id = state.currentDocumentId
) => {
    const role = state.documentAccess[id]?.role;
    return (
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
