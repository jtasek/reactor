import { orderAbove } from 'src/app/drawOrder';
import { createDocument } from 'src/app/factories';
import { hydrateDocument } from 'src/app/services/documentStorage';
import type { Document } from 'src/app/types';
import type { Send } from 'src/ai/client';
import { DOCUMENT_ID } from '../support/collaboration';
import { startServer, type DocumentSummary } from '../server/support';

/**
 * A document to start from, with IDs of its own so a recorded answer can name
 * them: each record under its ID, holding only what differs from a new one.
 */
export interface Fixture {
    variables?: Record<string, { name: string; type: string; value: unknown }>;
    /** In drawing order, the first at the bottom. */
    shapes?: Record<string, { type: string } & Record<string, unknown>>;
    groups?: Record<string, { name: string; shapes: string[] }>;
}

/**
 * An eval case: a person's request of a document, and what the document must
 * hold once the proposal is applied. Its folder holds the case as `case.ts`, any
 * image it names, and the model's recorded answer as `recording.json`.
 */
export interface AiCase {
    fixture: Fixture;
    prompt: string;
    /** An image in the case's folder that the person attached. */
    image?: string;
    /** What is wrong with the document after applying the proposal; nothing when it passes. */
    check(document: Document): string[];
}

const entity = { locked: false, visible: true };

/** The fixture as a document of the shared test copies, read as a saved document is. */
export function fixtureDocument({ variables = {}, shapes = {}, groups = {} }: Fixture): Document {
    let order: string | null = null;
    const now = new Date().toISOString();

    return hydrateDocument({
        ...createDocument({ id: DOCUMENT_ID, name: 'Fixture' }),
        variables: Object.fromEntries(
            Object.entries(variables).map(([id, { name, type, value }]) => [
                id,
                { id, name, type, values: { default: value } }
            ])
        ),
        shapes: Object.fromEntries(
            Object.entries(shapes).map(([id, shape]) => {
                order = orderAbove(order);

                return [
                    id,
                    {
                        ...entity,
                        name: id,
                        created: now,
                        modified: now,
                        createdBy: '',
                        modifiedBy: '',
                        ...shape,
                        id,
                        order
                    }
                ];
            })
        ),
        groups: Object.fromEntries(
            Object.entries(groups).map(([id, { name, shapes: shapesIds }]) => [
                id,
                { ...entity, id, name, shapesIds }
            ])
        )
    } as unknown as Parameters<typeof hydrateDocument>[0]);
}

/**
 * The server, with accounts on an empty database, whose AI requests go to the
 * fetch given to `answerWith`, and a person signed in. `send` posts to its AI
 * gateway as the editor does, for the server's copy of a document.
 */
export async function startHarness() {
    let answer: typeof fetch = () => Promise.reject(new Error('No answer to give'));
    const server = await startServer({ ai: { fetch: (url, init) => answer(url, init) } });
    const { cookie, personal } = await server.user('ada@example.com');

    /** Makes a document on the server, which AI requests name. */
    const createServerDocument = async () =>
        (
            await server.json<DocumentSummary>(
                server.call('POST', `/workspaces/${personal.id}/documents`, {
                    cookie,
                    body: { name: 'Eval' }
                })
            )
        ).id;

    const send: Send = (path, body, signal) =>
        server.call('POST', `/ai${path}`, { cookie, body, signal });

    return {
        db: server.db,
        send,
        createServerDocument,
        answerWith: (fetch: typeof answer) => {
            answer = fetch;
        },
        close: server.close
    };
}
