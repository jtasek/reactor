import { sql } from 'kysely';
import { serve } from './support';

async function setup(role = 'editor') {
    const server = await serve();
    const admin = await server.user('admin@example.com');
    const member = await server.user('member@example.com');
    const rows = await sql<{
        id: string;
    }>`select id from auth."user" where email = 'member@example.com'`.execute(server.db);
    const id = rows.rows[0].id;
    await server.db
        .insertInto('workspace_members')
        .values({
            workspace_id: admin.personal.id,
            user_id: id,
            role: role as 'editor' | 'viewer' | 'admin'
        })
        .execute();
    return { ...server, admin, member, id, path: `/workspaces/${admin.personal.id}/members` };
}

it('lists members only to admins and changes editor/viewer access without changing other workspaces', async () => {
    const { call, json, admin, member, id, path } = await setup();
    const listed = await call('GET', path, { cookie: admin.cookie });
    expect(listed.headers.get('cache-control')).toBe('no-store');
    expect(await listed.json()).toEqual([
        expect.objectContaining({ email: 'admin@example.com', owner: true, role: 'admin' }),
        expect.objectContaining({ id, email: 'member@example.com', owner: false, role: 'editor' })
    ]);
    expect((await call('GET', path, { cookie: member.cookie })).status).toBe(403);
    expect(
        (await call('PATCH', `${path}/${id}`, { cookie: member.cookie, body: { role: 'viewer' } }))
            .status
    ).toBe(403);
    for (const role of ['viewer', 'editor']) {
        expect(
            (await call('PATCH', `${path}/${id}`, { cookie: admin.cookie, body: { role } })).status
        ).toBe(204);
        const spaces = await json<{ id: string; role: string }[]>(
            call('GET', '/workspaces', { cookie: member.cookie })
        );
        expect(spaces.find((space) => space.id === admin.personal.id)?.role).toBe(role);
        expect(spaces.find((space) => space.id === member.personal.id)?.role).toBe('admin');
    }
});

it('protects admin memberships and rejects invalid roles, outsiders and foreign origins', async () => {
    const { call, admin, member, id, path } = await setup('admin');
    expect(
        (await call('PATCH', `${path}/${id}`, { cookie: admin.cookie, body: { role: 'viewer' } }))
            .status
    ).toBe(403);
    expect((await call('DELETE', `${path}/${id}`, { cookie: admin.cookie })).status).toBe(403);
    for (const role of ['admin', '', null])
        expect(
            (await call('PATCH', `${path}/${id}`, { cookie: admin.cookie, body: { role } })).status
        ).toBe(400);
    expect((await call('DELETE', `${path}/missing`, { cookie: admin.cookie })).status).toBe(404);
    expect(
        (await call('GET', `/workspaces/${member.personal.id}/members`, { cookie: admin.cookie }))
            .status
    ).toBe(404);
    expect((await call('GET', path)).status).toBe(401);
    expect(
        (
            await call('DELETE', `${path}/${id}`, {
                cookie: admin.cookie,
                headers: { origin: 'https://other.example' }
            })
        ).status
    ).toBe(403);
    const members = (await (await call('GET', path, { cookie: admin.cookie })).json()) as {
        id: string;
        owner: boolean;
    }[];
    const owner = members.find((person) => person.owner)!;
    expect((await call('DELETE', `${path}/${owner.id}`, { cookie: member.cookie })).status).toBe(
        403
    );
});

it('removes membership and pending invitations so old links cannot restore access', async () => {
    const { call, admin, member, id, path, json } = await setup();
    const invitation = await json<{ token: string }>(
        call('POST', `/workspaces/${admin.personal.id}/invitations`, {
            cookie: admin.cookie,
            body: { email: 'member@example.com', role: 'editor' }
        })
    );
    expect((await call('DELETE', `${path}/${id}`, { cookie: admin.cookie })).status).toBe(204);
    expect(
        (await call('GET', `/workspaces/${admin.personal.id}/documents`, { cookie: member.cookie }))
            .status
    ).toBe(404);
    expect(
        (
            await call('POST', '/invitations/accept', {
                cookie: member.cookie,
                body: { token: invitation.token }
            })
        ).status
    ).toBe(404);
    expect(
        (
            await call('GET', `/workspaces/${member.personal.id}/documents`, {
                cookie: member.cookie
            })
        ).status
    ).toBe(200);
});
