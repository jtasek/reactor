import type { Account } from '../types';

/** Where the signed-out notices already shown are remembered. */
export const NOTICES_KEY = 'reactor:notices';

/** Someone signed in. */
export interface AccountUser {
    id: string;
    name: string;
    email: string;
    image?: string | null;
}

/** How an account request ended; `message` says why one failed. */
export type AccountResult = { ok: true } | { ok: false; message: string };

/** How long the editor waits for the session before showing no accounts. */
const SESSION_TIMEOUT = 5000;

/** Account mutations load with authentication, rather than every page opening. */
export async function accountRequest(path: string, body: object): Promise<AccountResult> {
    try {
        const requests = await import('./accountRequests');

        return await requests.accountRequest(path, body);
    } catch {
        return { ok: false, message: 'The server could not be reached. Try again.' };
    }
}

/** The login page, returning to the editor when left from it; otherwise login's default, Documents. */
export const loginFrom = (page: string) => (page === 'designer' ? '/login?returnTo=/' : '/login');

/** Where email links lead back to once followed. */
const RETURN_TO = '/documents';

/** Signing in and out through the server's `/api/auth` endpoints. */
export const accounts = {
    /**
     * The user signed in, `null` when signed out, or `undefined` when this server
     * has no accounts.
     */
    async session(): Promise<AccountUser | null | undefined> {
        const response = await fetch('/api/auth/get-session', {
            credentials: 'same-origin',
            signal: AbortSignal.timeout(SESSION_TIMEOUT)
        });

        if (response.status === 404) {
            return undefined;
        }

        if (!response.ok) {
            throw new Error(`Session could not be read: ${response.status}`);
        }

        const session = (await response.json()) as { user: AccountUser } | null;

        return (
            session && {
                id: session.user.id,
                name: session.user.name,
                email: session.user.email,
                image: session.user.image
            }
        );
    },
    signIn: (email: string, password: string) =>
        accountRequest('sign-in/email', { email, password }),
    signUp: (name: string, email: string, password: string, returnTo = RETURN_TO) =>
        accountRequest('sign-up/email', { name, email, password, callbackURL: returnTo }),
    sendSignInLink: (email: string, returnTo = RETURN_TO) =>
        accountRequest('sign-in/magic-link', { email, callbackURL: returnTo }),
    signOut: () => accountRequest('sign-out', {})
};

export type Accounts = typeof accounts;

/** Who is signed in; a server without accounts, or one not answering, has none. */
export async function readAccount(from: Pick<Accounts, 'session'>): Promise<Account> {
    try {
        const user = await from.session();

        if (user === undefined) {
            return { kind: 'unavailable' };
        }

        return user === null ? { kind: 'signedOut' } : { kind: 'signedIn', ...user };
    } catch (error) {
        console.warn('The account could not be read', error);

        return { kind: 'unavailable' };
    }
}

/** How to name someone signed in: accounts made by an emailed link have no name. */
export const accountLabel = ({ name, email }: AccountUser) => name || email;

/** Where each open copy records whose documents it opened: an account's id, or '' signed out. */
const OWNER_KEY = 'reactor:account';

/** Whose documents this browser opened last, or `undefined` when not known. */
export function lastOwner(): string | undefined {
    try {
        return window.localStorage.getItem(OWNER_KEY) ?? undefined;
    } catch {
        return undefined;
    }
}

/** Forgets whose documents opened, so the next start reads the account first. */
export function forgetOwner() {
    try {
        window.localStorage.removeItem(OWNER_KEY);
    } catch {
        // The next start then opens the documents opened last and loads again if needed.
    }
}

/**
 * Records that this browser signed out, so the other open copies of the editor
 * load again signed out and the next start opens the documents kept signed out.
 */
export function recordSignedOut() {
    try {
        window.localStorage.setItem(OWNER_KEY, '');
    } catch {
        // Other copies are not told; each still reads its own account.
    }
}

/** Whose documents to open for `account`; while it cannot be read, `last`'s. */
export function documentOwner(account: Account, last = ''): string {
    if (account.kind === 'signedIn') {
        return account.id;
    }

    return account.kind === 'signedOut' ? '' : last;
}

/**
 * Records whose documents opened here for the other open copies of the editor, and
 * runs `changed` when another copy records someone else's, as after signing in or
 * out there, so no copy keeps showing, or keeping, the previous account's documents.
 * Returns whether it was recorded.
 */
export function shareOwner(owner: string, changed: () => void): boolean {
    window.addEventListener('storage', ({ key, newValue }) => {
        if (key === OWNER_KEY && newValue !== null && newValue !== owner) {
            changed();
        }
    });

    try {
        window.localStorage.setItem(OWNER_KEY, owner);

        return true;
    } catch {
        // Without storage, other copies are not told; each still reads its own account.
        return false;
    }
}
