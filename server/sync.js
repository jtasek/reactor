import { fromNodeHeaders } from 'better-auth/node';
import { Hocuspocus } from '@hocuspocus/server';
import { WebSocketServer } from 'ws';
import * as Y from 'yjs';
import { allows, roleOnDocument } from './workspaces.js';

/** Where the editor connects to share documents. */
export const SYNC_PATH = '/sync';

/** The largest message a client may send, as the whole document when it first syncs. */
const MAX_MESSAGE = 4 * 1024 * 1024;

/** How many sockets one user may have open at once, across tabs and devices. */
const MAX_SOCKETS_PER_USER = 16;

const refuseUpgrade = (socket, status, reason) => {
    socket.end(`HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\n\r\n`);
};

/** Reads a document's saved content into `document`. */
async function loadState(db, documentId, document) {
    const saved = await db
        .selectFrom('document_states')
        .select('state')
        .where('document_id', '=', documentId)
        .executeTakeFirst();

    if (saved) {
        Y.applyUpdate(document, new Uint8Array(saved.state));
    }
}

/** Saves a document's whole content, unless it was deleted meanwhile. */
async function saveState(db, documentId, document) {
    const state = Buffer.from(Y.encodeStateAsUpdate(document));

    await db.transaction().execute(async (trx) => {
        const updated = await trx
            .updateTable('documents')
            .set({ updated_at: new Date() })
            .where('id', '=', documentId)
            .executeTakeFirst();

        if (updated.numUpdatedRows === 0n) {
            return;
        }

        await trx
            .insertInto('document_states')
            .values({ document_id: documentId, state, updated_at: new Date() })
            .onConflict((conflict) =>
                conflict.column('document_id').doUpdateSet({ state, updated_at: new Date() })
            )
            .execute();
    });
}

/**
 * Shares documents between the copies of the editor that have them open, through
 * a WebSocket at `SYNC_PATH`, and saves them in the database. The upgrade needs
 * the session cookie and the editor's own `origin`; each document then needs the
 * viewer role, and without editor its connection is read-only, so the server
 * drops the changes it sends. A document is named by its id and exists only once
 * created through the API.
 */
export function createSync({ db, auth, origin, log }) {
    const sockets = new Map();
    const hocuspocus = new Hocuspocus({
        quiet: true,
        async onConnect({ context, documentName, connectionConfig }) {
            const role = await roleOnDocument(db, context.userId, documentName);

            if (!allows(role, 'viewer')) {
                throw new Error('Not found');
            }

            connectionConfig.readOnly = !allows(role, 'editor');
        },
        onLoadDocument: ({ documentName, document }) => loadState(db, documentName, document),
        async onStoreDocument({ documentName, document }) {
            try {
                await saveState(db, documentName, document);
            } catch (error) {
                log.error(error, `Document ${documentName} could not be saved`);
                throw error;
            }
        }
    });
    const server = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE });

    const count = (userId, change) => {
        const open = (sockets.get(userId) ?? 0) + change;

        if (open > 0) {
            sockets.set(userId, open);
        } else {
            sockets.delete(userId);
        }
    };

    async function upgrade(req, socket, head) {
        if (new URL(req.url, origin).pathname !== SYNC_PATH) {
            socket.destroy();

            return;
        }

        if (req.headers.origin !== origin) {
            refuseUpgrade(socket, 403, 'Forbidden');

            return;
        }

        const headers = fromNodeHeaders(req.headers);
        const session = await auth.api.getSession({ headers });

        if (!session) {
            refuseUpgrade(socket, 401, 'Unauthorized');

            return;
        }

        const userId = session.user.id;

        if ((sockets.get(userId) ?? 0) >= MAX_SOCKETS_PER_USER) {
            refuseUpgrade(socket, 429, 'Too Many Requests');

            return;
        }

        server.handleUpgrade(req, socket, head, (websocket) => {
            const request = new Request(new URL(req.url, origin), { headers });
            const connection = hocuspocus.handleConnection(websocket, request, { userId });

            count(userId, 1);
            websocket.on('message', (data) => connection.handleMessage(new Uint8Array(data)));
            websocket.on('close', (code, reason) => {
                count(userId, -1);
                connection.handleClose({ code, reason: reason.toString() });
            });
            websocket.on('error', (error) => log.warn(error, 'A sync connection failed'));
        });
    }

    return {
        /** Takes the WebSocket upgrades of `httpServer`. */
        attach(httpServer) {
            httpServer.on('upgrade', (req, socket, head) => {
                upgrade(req, socket, head).catch((error) => {
                    log.error(error, 'A sync connection could not be opened');
                    socket.destroy();
                });
            });
        },
        /** Disconnects everyone from a document, as when it is deleted. */
        closeDocument(documentId) {
            hocuspocus.closeConnections(documentId);
        },
        /** Saves every document open here and disconnects everyone. */
        async close() {
            hocuspocus.closeConnections();
            server.close();
            await Promise.all(
                [...hocuspocus.documents.values()].map((document) =>
                    saveState(db, document.name, document)
                )
            );
        }
    };
}
