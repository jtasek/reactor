import type { Account } from '../types';

/** Where the signed-out notices already shown are remembered. */
export const NOTICES_KEY = 'reactor:notices';

/** Someone signed in. */
export interface AccountUser {
    id: string;
    name: string;
    email: string;
}

/** How an account request ended; `message` says why one failed. */
export type AccountResult = { ok: true } | { ok: false; message: string };

const MESSAGES: Record<string, string> = {
    INVALID_EMAIL: 'Enter a valid email address.',
    INVALID_EMAIL_OR_PASSWORD: 'The email address or password is wrong.',
    EMAIL_NOT_VERIFIED: 'Confirm your email address first, with the link we sent you.',
    PASSWORD_TOO_SHORT: 'Use a password of at least 8 characters.',
    PASSWORD_TOO_LONG: 'Use a shorter password.',
    USER_ALREADY_EXISTS: 'An account with this email address already exists.',
    USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'An account with this email address already exists.'
};

/** How long the editor waits for the session before showing no accounts. */
const SESSION_TIMEOUT = 5000;

const request = (path: string, body?: object, signal?: AbortSignal) =>
    fetch(`/api/auth/${path}`, {
        method: body ? 'POST' : 'GET',
        credentials: 'same-origin',
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body: body && JSON.stringify(body),
        signal
    });

async function post(path: string, body: object): Promise<AccountResult> {
    let response: Response;

    try {
        response = await request(path, body);
    } catch {
        return { ok: false, message: 'The server could not be reached. Try again.' };
    }

    if (response.ok) {
        return { ok: true };
    }

    if (response.status === 429) {
        return { ok: false, message: 'Too many attempts. Try again in a minute.' };
    }

    const { code } = (await response.json().catch(() => ({}))) as { code?: string };

    return { ok: false, message: (code && MESSAGES[code]) ?? 'Something went wrong. Try again.' };
}

/** Where email links lead back to once followed. */
const RETURN_TO = '/account';

/** Signing in and out through the server's `/api/auth` endpoints. */
export const accounts = {
    /**
     * The user signed in, `null` when signed out, or `undefined` when this server
     * has no accounts.
     */
    async session(): Promise<AccountUser | null | undefined> {
        const response = await request(
            'get-session',
            undefined,
            AbortSignal.timeout(SESSION_TIMEOUT)
        );

        if (response.status === 404) {
            return undefined;
        }

        if (!response.ok) {
            throw new Error(`Session could not be read: ${response.status}`);
        }

        const session = (await response.json()) as { user: AccountUser } | null;

        return (
            session && { id: session.user.id, name: session.user.name, email: session.user.email }
        );
    },
    signIn: (email: string, password: string) => post('sign-in/email', { email, password }),
    signUp: (name: string, email: string, password: string) =>
        post('sign-up/email', { name, email, password, callbackURL: RETURN_TO }),
    sendSignInLink: (email: string) =>
        post('sign-in/magic-link', { email, callbackURL: RETURN_TO }),
    signOut: () => post('sign-out', {})
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

/** Where each open copy records who is signed in, for the others. */
const SIGNED_IN_KEY = 'reactor:signedIn';

/**
 * Records who is signed in here for the other open copies of the editor, and runs
 * `changed` when another copy records someone else, as after signing in or out
 * there, so no copy keeps showing, or keeping, the previous account's documents.
 */
export function shareAccount(account: Account, changed: () => void) {
    const signedIn = account.kind === 'signedIn' ? account.email : '';

    window.addEventListener('storage', ({ key, newValue }) => {
        if (key === SIGNED_IN_KEY && newValue !== null && newValue !== signedIn) {
            changed();
        }
    });

    try {
        window.localStorage.setItem(SIGNED_IN_KEY, signedIn);
    } catch {
        // Without storage, other copies are not told; each still reads its own account.
    }
}
