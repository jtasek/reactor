import type { AccountUser, Accounts } from 'src/app/services/accounts';
import type { Api } from 'src/app/services/api';
import type { LocalAi } from 'src/app/services/localAi';
import { createTestStore } from './support/store';

const ADA: AccountUser = { id: 'user-ada', name: 'Ada', email: 'ada@example.com' };

const unreachable = () => Promise.reject(new Error('The server cannot be reached'));

/** Starts the editor with `user` signed in, or nobody, on a server answering AI with `ai`. */
async function start(user: AccountUser | null, ai: boolean, localAi: LocalAi = 'never') {
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
    const { store } = createTestStore({}, { accounts, api, localAi });

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

describe('the local test model', () => {
    it('answers when asked for with ?ai=local, even with the server offering AI', async () => {
        expect((await start(ADA, true, 'always')).ai).toBe('local');
        expect((await start(null, false, 'always')).ai).toBe('local');
    });

    it('answers in development only where the server offers no AI', async () => {
        expect((await start(ADA, true, 'withoutServer')).ai).toBe('available');
        expect((await start(ADA, false, 'withoutServer')).ai).toBe('local');
        expect((await start(null, true, 'withoutServer')).ai).toBe('local');
    });
});

describe('the workspace AI switch', () => {
    it('hides AI entries in documents whose workspace has AI off', async () => {
        const { EditWithWordsCommand } = await import('src/commands/ai');
        const { aiOffered } = await import('src/app/aiAccess');
        const { store } = createTestStore();
        const id = store.state.currentDocumentId;
        const context = { state: store.state, actions: store.actions } as unknown as Parameters<
            NonNullable<typeof EditWithWordsCommand.canExecute>
        >[0];

        store.actions.setAiAvailability('available');
        store.actions.setDocumentAccess({ [id]: { workspaceId: 'team', role: 'editor' } });
        expect(aiOffered(store.state)).toBe(true);
        expect(EditWithWordsCommand.canExecute?.(context)).toBe(true);

        store.actions.setDocumentAccess({
            [id]: { workspaceId: 'team', role: 'editor', aiOff: true }
        });
        expect(aiOffered(store.state)).toBe(false);
        expect(EditWithWordsCommand.canExecute?.(context)).toBe(false);

        // Another workspace's document still offers AI.
        store.actions.newDocument();
        expect(aiOffered(store.state)).toBe(true);
    });
});
