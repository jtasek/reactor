import { sql } from 'kysely';
import { FEEDBACK_LIMITS } from '../../server/feedback';
import { FEEDBACK_MAX_LENGTH } from '../../src/shared/feedback';
import { serve } from './support';

const TOKEN = 'feedback-test-token';

type Served = Awaited<ReturnType<typeof serve>>;

const send = (served: Served, cookie: string | undefined, body: object) =>
    served.call('POST', '/feedback', { cookie, body });

const listed = async (served: Served) =>
    (await (
        await fetch(`${served.address}/metrics/feedback`, {
            headers: { authorization: `Bearer ${TOKEN}` }
        })
    ).json()) as {
        sentAt: string;
        email: string;
        page: string;
        release: string;
        message: string;
    }[];

describe('sending feedback from the editor', () => {
    it('keeps a signed-in message with its page and version, newest first behind the token', async () => {
        const served = await serve({ metricsToken: TOKEN });
        const ada = await served.user('ada@example.com');
        const bea = await served.user('bea@example.com');

        expect(
            (
                await send(served, ada.cookie, {
                    message: '  The Share button is hard to find.  ',
                    page: '/designer',
                    release: '34'
                })
            ).status
        ).toBe(204);
        expect((await send(served, bea.cookie, { message: 'Love it' })).status).toBe(204);

        const [newest, oldest] = await listed(served);

        expect(newest).toMatchObject({ email: 'bea@example.com', message: 'Love it', page: '' });
        expect(oldest).toMatchObject({
            email: 'ada@example.com',
            message: 'The Share button is hard to find.',
            page: '/designer',
            release: '34'
        });
        expect(served.metrics.render()).toContain('reactor_feedback_total 2');

        const unauthorized = await fetch(`${served.address}/metrics/feedback`);

        expect(unauthorized.status).toBe(401);
    });

    it('refuses signed-out, empty, too long and too frequent messages', async () => {
        const served = await serve({ metricsToken: TOKEN });
        const { cookie } = await served.user('ada@example.com');

        expect((await send(served, undefined, { message: 'Hello' })).status).toBe(401);
        expect((await send(served, cookie, { message: '   ' })).status).toBe(400);
        expect((await send(served, cookie, { message: 7 })).status).toBe(400);
        expect(
            (await send(served, cookie, { message: 'x'.repeat(FEEDBACK_MAX_LENGTH + 1) })).status
        ).toBe(400);

        for (let sent = 0; sent < FEEDBACK_LIMITS.perAccount; sent++) {
            expect((await send(served, cookie, { message: `Note ${sent}` })).status).toBe(204);
        }

        const over = await send(served, cookie, { message: 'One more' });

        expect(over.status).toBe(429);
        expect(await over.json()).toEqual({ code: 'TOO_MUCH_FEEDBACK' });
        expect(await listed(served)).toHaveLength(FEEDBACK_LIMITS.perAccount);
    });

    it('refuses an account that has not agreed to the current terms', async () => {
        const served = await serve();
        const { cookie } = await served.user('ada@example.com');

        await sql`update auth."user" set "legalVersion" = null`.execute(served.db);

        expect((await send(served, cookie, { message: 'Hello' })).status).toBe(403);
    });

    it('deletes what an account sent when the account is deleted', async () => {
        const served = await serve({ metricsToken: TOKEN });
        const { cookie } = await served.user('ada@example.com');

        await send(served, cookie, { message: 'Hello' });
        expect((await served.call('POST', '/auth/delete-user', { cookie, body: {} })).status).toBe(
            200
        );

        expect(await served.db.selectFrom('feedback').selectAll().execute()).toEqual([]);
    });
});
