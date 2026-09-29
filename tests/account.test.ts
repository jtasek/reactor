import { accounts, readAccount, type AccountUser, type Accounts } from 'src/app/services/accounts';
import { createTestStore } from './support/store';

/** A server with accounts, where `user` is signed in and `correct horse` is the password. */
function server(user: AccountUser | null = null): Accounts {
    let current = user;

    return {
        session: async () => current,
        signIn: async (email, password) => {
            if (password !== 'correct horse') {
                return { ok: false, message: 'The email address or password is wrong.' };
            }

            current = { name: 'Ada', email };

            return { ok: true };
        },
        signUp: async () => ({ ok: true }),
        sendSignInLink: async () => ({ ok: true }),
        signOut: async () => {
            current = null;

            return { ok: true };
        }
    };
}

/** Starts a copy of the editor against `accounts`, on a browser holding `storage`. */
async function start(accounts: Accounts, seed: Record<string, string> = {}) {
    const test = createTestStore(seed, { accounts });

    await test.store.onInitialize();
    // The notices come once startup has ended.
    await new Promise((resolve) => setTimeout(resolve));

    return test;
}

const notices = ({ store }: Pick<ReturnType<typeof createTestStore>, 'store'>) =>
    store.state.notifications.filter(({ type }) => type === 'info');

describe('accounts', () => {
    it('shows who is signed in, and no accounts where the server has none', async () => {
        expect(
            (await start(server({ name: 'Ada', email: 'ada@example.com' }))).store.state.account
        ).toEqual({
            kind: 'signedIn',
            name: 'Ada',
            email: 'ada@example.com'
        });
        expect((await start(server())).store.state.account).toEqual({ kind: 'signedOut' });
        expect(
            (await start({ ...server(), session: async () => undefined })).store.state.account
        ).toEqual({
            kind: 'unavailable'
        });
        expect(
            (
                await start({
                    ...server(),
                    session: async () => {
                        throw new Error('Offline');
                    }
                })
            ).store.state.account
        ).toEqual({ kind: 'unavailable' });
    });

    it('reads who is signed in once signing in succeeds, and no one after signing out', async () => {
        const accounts = server();

        expect(await accounts.signIn('ada@example.com', 'wrong')).toEqual({
            ok: false,
            message: 'The email address or password is wrong.'
        });
        expect(await readAccount(accounts)).toEqual({ kind: 'signedOut' });

        expect(await accounts.signIn('ada@example.com', 'correct horse')).toEqual({ ok: true });
        expect(await readAccount(accounts)).toEqual({
            kind: 'signedIn',
            name: 'Ada',
            email: 'ada@example.com'
        });

        await accounts.signOut();

        expect(await readAccount(accounts)).toEqual({ kind: 'signedOut' });
    });
});

describe('signed-out notices', () => {
    it('says once that documents are kept only in this browser, with a link to sign in', async () => {
        const first = await start(server());

        expect(notices(first)).toEqual([
            expect.objectContaining({
                message:
                    'Your documents are kept only in this browser and are lost if its site data is cleared.',
                link: { label: 'Sign in to keep them', url: '/account' }
            })
        ]);

        const later = await start(server(), Object.fromEntries(first.storage));

        expect(notices(later)).toEqual([]);
    });

    it('says it again once the browser holds 3 documents', async () => {
        const { store } = await start(server());

        store.actions.addDocument({ id: 'second' });
        await Promise.resolve();
        expect(notices({ store })).toHaveLength(1);

        store.actions.addDocument({ id: 'third' });
        store.actions.addDocument({ id: 'fourth' });
        await vi.waitFor(() => expect(notices({ store })).toHaveLength(2));
    });

    it('says nothing to someone signed in, and offers no sign-in without accounts', async () => {
        expect(notices(await start(server({ name: 'Ada', email: 'ada@example.com' })))).toEqual([]);
        expect(notices(await start({ ...server(), session: async () => undefined }))).toEqual([
            expect.objectContaining({ link: undefined })
        ]);
    });

    it('can be dismissed', async () => {
        const { store } = await start(server());
        const [notice] = store.state.notifications;

        store.actions.dismissNotification(notice.id);

        expect(store.state.notifications).toEqual([]);
    });
});

describe('account requests', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    const respond = (status: number, body: unknown) =>
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response(JSON.stringify(body), { status }))
        );

    it('explains why a request failed', async () => {
        respond(401, { code: 'INVALID_EMAIL_OR_PASSWORD' });
        expect(await accounts.signIn('ada@example.com', 'wrong')).toEqual({
            ok: false,
            message: 'The email address or password is wrong.'
        });

        respond(403, { code: 'EMAIL_NOT_VERIFIED' });
        expect(await accounts.signIn('ada@example.com', 'correct horse')).toEqual({
            ok: false,
            message: 'Confirm your email address first, with the link we sent you.'
        });

        respond(429, {});
        expect(await accounts.sendSignInLink('ada@example.com')).toEqual({
            ok: false,
            message: 'Too many attempts. Try again in a minute.'
        });

        vi.stubGlobal(
            'fetch',
            vi.fn(async () => {
                throw new TypeError('Failed to fetch');
            })
        );
        expect(await accounts.signOut()).toEqual({
            ok: false,
            message: 'The server could not be reached. Try again.'
        });
    });

    it('reads the session, and no accounts from a server without them', async () => {
        respond(200, { user: { name: 'Ada', email: 'ada@example.com', id: 'u1' } });
        expect(await accounts.session()).toEqual({ name: 'Ada', email: 'ada@example.com' });

        respond(200, null);
        expect(await accounts.session()).toBeNull();

        respond(404, { code: 'NOT_FOUND' });
        expect(await accounts.session()).toBeUndefined();
    });
});
