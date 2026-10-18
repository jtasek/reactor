import { sharingRequest } from './invitations';

export interface WorkspaceMember {
    id: string;
    name: string;
    email: string;
    image: string | null;
    role: 'viewer' | 'editor' | 'admin';
    owner: boolean;
}

const path = (workspaceId: string) => `/workspaces/${encodeURIComponent(workspaceId)}/members`;
export const members = {
    list: (workspaceId: string, signal?: AbortSignal) =>
        sharingRequest<WorkspaceMember[]>('GET', path(workspaceId), undefined, signal),
    setRole: (workspaceId: string, id: string, role: 'editor' | 'viewer', signal?: AbortSignal) =>
        sharingRequest<void>(
            'PATCH',
            `${path(workspaceId)}/${encodeURIComponent(id)}`,
            { role },
            signal
        ),
    remove: (workspaceId: string, id: string, signal?: AbortSignal) =>
        sharingRequest<void>(
            'DELETE',
            `${path(workspaceId)}/${encodeURIComponent(id)}`,
            undefined,
            signal
        )
};
