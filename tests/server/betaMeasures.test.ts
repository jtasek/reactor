import { sql } from 'kysely';
import { serve, type DocumentSummary } from './support';

const PREVIEW = 'https://app.prototype.test';
const TOKEN = 'a metrics token for the tests';
const PLAYER_A = 'player-a-0123456789abcdef';
const PLAYER_B = 'player-b-0123456789abcdef';
const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

interface Week {
    week: string;
    signUps: number;
    activated: number;
    signUpsFinal: boolean;
    sessionsByOthers: number;
    sessionsByAuthors: number;
    linksPlayedByOthers: number;
}

const screen = (id: string) => ({ id, name: id, x: 0, y: 0, width: 390, height: 844, nodes: [] });

async function setup() {
    let clock = Date.now();
    const server = await serve({
        previewOrigin: PREVIEW,
        metricsToken: TOKEN,
        now: () => new Date(clock)
    });
    const person = async (email: string) => {
        const account = await server.user(email);
        const document = await server.json<DocumentSummary>(
            server.call('POST', `/workspaces/${account.personal.id}/documents`, {
                cookie: account.cookie,
                body: { name: 'App' }
            })
        );
        const share = async (screens: string[]) => {
            const response = await server.call(
                'POST',
                `/documents/${document.id}/prototype-links`,
                {
                    cookie: account.cookie,
                    body: {
                        name: 'Shared',
                        application: {
                            documentId: document.id,
                            images: {},
                            screens: screens.map(screen)
                        }
                    }
                }
            );
            const link = (await response.json()) as { id: string; url: string };

            return { ...link, token: new URL(link.url).hash.slice(1) };
        };
        /** Moves the account's sign-up `by` milliseconds earlier. */
        const signedUpEarlier = (by: number) =>
            sql`update auth."user" set "createdAt" = "createdAt" - make_interval(secs => ${by / 1000})
                where email = ${email}`.execute(server.db);

        return { ...account, share, signedUpEarlier };
    };
    const open = (token: string, player?: string) =>
        server.call('POST', '/prototype-links/open', {
            body: { token, player },
            headers: { origin: PREVIEW }
        });
    const read = (path: string) =>
        fetch(`${server.address}${path}`, { headers: { authorization: `Bearer ${TOKEN}` } });
    const weeks = async () => (await (await read('/metrics/beta')).json()) as Week[];
    const total = (rows: Week[], field: 'signUps' | 'activated') =>
        rows.reduce((sum, row) => sum + row[field], 0);

    return {
        ...server,
        person,
        open,
        read,
        weeks,
        total,
        advance: (by: number) => {
            clock += by;
        }
    };
}

describe('prototype sessions', () => {
    it('counts a browser’s opens of a link as one session until half an hour passes', async () => {
        const server = await setup();
        const designer = await server.person('designer@example.com');
        const link = await designer.share(['home', 'details']);

        await server.open(link.token, PLAYER_A);
        server.advance(10 * MINUTE);
        await server.open(link.token, PLAYER_A);
        server.advance(29 * MINUTE);
        await server.open(link.token, PLAYER_A);
        server.advance(31 * MINUTE);
        await server.open(link.token, PLAYER_A);
        await server.open(link.token, PLAYER_B);
        // A browser that keeps nothing is shown the prototype but runs no counted session.
        await server.open(link.token);

        const rows = await server.db
            .selectFrom('prototype_sessions')
            .select(['player', 'by_author'])
            .execute();
        expect(rows).toHaveLength(3);
        expect(rows.every((row) => !row.by_author)).toBe(true);
        const metrics = await (await server.read('/metrics')).text();
        expect(metrics).toContain('reactor_prototype_sessions_total{by="others"} 3');
    });

    it('reports sessions in the week they started, newest week first', async () => {
        const server = await setup();
        const designer = await server.person('designer@example.com');
        const first = await designer.share(['home', 'details']);
        const second = await designer.share(['home']);

        server.advance(-7 * DAY);
        await server.open(first.token, PLAYER_A);
        server.advance(7 * DAY);
        await server.open(first.token, PLAYER_A);
        await server.open(second.token, PLAYER_A);
        await server.open(second.token, PLAYER_B);

        const [thisWeek, lastWeek, ...earlier] = await server.weeks();
        expect(earlier).toHaveLength(10);
        expect(new Date(thisWeek.week).getUTCDay()).toBe(1);
        expect(new Date(lastWeek.week).getTime()).toBe(new Date(thisWeek.week).getTime() - 7 * DAY);
        expect(thisWeek).toEqual(
            expect.objectContaining({
                sessionsByOthers: 3,
                sessionsByAuthors: 0,
                linksPlayedByOthers: 2
            })
        );
        expect(lastWeek).toEqual(
            expect.objectContaining({ sessionsByOthers: 1, linksPlayedByOthers: 1 })
        );
        expect(earlier.every((week) => week.sessionsByOthers === 0)).toBe(true);
    });
});

describe('new people who share a prototype', () => {
    it('counts sign-ups that share two screens or more within a day', async () => {
        const server = await setup();
        const quick = await server.person('quick@example.com');
        await quick.share(['home', 'details']);
        const oneScreen = await server.person('one-screen@example.com');
        await oneScreen.share(['home']);
        const slow = await server.person('slow@example.com');
        await slow.signedUpEarlier(DAY + MINUTE);
        await slow.share(['home', 'details']);
        await server.person('silent@example.com');

        const rows = await server.weeks();
        expect(server.total(rows, 'signUps')).toBe(4);
        expect(server.total(rows, 'activated')).toBe(1);
        // This week's sign-ups may still share within their day.
        expect(rows[0].signUpsFinal).toBe(false);
        expect(rows[2].signUpsFinal).toBe(true);
    });

    it('is read only with the metrics token', async () => {
        const server = await setup();

        const response = await fetch(`${server.address}/metrics/beta`, {
            headers: { authorization: 'Bearer wrong' }
        });
        expect(response.status).toBe(401);
    });
});
