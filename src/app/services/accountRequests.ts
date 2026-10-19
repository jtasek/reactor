import type { AccountResult } from './accounts';

const MESSAGES: Record<string, string> = {
    INVALID_EMAIL: 'Enter a valid email address.',
    INVALID_EMAIL_OR_PASSWORD: 'The email address or password is wrong.',
    EMAIL_NOT_VERIFIED: 'Confirm your email address first, with the link we sent you.',
    PASSWORD_TOO_SHORT: 'Use a password of at least 8 characters.',
    PASSWORD_TOO_LONG: 'Use a shorter password.',
    USER_ALREADY_EXISTS: 'An account with this email address already exists.',
    USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'An account with this email address already exists.'
};

export async function accountRequest(path: string, body: object): Promise<AccountResult> {
    let response: Response;

    try {
        response = await fetch(`/api/auth/${path}`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body)
        });
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
