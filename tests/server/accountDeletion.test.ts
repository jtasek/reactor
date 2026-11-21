import { sql } from 'kysely';
import { findLink, serve, type DocumentSummary } from './support';

type Served = Awaited<ReturnType<typeof serve>>;

const create = (served: Served, cookie: string, workspaceId: string, name: string) =>
    served.json<DocumentSummary>(
        served.call('POST', `/workspaces/${workspaceId}/documents`, { cookie, body: { name } })
    );

const userId = async (served: Served, email: string) =>
    (
        await sql<{ id: string }>`select id from auth."user" where email = ${email}`.execute(
            served.db
        )
    ).rows[0]?.id;

const deleteAccount = (served: Served, cookie: string, body: object = {}) =>
    served.call('POST', '/auth/delete-user', { cookie, body });

/** Dates every session of `email` back by `hours`, so it is no longer a recent sign-in. */
const age = (served: Served, email: string, hours: number) =>
    sql`update auth.session set "createdAt" = now() - make_interval(hours => ${hours})
        where "userId" = (select id from auth."user" where email = ${email})`.execute(served.db);

it('deletes the account, its workspace with documents, history and links, and its memberships', async () => {
    const served = await serve();
    const ada = await served.user('ada@example.com');
    const bea = await served.user('bea@example.com');
    const cy = await served.user('cy@example.com');
    const adaId = (await userId(served, 'ada@example.com'))!;
    const beaId = (await userId(served, 'bea@example.com'))!;
    const plan = await create(served, ada.cookie, ada.personal.id, 'Plan');
    const draft = await create(served, ada.cookie, ada.personal.id, 'Draft');

    await served.db
        .insertInto('workspace_members')
        .values([
            { workspace_id: ada.personal.id, user_id: beaId, role: 'editor' },
            { workspace_id: cy.personal.id, user_id: adaId, role: 'editor' }
        ])
        .execute();
    await served.db
        .insertInto('prototype_links')
        .values({
            id: 'link',
            workspace_id: ada.personal.id,
            document_id: plan.id,
            name: 'Plan',
            token_hash: 'hash',
            snapshot: '{}',
            version: 1,
            size: 2,
            expires_at: new Date(Date.now() + 60_000)
        })
        .execute();
    expect(
        (await served.call('DELETE', `/documents/${draft.id}`, { cookie: ada.cookie })).status
    ).toBe(204);

    const shared = await create(served, ada.cookie, cy.personal.id, 'Shared with Cy');
    const closeDocument = vi.spyOn(served.sync, 'closeDocument');
    const closeMember = vi.spyOn(served.sync, 'closeMember');

    expect((await deleteAccount(served, ada.cookie)).status).toBe(200);

    expect((await served.call('GET', '/workspaces', { cookie: ada.cookie })).status).toBe(401);
    expect(await userId(served, 'ada@example.com')).toBeUndefined();

    for (const table of [
        'workspaces',
        'documents',
        'prototype_links',
        'document_snapshots',
        'shared_prototypes'
    ] as const) {
        const left = await served.db
            .selectFrom(table)
            .select(sql<number>`count(*)::int`.as('count'))
            .where(table === 'workspaces' ? 'id' : 'workspace_id', '=', ada.personal.id)
            .executeTakeFirstOrThrow();

        expect(left.count, table).toBe(0);
    }

    const beaSpaces = await served.json<{ id: string }[]>(
        served.call('GET', '/workspaces', { cookie: bea.cookie })
    );

    expect(beaSpaces.map(({ id }) => id)).toEqual([bea.personal.id]);

    const cyDocuments = await served.json<DocumentSummary[]>(
        served.call('GET', `/workspaces/${cy.personal.id}/documents`, { cookie: cy.cookie })
    );

    expect(cyDocuments.map(({ id }) => id)).toEqual([shared.id]);
    expect(
        await served.db
            .selectFrom('workspace_members')
            .select('user_id')
            .where('workspace_id', '=', cy.personal.id)
            .execute()
    ).toEqual([{ user_id: (await userId(served, 'cy@example.com'))! }]);

    expect(closeDocument).toHaveBeenCalledWith(plan.id);
    expect(closeMember).toHaveBeenCalledWith(cy.personal.id, adaId);
    expect(closeMember).not.toHaveBeenCalledWith(ada.personal.id, adaId);
});

it('asks for a recent sign-in, or the password where the account has one', async () => {
    const served = await serve();
    const ada = await served.user('ada@example.com');

    await age(served, 'ada@example.com', 48);

    const stale = await deleteAccount(served, ada.cookie);

    expect(stale.status).toBe(400);
    expect(await stale.json()).toMatchObject({ code: 'SESSION_EXPIRED' });
    expect(await userId(served, 'ada@example.com')).toBeDefined();

    const account = { name: 'Bea', email: 'bea@example.com', password: 'a long password' };

    expect((await served.call('POST', '/auth/sign-up/email', { body: account })).ok).toBe(true);
    await served.call('GET', findLink(served.outbox.at(-1)!).replace(/^.*\/api/, ''));

    const signedIn = await served.call('POST', '/auth/sign-in/email', {
        body: { email: account.email, password: account.password }
    });
    const cookie = signedIn.headers
        .getSetCookie()
        .map((value) => value.split(';')[0])
        .join('; ');

    await age(served, account.email, 48);

    const wrong = await deleteAccount(served, cookie, { password: 'not the password' });

    expect(wrong.status).toBe(400);
    expect(await wrong.json()).toMatchObject({ code: 'INVALID_PASSWORD' });
    expect((await deleteAccount(served, cookie, { password: account.password })).status).toBe(200);
    expect(await userId(served, account.email)).toBeUndefined();
});

it('still deletes the account when closing its connections fails', async () => {
    const served = await serve();
    const ada = await served.user('ada@example.com');
    const cy = await served.user('cy@example.com');

    await served.db
        .insertInto('workspace_members')
        .values({
            workspace_id: cy.personal.id,
            user_id: (await userId(served, 'ada@example.com'))!,
            role: 'editor'
        })
        .execute();
    vi.spyOn(served.sync, 'closeMember').mockRejectedValue(new Error('closed already'));

    expect((await deleteAccount(served, ada.cookie)).status).toBe(200);
    expect(await userId(served, 'ada@example.com')).toBeUndefined();
});
