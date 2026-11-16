import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readPreview, PREVIEW_PROTOCOL_VERSION } from '../../src/preview/protocol.ts';
import { noMetrics, type Metrics } from '../metrics.ts';
import type { Db, Log } from '../schema.ts';
import * as repository from '../repositories/prototypeLinks.ts';

const LINK_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
const WORKSPACE_SHARE_BYTES = 64 * 1024 * 1024;
const MAX_DOCUMENT_LINKS = 20;
/** Distinct players counted per link; anyone with the link can claim to be a new one. */
const MAX_PLAYERS_PER_LINK = 10_000;
const PLAYER = /^[A-Za-z0-9_-]{16,64}$/;
const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
export type ShareProblem = 'NOT_FOUND' | 'FORBIDDEN' | 'INVALID_SNAPSHOT' | 'SHARE_LIMIT';
type Failure = { ok: false; problem: ShareProblem };
const failed = (problem: ShareProblem): Failure => ({ ok: false, problem });

/** Public snapshots are validated render DTOs, never editable document records. */
export function createPrototypeLinkService(
    db: Db,
    { metrics = noMetrics, log = console }: { metrics?: Metrics; log?: Pick<Log, 'warn'> } = {}
) {
    const published = (result: string) =>
        metrics.count(
            'reactor_prototype_publishes_total',
            'Prototype snapshots published as links, by result.',
            { result }
        );

    /** Locking keeps quota checks and revocations in order with membership changes. */
    async function access(database: Db, actorId: string, documentId: string, lock = true) {
        const document = await repository.documentWorkspace(database, documentId);
        if (!document) {
            return failed('NOT_FOUND');
        }
        if (lock) {
            await repository.lockWorkspace(database, document.workspace_id);
        }
        const role = await repository.workspaceRole(database, actorId, document.workspace_id);
        if (!role) {
            return failed('NOT_FOUND');
        }
        if (role !== 'admin') {
            return failed('FORBIDDEN');
        }
        if (
            !(await (lock
                ? repository.lockDocument(database, documentId)
                : repository.documentExists(database, documentId)))
        ) {
            return failed('NOT_FOUND');
        }

        return { ok: true as const, workspaceId: document.workspace_id };
    }

    /** Snapshots from another protocol can't be drawn by the deployed runtime. */
    const described = <T extends { version: number }>({ version, ...link }: T) => ({
        ...link,
        outdated: version !== PREVIEW_PROTOCOL_VERSION
    });

    return {
        /** A quick check before the snapshot body is read; `create` checks again. */
        authorize: (actorId: string, documentId: string) => access(db, actorId, documentId, false),
        list: async (actorId: string, documentId: string) => {
            const permitted = await access(db, actorId, documentId, false);
            if (!permitted.ok) {
                return permitted;
            }
            const links = await repository.listLinks(db, documentId, new Date());

            return { ok: true as const, links: links.map(described) };
        },
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
                    published('invalid');

                    return failed('INVALID_SNAPSHOT');
                }
                const id = randomUUID();
                const read = () => {
                    try {
                        const application = readPreview(body.application);

                        return application.documentId === documentId && application.screens.length
                            ? application
                            : null;
                    } catch {
                        return null;
                    }
                };
                const application = read();
                if (!application) {
                    published('invalid');

                    return failed('INVALID_SNAPSHOT');
                }
                const snapshot = JSON.stringify({
                    version: PREVIEW_PROTOCOL_VERSION,
                    application: { ...application, documentId: id }
                });
                const now = new Date();
                await repository.removeExpired(tx, permitted.workspaceId, now);
                const links = await repository.workspaceLinks(tx, permitted.workspaceId);
                const size = Buffer.byteLength(snapshot);
                if (
                    links.filter((link) => link.document_id === documentId).length >=
                        MAX_DOCUMENT_LINKS ||
                    links.reduce((total, link) => total + link.size, size) > WORKSPACE_SHARE_BYTES
                ) {
                    published('limit');

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
                    version: PREVIEW_PROTOCOL_VERSION,
                    size,
                    expires_at: new Date(now.getTime() + LINK_LIFETIME_MS)
                });
                await repository.recordShare(tx, {
                    link_id: id,
                    workspace_id: permitted.workspaceId,
                    document_id: documentId,
                    created_by: actorId,
                    screens: application.screens.length
                });
                published('created');

                return { ok: true as const, link: described(link), token };
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
        /** `player` is the id the player's browser keeps, to count distinct players. */
        open: async (
            token: unknown,
            player?: unknown
        ): Promise<{ snapshot: string } | 'OUTDATED' | null> => {
            const opened = (result: string) =>
                metrics.count(
                    'reactor_prototype_opens_total',
                    'Prototype links opened, by result.',
                    { result }
                );
            if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
                opened('missing');

                return null;
            }
            const now = new Date();
            const link = await repository.snapshotForToken(db, tokenHash(token), now);
            if (!link) {
                opened('missing');

                return null;
            }
            if (link.version !== PREVIEW_PROTOCOL_VERSION) {
                opened('outdated');

                return 'OUTDATED';
            }
            opened('shown');
            if (typeof player === 'string' && PLAYER.test(player)) {
                const hashed = tokenHash(`${link.id}:${player}`);
                // Counting must never keep the prototype from opening.
                await repository
                    .recordPlayer(db, link.id, hashed, MAX_PLAYERS_PER_LINK, now)
                    .catch((error: unknown) => log.warn(error, 'A player was not counted'));
            }

            return { snapshot: link.snapshot };
        }
    };
}
