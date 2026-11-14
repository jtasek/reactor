import * as Y from 'yjs';
import type { Document } from '../types';
import { createDocument } from '../factories';
import { COLLECTIONS, hydrateDocument, readDocumentFields } from './documentStorage';

/** Why the server kept a snapshot (see server/history.ts). */
export type SnapshotReason = 'scheduled' | 'before-restore' | 'deleted';

/** An earlier state of a document the server keeps. */
export interface Snapshot {
    id: string;
    createdAt: Date;
    reason: SnapshotReason;
    /** Whether the server can restore it: not one a newer release wrote. */
    restorable: boolean;
}

/** A deleted document the server still keeps, which an admin can restore. */
export interface DeletedDocument {
    id: string;
    name: string;
    deletedAt: Date;
    workspaceId: string;
}

const path = (documentId: string) => `/api/documents/${encodeURIComponent(documentId)}/history`;

async function ask(method: 'GET' | 'POST', url: string): Promise<Response> {
    const response = await fetch(url, { method, credentials: 'same-origin' });

    if (!response.ok) {
        throw Object.assign(new Error(`${method} ${url} failed: ${response.status}`), {
            status: response.status
        });
    }

    return response;
}

/** A document's snapshots on the server, newest first. */
export async function listSnapshots(documentId: string): Promise<Snapshot[]> {
    const rows = (await (await ask('GET', path(documentId))).json()) as Array<
        Omit<Snapshot, 'createdAt'> & { createdAt: string }
    >;

    return rows.map(({ id, createdAt, reason, restorable }) => ({
        id,
        createdAt: new Date(createdAt),
        reason,
        restorable
    }));
}

/**
 * A snapshot's content as a document to draw, read and repaired as a saved document
 * is, so one of an older format draws too; undefined when it cannot be read.
 */
export function snapshotDocument(update: Uint8Array, documentId: string): Document | undefined {
    const doc = new Y.Doc();

    try {
        Y.applyUpdate(doc, update);

        // Fields a snapshot lacks, as one of a document never changed, are a new document's.
        const blank = createDocument({ id: documentId });
        const saved: unknown = {
            ...readDocumentFields(blank),
            ...doc.getMap('document').toJSON(),
            id: documentId,
            camera: blank.camera,
            ...Object.fromEntries(
                COLLECTIONS.map((collection) => [collection, doc.getMap(collection).toJSON()])
            )
        };

        return hydrateDocument(saved as Parameters<typeof hydrateDocument>[0]);
    } catch {
        return undefined;
    }
}

/** A snapshot's content as a document to draw; undefined when it cannot be read. */
export async function readSnapshot(
    documentId: string,
    snapshotId: string
): Promise<Document | undefined> {
    const response = await ask('GET', `${path(documentId)}/${encodeURIComponent(snapshotId)}`);

    return snapshotDocument(new Uint8Array(await response.arrayBuffer()), documentId);
}

/** Restores a document to a snapshot, as a change everyone with it open receives. */
export async function restoreSnapshot(documentId: string, snapshotId: string): Promise<void> {
    await ask('POST', `${path(documentId)}/${encodeURIComponent(snapshotId)}/restore`);
}

const deletedPath = (workspaceId: string) =>
    `/api/workspaces/${encodeURIComponent(workspaceId)}/deleted-documents`;

/** The deleted documents the server keeps in the workspaces the user administers. */
export async function listDeletedDocuments(): Promise<DeletedDocument[]> {
    const workspaces = (await (await ask('GET', '/api/workspaces')).json()) as Array<{
        id: string;
        role: string;
    }>;
    const lists = await Promise.all(
        workspaces
            .filter(({ role }) => role === 'admin')
            .map(async ({ id: workspaceId }) => {
                const rows = (await (await ask('GET', deletedPath(workspaceId))).json()) as Array<{
                    id: string;
                    name: string;
                    deletedAt: string;
                }>;

                return rows.map((row) => ({
                    ...row,
                    deletedAt: new Date(row.deletedAt),
                    workspaceId
                }));
            })
    );

    return lists.flat().sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());
}

/** Restores a deleted document as a new one; returns its id. */
export async function restoreDeletedDocument({
    workspaceId,
    id
}: Pick<DeletedDocument, 'workspaceId' | 'id'>): Promise<string> {
    const response = await ask(
        'POST',
        `${deletedPath(workspaceId)}/${encodeURIComponent(id)}/restore`
    );

    return ((await response.json()) as { id: string }).id;
}
