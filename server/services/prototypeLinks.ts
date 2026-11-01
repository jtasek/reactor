import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readPreview, PREVIEW_PROTOCOL_VERSION } from '../../src/preview/protocol.ts';
import type { Db } from '../schema.ts';
import * as repository from '../repositories/prototypeLinks.ts';

const LINK_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
const WORKSPACE_SHARE_BYTES = 64 * 1024 * 1024;
const MAX_DOCUMENT_LINKS = 20;
const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
export type ShareProblem = 'NOT_FOUND' | 'FORBIDDEN' | 'INVALID_SNAPSHOT' | 'SHARE_LIMIT';
type Failure = { ok: false; problem: ShareProblem };
const failed = (problem: ShareProblem): Failure => ({ ok: false, problem });

/** Public snapshots are validated render DTOs, never editable document records. */
export function createPrototypeLinkService(db: Db) {
    async function access(database: Db, actorId: string, documentId: string) {
        const document = await repository.documentWorkspace(database, documentId);
        if (!document) {
            return failed('NOT_FOUND');
        }
        await repository.lockWorkspace(database, document.workspace_id);
        const role = await repository.workspaceRole(database, actorId, document.workspace_id);
        if (!role) {
            return failed('NOT_FOUND');
        }
        if (role !== 'admin') {
            return failed('FORBIDDEN');
        }
        if (!(await repository.lockDocument(database, documentId))) {
            return failed('NOT_FOUND');
        }

        return { ok: true as const, workspaceId: document.workspace_id };
    }

    return {
        list: (actorId: string, documentId: string) =>
            db.transaction().execute(async (tx) => {
                const permitted = await access(tx, actorId, documentId);
                if (!permitted.ok) {
                    return permitted;
                }

                return {
                    ok: true as const,
                    links: await repository.listLinks(tx, documentId, new Date())
                };
            }),
        create: (actorId: string, documentId: string, body: unknown) =>
            db.transaction().execute(async (tx) => {
                const permitted = await access(tx, actorId, documentId);
                if (!permitted.ok) {
                    return permitted;
                }
                if (
                    !body ||
                    typeof body !== 'object' ||
                    !('name' in body) ||
                    typeof body.name !== 'string' ||
                    !body.name.trim() ||
                    body.name.trim().length > 200 ||
                    !('application' in body)
                ) {
                    return failed('INVALID_SNAPSHOT');
                }
                const id = randomUUID();
                const read = () => {
                    try {
                        const application = readPreview(body.application);
                        if (application.documentId !== documentId || !application.screens.length) {
                            return null;
                        }

                        return JSON.stringify({
                            version: PREVIEW_PROTOCOL_VERSION,
                            application: { ...application, documentId: id }
                        });
                    } catch {
                        return null;
                    }
                };
                const snapshot = read();
                if (!snapshot) {
                    return failed('INVALID_SNAPSHOT');
                }
                const now = new Date();
                await repository.removeExpired(tx, permitted.workspaceId, now);
                const links = await repository.workspaceLinks(tx, permitted.workspaceId);
                const size = Buffer.byteLength(snapshot);
                if (
                    links.filter((link) => link.document_id === documentId).length >=
                        MAX_DOCUMENT_LINKS ||
                    links.reduce((total, link) => total + link.size, size) > WORKSPACE_SHARE_BYTES
                ) {
                    return failed('SHARE_LIMIT');
                }
                const token = randomBytes(32).toString('base64url');
                const link = await repository.insertLink(tx, {
                    id,
                    document_id: documentId,
                    workspace_id: permitted.workspaceId,
                    name: body.name.trim(),
                    token_hash: tokenHash(token),
                    snapshot,
                    size,
                    expires_at: new Date(now.getTime() + LINK_LIFETIME_MS)
                });

                return { ok: true as const, link, token };
            }),
        revoke: (actorId: string, documentId: string, id: string) =>
            db.transaction().execute(async (tx) => {
                const permitted = await access(tx, actorId, documentId);
                if (!permitted.ok) {
                    return permitted;
                }
                const removed = await repository.deleteLink(tx, documentId, id);

                return removed ? { ok: true as const } : failed('NOT_FOUND');
            }),
        open: async (token: unknown) => {
            if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
                return null;
            }
            const link = await repository.snapshotForToken(db, tokenHash(token), new Date());

            return link?.snapshot ?? null;
        }
    };
}
