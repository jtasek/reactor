import { sql } from 'kysely';
import { serve } from './support';
import { createMemberService } from '../../server/services/members';
import { workspaceRole } from '../../server/workspaces';

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

it('enforces permissions and protects admins when the service is called without HTTP middleware', async () => {
    const { db, admin, member, id } = await setup();
    const changed = vi.fn(async () => {});
    const service = createMemberService(db, changed, { warn: vi.fn() });
    const workspaceId = admin.personal.id;
    const workspace = await db
        .selectFrom('workspaces')
        .select('owner_id')
        .where('id', '=', workspaceId)
        .executeTakeFirstOrThrow();
    const actorId = workspace.owner_id!;
    const target = { actorId: id, workspaceId, userId: id };
    expect(await service.list(target)).toEqual({ ok: false, problem: 'FORBIDDEN' });
    expect(await service.setRole(target, 'viewer')).toEqual({ ok: false, problem: 'FORBIDDEN' });
    expect(await service.remove(target)).toEqual({ ok: false, problem: 'FORBIDDEN' });
    expect(await service.list({ actorId, workspaceId: member.personal.id })).toEqual({
        ok: false,
        problem: 'NOT_FOUND'
    });
    expect(await service.list({ actorId, workspaceId })).toMatchObject({
        ok: true,
        members: expect.any(Array)
    });
    expect(await service.remove({ actorId, workspaceId, userId: actorId })).toEqual({
        ok: false,
        problem: 'PROTECTED_MEMBER'
    });
    expect(await service.setRole({ actorId, workspaceId, userId: id }, 'admin')).toEqual({
        ok: false,
        problem: 'INVALID_ROLE'
    });
    expect(await workspaceRole(db, id, workspaceId)).toBe('editor');
    expect(changed).not.toHaveBeenCalled();
});

it('retries connection cleanup after commit and reports success even when cleanup stays unavailable', async () => {
    const { db, admin, id } = await setup();
    const workspaceId = admin.personal.id;
    const workspace = await db
        .selectFrom('workspaces')
        .select('owner_id')
        .where('id', '=', workspaceId)
        .executeTakeFirstOrThrow();
    const input = { actorId: workspace.owner_id!, workspaceId, userId: id };
    const unavailable = new Error('Sync unavailable');
    const observedRoles: unknown[] = [];
    const changed = vi.fn(async (): Promise<void> => {
        observedRoles.push(await workspaceRole(db, id, workspaceId));
        throw unavailable;
    });
    const log = { warn: vi.fn() };
    const service = createMemberService(db, changed, log);
    expect(await service.setRole(input, 'viewer')).toEqual({ ok: true });
    expect(changed).toHaveBeenCalledTimes(2);
    expect(observedRoles).toEqual(['viewer', 'viewer']);
    expect(log.warn).toHaveBeenCalledTimes(2);
    expect(await workspaceRole(db, id, workspaceId)).toBe('viewer');

    changed.mockImplementationOnce(async () => {
        throw unavailable;
    });
    changed.mockImplementationOnce(async () => {});
    expect(await service.remove(input)).toEqual({ ok: true });
    expect(changed).toHaveBeenCalledTimes(4);
    expect(log.warn).toHaveBeenCalledTimes(3);
    expect(await workspaceRole(db, id, workspaceId)).toBeUndefined();
});
