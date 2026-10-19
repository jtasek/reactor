import { sql } from 'kysely';
import { ORIGIN, cookieHeader, findLink, startAccounts } from './support';

const account = { email: 'ada@example.com', password: 'correct horse battery', name: 'Ada' };

let client = 0;

async function registered() {
    const context = await startAccounts();
    const address = `192.0.2.${++client}`;
    const request: typeof context.request = (path, options) =>
        context.request(path, {
            ...options,
            headers: { ...options?.headers, 'x-reactor-client-address': address }
        });
    await request('/api/auth/sign-up/email', { body: account });
    const verified = await request(findLink(context.outbox[0]));

    return { ...context, request, cookie: cookieHeader(verified) };
}

it('resets once, revokes existing sessions and requires signing in with the new password', async () => {
    const { request, outbox, cookie } = await registered();
    const result = await request('/api/auth/request-password-reset', {
        body: { email: account.email, redirectTo: '/reset-password?returnTo=%2Finvite' }
    });
    expect(result.ok).toBe(true);
    const link = new URL(findLink(outbox[1]));
    expect(link.origin).toBe(ORIGIN);
    expect(link.pathname).toBe('/reset-password');
    expect(link.searchParams.get('returnTo')).toBe('/invite');
    expect(link.hash).not.toBe('');
    const body = { token: link.hash.slice(1), newPassword: 'replacement password' };
    const reset = await request('/api/auth/reset-password', { body });
    expect(reset.ok).toBe(true);
    expect(cookieHeader(reset)).toBe('');
    expect(await (await request('/api/auth/get-session', { cookie })).json()).toBeNull();
    expect((await request('/api/auth/reset-password', { body })).ok).toBe(false);
    expect((await request('/api/auth/sign-in/email', { body: account })).ok).toBe(false);
    expect(
        (
            await request('/api/auth/sign-in/email', {
                body: { ...account, password: body.newPassword }
            })
        ).ok
    ).toBe(true);
});

it('returns the same response for unknown addresses without sending mail', async () => {
    const { request, outbox } = await registered();
    const known = await request('/api/auth/request-password-reset', {
        body: { email: account.email }
    });
    const unknown = await request('/api/auth/request-password-reset', {
        body: { email: 'unknown@example.com' }
    });
    expect(unknown.status).toBe(known.status);
    expect(await unknown.json()).toEqual(await known.json());
    expect(outbox).toHaveLength(2);
});

it('rejects expired reset links and cross-origin reset requests', async () => {
    const { request, outbox, db, cookie } = await registered();
    await request('/api/auth/request-password-reset', { body: { email: account.email } });
    const token = new URL(findLink(outbox[1])).hash.slice(1);
    const body = { token, newPassword: 'replacement password' };
    expect(
        (await request('/api/auth/reset-password', { body, cookie, origin: 'https://evil.test' }))
            .status
    ).toBe(403);
    await sql`update auth.verification set "expiresAt" = now() - interval '1 hour' where identifier = ${`reset-password:${token}`}`.execute(
        db
    );
    expect((await request('/api/auth/reset-password', { body })).ok).toBe(false);
    expect((await request('/api/auth/sign-in/email', { body: account })).ok).toBe(true);
});
