import { sql } from 'kysely';
import { serve } from './support';

type Invitation = { id: string; token: string; email: string; role: string; expiresAt: string };

async function setup() {
    const server = await serve();
    const admin = await server.user('admin@example.com');
    const recipient = await server.user('recipient@example.com');
    const path = `/workspaces/${admin.personal.id}/invitations`;
    const create = (role = 'editor', email = 'recipient@example.com') =>
        server.call('POST', path, { cookie: admin.cookie, body: { role, email } });
    const accept = (token: string, cookie = recipient.cookie) =>
        server.call('POST', '/invitations/accept', { cookie, body: { token } });
    return { ...server, admin, recipient, path, create, accept };
}

it.each(['viewer', 'editor'])(
    'grants the invited %s role only after explicit acceptance',
    async (role) => {
        const { call, admin, recipient, create, accept, json } = await setup();
        const documents = `/workspaces/${admin.personal.id}/documents`;
        await call('POST', documents, { cookie: admin.cookie, body: { name: 'Shared document' } });
        const response = await create(role, ' Recipient@Example.com ');
        expect(response.status).toBe(201);
        expect(response.headers.get('cache-control')).toBe('no-store');
        const invitation = (await response.json()) as Invitation;
        expect(invitation.email).toBe('recipient@example.com');
        expect((await call('GET', documents, { cookie: recipient.cookie })).status).toBe(404);
        const inspected = await call('POST', '/invitations/inspect', {
            cookie: recipient.cookie,
            body: { token: invitation.token }
        });
        expect(inspected.status).toBe(200);
        expect(await inspected.json()).toMatchObject({
            workspaceName: 'Personal',
            role,
            accepted: false
        });
        expect((await call('GET', documents, { cookie: recipient.cookie })).status).toBe(404);
        expect(await json(accept(invitation.token))).toMatchObject({
            workspaceId: admin.personal.id,
            role,
            alreadyMember: false
        });
        expect(await json(call('GET', documents, { cookie: recipient.cookie }))).toHaveLength(1);
        const workspaces = await json<{ id: string }[]>(
            call('GET', '/workspaces', { cookie: recipient.cookie })
        );
        expect(workspaces[0].id).toBe(recipient.personal.id);
        expect(
            (await call('POST', documents, { cookie: recipient.cookie, body: { name: 'New' } }))
                .status
        ).toBe(role === 'editor' ? 201 : 403);
        expect(
            (
                await call('POST', `/workspaces/${admin.personal.id}/invitations`, {
                    cookie: recipient.cookie,
                    body: { email: 'other@example.com', role: 'editor' }
                })
            ).status
        ).toBe(403);
    }
);

it('keeps tokens hashed at rest and returns the plaintext only when created', async () => {
    const { db, call, admin, path, create } = await setup();
    const invitation = (await (await create()).json()) as Invitation;
    const stored = await db
        .selectFrom('workspace_invitations')
        .selectAll()
        .executeTakeFirstOrThrow();
    expect(stored.token_hash).not.toBe(invitation.token);
    expect(JSON.stringify(stored)).not.toContain(invitation.token);
    const listed = await call('GET', path, { cookie: admin.cookie });
    expect(await listed.json()).toEqual([
        expect.objectContaining({
            id: invitation.id,
            email: invitation.email,
            role: invitation.role
        })
    ]);
    expect(JSON.stringify(stored)).toContain('token_hash');
    const listedAgain = await (await call('GET', path, { cookie: admin.cookie })).text();
    expect(listedAgain).not.toContain('token_hash');
    expect(listedAgain).not.toContain(invitation.token);
});

it('hides invitations from outsiders and checks session, origin and role', async () => {
    const { call, recipient, admin, path, create, accept } = await setup();
    const outsider = recipient;
    const invitation = (await (
        await create('viewer', 'someoneelse@example.com')
    ).json()) as Invitation;
    expect((await accept(invitation.token, outsider.cookie)).status).toBe(404);
    expect(
        (
            await call('POST', '/invitations/inspect', {
                cookie: outsider.cookie,
                body: { token: invitation.token }
            })
        ).status
    ).toBe(404);
    expect((await call('GET', path, { cookie: recipient.cookie })).status).toBe(404);
    expect(
        (
            await call('POST', path, {
                cookie: recipient.cookie,
                body: { email: 'x@example.com', role: 'editor' }
            })
        ).status
    ).toBe(404);
    expect(
        (await call('POST', path, { body: { email: 'x@example.com', role: 'editor' } })).status
    ).toBe(401);
    expect(
        (
            await call('POST', path, {
                cookie: admin.cookie,
                body: { email: 'x@example.com', role: 'editor' },
                headers: { origin: 'https://other.example' }
            })
        ).status
    ).toBe(403);
    expect(
        (
            await call('POST', '/invitations/accept', {
                cookie: recipient.cookie,
                body: { token: invitation.token },
                headers: { origin: 'https://other.example' }
            })
        ).status
    ).toBe(403);
});

