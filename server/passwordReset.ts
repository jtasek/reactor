import { recoveryDestination } from '../src/app/authenticationDestination.ts';

/** Keep the reset secret in the fragment, outside HTTP URLs and referrers. */
export function passwordResetURL(baseURL: string, token: string, providerURL: string) {
    const callback = new URL(providerURL).searchParams.get('callbackURL');
    const requested = callback ? new URL(callback, baseURL).searchParams.get('returnTo') : null;
    const reset = new URL('/reset-password', baseURL);
    reset.searchParams.set('returnTo', recoveryDestination(requested));
    reset.hash = token;

    return reset.href;
}
