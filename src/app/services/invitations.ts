export type InvitationRole = 'editor' | 'viewer';
export interface Invitation {
    id: string;
    email: string;
    role: InvitationRole;
    expiresAt: string;
    createdAt: string;
}
export interface InvitationPreview {
    workspaceName: string;
    email: string;
    role: InvitationRole;
    expiresAt: string;
    accepted: boolean;
}

async function request<T>(
    method: string,
    path: string,
    body?: object,
    signal?: AbortSignal
): Promise<T> {
    const response = await fetch(`/api${path}`, {
        method,
        credentials: 'same-origin',
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body: body && JSON.stringify(body),
        signal
    }).catch((error: unknown) => {
        if (signal?.aborted) throw error;
        throw new Error('The server could not be reached. Please try again.');
    });
    if (!response.ok) {
        const { code } = (await response.json().catch(() => ({}))) as { code?: string };
        throw new Error(
            code === 'EMAIL_NOT_VERIFIED'
                ? 'Confirm your email address before accepting this invitation.'
                : response.status === 404
                  ? 'This invitation or workspace is unavailable. Check the signed-in email or ask for a new invitation.'
                  : response.status === 403
                    ? 'Only a workspace admin can manage invitations.'
                    : 'The request could not be completed. Please try again.'
        );
    }
    return response.status === 204 ? (undefined as T) : (response.json() as Promise<T>);
}

const path = (workspaceId: string) => `/workspaces/${encodeURIComponent(workspaceId)}/invitations`;
export const invitations = {
    list: (workspaceId: string, signal?: AbortSignal) =>
        request<Invitation[]>('GET', path(workspaceId), undefined, signal),
    create: (workspaceId: string, email: string, role: InvitationRole) =>
        request<Invitation & { token: string }>('POST', path(workspaceId), { email, role }),
    revoke: (workspaceId: string, id: string) =>
        request<void>('DELETE', `${path(workspaceId)}/${encodeURIComponent(id)}`),
    inspect: (token: string, signal?: AbortSignal) =>
        request<InvitationPreview>('POST', '/invitations/inspect', { token }, signal),
    accept: (token: string, signal?: AbortSignal) =>
        request<{ workspaceId: string; role: InvitationRole | 'admin' }>(
            'POST',
            '/invitations/accept',
            { token },
            signal
        )
};

/** The secret stays in a fragment, which is never sent to the web server. */
export const invitationPath = (token: string) => `/invite#${token}`;
export const invitationToken = (fragment: string) =>
    /^[a-f0-9]{64}$/.test(fragment.slice(1)) ? fragment.slice(1) : undefined;

const PENDING_INVITATION = 'reactor:invitation';

/** OAuth returns to a token-free URL; keep its invitation in this tab, out of auth logs. */
export function pendingInvitationToken(): string | undefined {
    const fragment = window.location.hash;
    const token = invitationToken(fragment);
    try {
        if (token) window.sessionStorage.setItem(PENDING_INVITATION, token);
        return fragment
            ? token
            : invitationToken(`#${window.sessionStorage.getItem(PENDING_INVITATION) ?? ''}`);
    } catch {
        return token;
    }
}

export function forgetInvitationToken() {
    try {
        window.sessionStorage.removeItem(PENDING_INVITATION);
    } catch {
        /* Storage may be unavailable. */
    }
}
