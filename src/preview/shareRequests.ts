import type { PreviewApplication } from './protocol';

export interface PrototypeLink {
    id: string;
    name: string;
    created_at: string;
    expires_at: string;
    url?: string;
}

const messages: Record<string, string> = {
    FORBIDDEN: 'Only workspace admins can manage public prototype links.',
    NOT_FOUND: 'This document or link is no longer available.',
    UNAUTHORIZED: 'Sign in again to manage prototype links.',
    INVALID_SNAPSHOT: 'The prototype could not be shared. Fix its preview problems and try again.',
    SHARE_LIMIT: 'The sharing limit has been reached. Revoke unused links and try again.',
    PREVIEW_UNAVAILABLE: 'The separate prototype server is not configured.'
};

async function request(path: string, method: string, signal: AbortSignal, body?: unknown) {
    const response = await fetch(path, {
        method,
        signal,
        credentials: 'same-origin',
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));

        throw new Error(
            messages[error.code] ?? 'Could not update prototype links. Please try again.'
        );
    }

    return response.status === 204 ? null : response.json();
}

const path = (id: string) => `/api/documents/${encodeURIComponent(id)}/prototype-links`;

export const listPrototypeLinks = (
    documentId: string,
    signal: AbortSignal
): Promise<PrototypeLink[]> => request(path(documentId), 'GET', signal);

export const publishPrototypeLink = (
    documentId: string,
    name: string,
    application: PreviewApplication,
    signal: AbortSignal
): Promise<PrototypeLink> => request(path(documentId), 'POST', signal, { name, application });

export const revokePrototypeLink = (
    documentId: string,
    id: string,
    signal: AbortSignal
): Promise<null> => request(`${path(documentId)}/${encodeURIComponent(id)}`, 'DELETE', signal);
