/** A workspace the signed-in user belongs to. */
export interface Workspace {
    id: string;
    kind: 'personal' | 'team' | 'organization';
    name: string;
    role: 'viewer' | 'editor' | 'admin';
}

/** Where documents sync, and the WebSocket class to open it with where the browser's is missing. */
export interface Transport {
    url: string;
    WebSocketPolyfill?: unknown;
}

/** The server's `/sync` endpoint, on the address the editor was loaded from. */
export const serverTransport = (): Transport => ({
    url: `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/sync`
});

export type SyncStatus = 'synced' | 'syncing' | 'offline';

/** What a copy of the editor remembers of the server between starts; shared by the copies on a device. */
export interface ServerRecord {
    /**
     * Documents made here that the server may not have yet; one it lacks that is
     * not among them was deleted elsewhere.
     */
    unsent: string[];
    /** Documents deleted here that the server may still hold. */
    deleting: string[];
}

/** A document on the server. */
export interface ServerDocument {
    id: string;
    name: string;
}

/** Answers to creating a document that no retry changes: an invalid body, no right to, or a taken id. */
const REFUSED = new Set([400, 403, 409]);

const request = (method: string, path: string, body?: object) =>
    fetch(`/api${path}`, {
        method,
        credentials: 'same-origin',
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body: body && JSON.stringify(body)
    });

async function read<T>(path: string): Promise<T> {
    const response = await request('GET', path);

    if (!response.ok) {
        throw new Error(`GET ${path} failed: ${response.status}`);
    }

    return (await response.json()) as T;
}

/** The server's workspaces and documents, for the signed-in user; a request that fails throws. */
export const api = {
    workspaces: () => read<Workspace[]>('/workspaces'),
    documents: (workspaceId: string) =>
        read<ServerDocument[]>(`/workspaces/${encodeURIComponent(workspaceId)}/documents`),
    /**
     * Creates a document with this copy's id; false when the server refuses it for
     * good, as when the id is taken elsewhere or is not one the server accepts.
     */
    async createDocument(workspaceId: string, document: ServerDocument): Promise<boolean> {
        const response = await request(
            'POST',
            `/workspaces/${encodeURIComponent(workspaceId)}/documents`,
            document
        );

        if (response.ok || REFUSED.has(response.status)) {
            return response.ok;
        }

        throw new Error(`The document ${document.id} could not be created: ${response.status}`);
    },
    /** Deletes a document; one already gone counts as deleted. */
    async deleteDocument(documentId: string): Promise<void> {
        const response = await request('DELETE', `/documents/${encodeURIComponent(documentId)}`);

        if (!response.ok && response.status !== 404) {
            throw new Error(`The document ${documentId} could not be deleted: ${response.status}`);
        }
    }
};

export type Api = typeof api;