it('rejects admin invitations and invalid bodies', async () => {
    const { call, admin, path, create, accept } = await setup();
    expect((await create('admin')).status).toBe(400);
    for (const email of ['', 'not-email', 'x@y', `${'x'.repeat(255)}@example.com`])
        expect((await create('editor', email)).status).toBe(400);
    expect(
        (await call('POST', path, { cookie: admin.cookie, body: { email: 'x@example.com' } }))
            .status
    ).toBe(400);
    for (const token of ['', 'bad-token', 'a'.repeat(64)])
        expect((await accept(token)).status).toBe(404);
});

it('requires the recipient to have a verified email before inspecting or accepting', async () => {
    const { db, create, accept, call, recipient } = await setup();
    const invitation = (await (await create()).json()) as Invitation;
    await sql`update auth."user" set "emailVerified" = false where email = 'recipient@example.com'`.execute(
        db
    );
    for (const path of ['/invitations/inspect', '/invitations/accept']) {
        const response = await call('POST', path, {
            cookie: recipient.cookie,
            body: { token: invitation.token }
        });
        expect(response.status).toBe(403);
        expect(await response.json()).toEqual({ code: 'EMAIL_NOT_VERIFIED' });
    }
    await sql`update auth."user" set "emailVerified" = true where email = 'recipient@example.com'`.execute(
        db
    );
    expect((await accept(invitation.token)).status).toBe(200);
});

it('renews pending invitations and revokes links without granting membership', async () => {
    const { call, admin, recipient, path, create, accept } = await setup();
    const first = (await (await create()).json()) as Invitation;
    const second = (await (await create('viewer')).json()) as Invitation;
    expect((await accept(first.token)).status).toBe(404);
    expect(
        (await call('DELETE', `${path}/${second.id}`, { cookie: recipient.cookie })).status
    ).toBe(404);
    expect((await call('DELETE', `${path}/${second.id}`, { cookie: admin.cookie })).status).toBe(
        204
    );
    expect((await accept(second.token)).status).toBe(404);
    expect(
        (
            await call('GET', `/workspaces/${admin.personal.id}/documents`, {
                cookie: recipient.cookie
            })
        ).status
    ).toBe(404);
});

it('rejects expired invitations and those whose creator can no longer administer the workspace', async () => {
    const { db, create, accept, admin } = await setup();
    const expired = (await (await create()).json()) as Invitation;
    await db
        .updateTable('workspace_invitations')
        .set({ expires_at: new Date(0) })
        .where('id', '=', expired.id)
        .execute();
    expect((await accept(expired.token)).status).toBe(404);
    const stale = (await (await create()).json()) as Invitation;
    await db
        .updateTable('workspace_members')
        .set({ role: 'viewer' })
        .where('workspace_id', '=', admin.personal.id)
        .execute();
    expect((await accept(stale.token)).status).toBe(404);
});

it('accepts retries concurrently without duplicating membership or restoring removed access', async () => {
    const { db, create, accept, admin, json, call, recipient: account } = await setup();
    const invitation = (await (await create()).json()) as Invitation;
    const responses = await Promise.all([accept(invitation.token), accept(invitation.token)]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(await json(accept(invitation.token))).toMatchObject({
        alreadyMember: true,
        role: 'editor'
    });
    expect(
        await json(
            call('POST', '/invitations/inspect', {
                cookie: account.cookie,
                body: { token: invitation.token }
            })
        )
    ).toMatchObject({ accepted: true, role: 'editor' });
    const members = await db
        .selectFrom('workspace_members')
        .selectAll()
        .where('workspace_id', '=', admin.personal.id)
        .execute();
    expect(members).toHaveLength(2);
    const recipient = members.find((member) => member.role === 'editor')!;
    await db
        .deleteFrom('workspace_members')
        .where('workspace_id', '=', admin.personal.id)
        .where('user_id', '=', recipient.user_id)
        .execute();
    expect((await accept(invitation.token)).status).toBe(404);
    expect(
        (
            await call('POST', '/invitations/inspect', {
                cookie: account.cookie,
                body: { token: invitation.token }
            })
        ).status
    ).toBe(404);
});

it('does not disclose an accepted invitation to another account with the same email', async () => {
    const { db, create, accept, user, call } = await setup();
    const invitation = (await (await create()).json()) as Invitation;
    expect((await accept(invitation.token)).status).toBe(200);
    await sql`update auth."user" set email = 'previous@example.com' where email = 'recipient@example.com'`.execute(
        db
    );
    const replacement = await user('recipient@example.com');
    expect((await accept(invitation.token, replacement.cookie)).status).toBe(404);
    expect(
        (
            await call('POST', '/invitations/inspect', {
                cookie: replacement.cookie,
                body: { token: invitation.token }
            })
        ).status
    ).toBe(404);
});

it('does not downgrade an existing admin when accepting an invitation', async () => {
    const { create, accept, admin, db } = await setup();
    const invitation = (await (await create('viewer', 'admin@example.com')).json()) as Invitation;
    expect(await (await accept(invitation.token, admin.cookie)).json()).toMatchObject({
        role: 'admin',
        alreadyMember: true
    });
    const rows = await sql<{
        role: string;
    }>`select role from workspace_members where workspace_id = ${admin.personal.id}`.execute(db);
    expect(rows.rows).toEqual([{ role: 'admin' }]);
});
