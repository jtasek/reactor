import type { AccountUser, Accounts } from 'src/app/services/accounts';
import type { Api } from 'src/app/services/api';
import { createTestStore } from './support/store';

const ADA: AccountUser = { id: 'user-ada', name: 'Ada', email: 'ada@example.com' };

const unreachable = () => Promise.reject(new Error('The server cannot be reached'));

/** Starts the editor with `user` signed in, or nobody, on a server answering AI with `ai`. */
async function start(user: AccountUser | null, ai: boolean) {
    const accounts: Accounts = {
        session: async () => user,
        signIn: unreachable,
        signUp: unreachable,
        sendSignInLink: unreachable,
        signOut: unreachable
    };
    const aiAvailable = vi.fn(async () => ai);
    const api: Api = {
        workspaces: async () => [],
        documents: unreachable,
        createDocument: unreachable,
        deleteDocument: unreachable,
        aiAvailable
    };
    const { store } = createTestStore({}, { accounts, api });

    await store.onInitialize();
    // The server is asked once startup has ended.
    await new Promise((resolve) => setTimeout(resolve));

    return { ai: store.state.ai, aiAvailable };
}

describe('AI availability', () => {
    it('is available to people signed in when the server offers it', async () => {
        expect((await start(ADA, true)).ai).toBe('available');
    });

    it('is unavailable when the server has no AI', async () => {
        expect((await start(ADA, false)).ai).toBe('unavailable');
    });

    it('is unavailable signed out, without asking the server', async () => {
        const { ai, aiAvailable } = await start(null, true);

        expect(ai).toBe('unavailable');
        expect(aiAvailable).not.toHaveBeenCalled();
    });
});
