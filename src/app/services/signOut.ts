import type { Context } from '../index';
import type { SaveStatus } from '../types';
import type { AccountResult } from './accounts';
import { accountCopy } from './documentSync';

/** How long signing out waits for changes still on their way to the server. */
const SYNC_WAIT = 5000;

/** How long it waits for the other open copies to let go of the account's database. */
const CLEAR_WAIT = 3000;

/** How signing out ended; `unsynced` says why changes would be lost by signing out now. */
export type SignOutResult = AccountResult | { ok: false; unsynced: string };

type Effects = Pick<
    Context['effects'],
    'accounts' | 'removeState' | 'deleteDocumentDatabase' | 'recordSignedOut' | 'reload'
>;

/** What would be lost by leaving while documents are in `status`. */
function unsyncedChanges(status: SaveStatus): string | undefined {
    switch (status.kind) {
        case 'saved':
            return undefined;
        case 'saving':
            return 'Changes are still being saved in this browser.';
        case 'syncing':
            return 'Changes are still on their way to the server.';
        case 'offline':
            return 'The server cannot be reached, so changes made while it could not are not on it.';
        case 'notSaving':
            return status.reason;
    }
}

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

/**
 * Waits up to `wait` milliseconds for changes being saved or synced to finish;
 * resolves with what would still be lost by leaving, or `undefined` once nothing would.
 */
export async function waitForSync(reaction: Context['reaction'], wait: number) {
    let lost: string | undefined;
    let settle: () => void = () => {};
    const settled = new Promise<void>((resolve) => (settle = resolve));
    const stop = reaction(
        ({ saveStatus }) => ({
            pending: saveStatus.kind === 'saving' || saveStatus.kind === 'syncing',
            lost: unsyncedChanges(saveStatus)
        }),
        (current) => {
            lost = current.lost;

            if (!current.pending) {
                settle();
            }
        },
        { immediate: true }
    );

    await Promise.race([settled, delay(wait)]);
    stop();

    return lost;
}

/**
 * Signs `owner` out of this browser. Unless `anyway`, it first waits for changes
 * still on their way to the server; `unsynced` says why some would be lost, and
 * then nothing is done. Once signed out, the account's copy of its documents is
 * removed from the browser, so a shared computer shows them to no one else, and
 * every open copy of the editor loads again signed out.
 */
export async function signOut(
    effects: Effects,
    owner: string,
    unsynced: (wait: number) => Promise<string | undefined>,
    anyway = false
): Promise<SignOutResult> {
    const lost = anyway ? undefined : await unsynced(SYNC_WAIT);

    if (lost) {
        return { ok: false, unsynced: lost };
    }

    const result = await effects.accounts.signOut();

    if (!result.ok) {
        return result;
    }

    const { database, viewKey, recordKey } = accountCopy(owner);

    try {
        effects.removeState(viewKey);
        effects.removeState(recordKey);
    } catch {
        // Without storage, there is nothing kept there to remove.
    }

    // A copy slow to close the database delays its deletion, not the sign-out.
    await Promise.race([
        effects.deleteDocumentDatabase(database).catch(() => undefined),
        delay(CLEAR_WAIT)
    ]);
    effects.recordSignedOut();
    effects.reload('/');

    return result;
}
