import { IDBFactory } from 'fake-indexeddb';
import type { Accounts } from 'src/app/services/accounts';
import { DocumentDatabase, deleteDocumentDatabase } from 'src/app/services/documentDatabase';
import { accountCopy } from 'src/app/services/documentSync';
import { signOut, waitForSync } from 'src/app/services/signOut';
import { createTestStore } from './support/store';

const copy = accountCopy('user-ada');

/** A server where Ada is signed in; `signedOut` says whether signing out succeeds. */
const server = (signedOut = true): Accounts => ({
    session: async () => ({ id: 'user-ada', name: 'Ada', email: 'ada@example.com' }),
    signIn: async () => ({ ok: true }),
    signUp: async () => ({ ok: true }),
    sendSignInLink: async () => ({ ok: true }),
    signOut: vi.fn(async () =>
        signedOut ? { ok: true as const } : { ok: false as const, message: 'Try again.' }
    )
});

/**
 * A browser holding Ada's copy of her documents, the documents kept signed out,
 * and another copy of the editor with Ada's database open.
 */
async function browser(accounts = server()) {
    const indexedDB = new IDBFactory();
    const storage = new Map([
        [copy.viewKey, '{}'],
        [copy.recordKey, '{"unsent":[],"deleting":[]}'],
        ['reactor:notices', '["first"]']
    ]);
    const open = await DocumentDatabase.open(indexedDB, copy.database);

    await open.create('plan', new Uint8Array([0, 0]));
    await (await DocumentDatabase.open(indexedDB)).create('sketch', new Uint8Array([0, 0]));

    const effects = {
        accounts,
        removeState: (key: string) => {
            storage.delete(key);
        },
        deleteDocumentDatabase: (name: string) => deleteDocumentDatabase(name, indexedDB),
        recordSignedOut: vi.fn(),
        reload: vi.fn()
    };
    const databases = async () => (await indexedDB.databases()).map(({ name }) => name);

    return { effects, storage, databases };
}

describe('signing out', () => {
    it('removes the account’s copy of its documents from the browser, and loads again signed out', async () => {
        const { effects, storage, databases } = await browser();

        expect(await signOut(effects, 'user-ada', async () => undefined)).toEqual({ ok: true });

        expect(effects.accounts.signOut).toHaveBeenCalledOnce();
        expect([...storage.keys()]).toEqual(['reactor:notices']);
        expect(await databases()).toEqual(['reactor']);
        expect(effects.recordSignedOut).toHaveBeenCalledOnce();
        expect(effects.reload).toHaveBeenCalledWith('/');
    });

    it('says what would be lost instead of signing out, unless asked to anyway', async () => {
        const { effects, storage, databases } = await browser();
        const unsynced = async () => 'The server cannot be reached.';

        expect(await signOut(effects, 'user-ada', unsynced)).toEqual({
            ok: false,
            unsynced: 'The server cannot be reached.'
        });
        expect(effects.accounts.signOut).not.toHaveBeenCalled();
        expect(storage.size).toBe(3);
        expect(await databases()).toContain(copy.database);

        expect(await signOut(effects, 'user-ada', unsynced, true)).toEqual({ ok: true });
        expect(await databases()).toEqual(['reactor']);
    });

    it('keeps everything when the server does not sign out', async () => {
        const { effects, storage, databases } = await browser(server(false));

        expect(await signOut(effects, 'user-ada', async () => undefined)).toEqual({
            ok: false,
            message: 'Try again.'
        });
        expect(storage.size).toBe(3);
        expect(await databases()).toContain(copy.database);
        expect(effects.reload).not.toHaveBeenCalled();
    });

    it('waits for changes on their way to the server, and says what is lost if they stay', async () => {
        const { store } = createTestStore();

        store.actions.setSaveStatus({ kind: 'syncing' });

        const waiting = waitForSync(store.reaction, 5000);

        store.actions.setSaveStatus({ kind: 'saved' });
        expect(await waiting).toBeUndefined();

        store.actions.setSaveStatus({ kind: 'offline' });
        expect(await waitForSync(store.reaction, 5000)).toMatch(/cannot be reached/);

        vi.useFakeTimers();
        store.actions.setSaveStatus({ kind: 'syncing' });

        const stuck = waitForSync(store.reaction, 5000);

        vi.advanceTimersByTime(5000);
        vi.useRealTimers();
        expect(await stuck).toMatch(/on their way/);
    });
});
