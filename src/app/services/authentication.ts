import { accountRequest } from './accounts';
import { AUTH_DESTINATIONS } from '../authenticationDestination';

/** Authentication may return only to known app pages; invitation secrets stay in this tab. */
export function authenticationURLs(invitation?: string) {
    if (invitation && /^\/invite#[a-f0-9]{64}$/.test(invitation)) {
        return {
            destination: invitation,
            callbackURL: '/invite',
            errorCallbackURL: '/invite?oauth=failed'
        };
    }

    const requested = new URLSearchParams(window.location.search).get('returnTo');
    const destination =
        requested && AUTH_DESTINATIONS.includes(requested) ? requested : '/documents';
    const query = new URLSearchParams({ oauth: 'failed' });

    if (destination !== '/documents') {
        query.set('returnTo', destination);
    }

    return { destination, callbackURL: destination, errorCallbackURL: `/login?${query}` };
}

export function loginURL(returnTo?: string) {
    const query = new URLSearchParams(window.location.search);

    if (returnTo && !query.has('returnTo')) {
        query.set('returnTo', returnTo);
    }

    const search = query.toString();

    return search ? `/login?${search}` : '/login';
}

export const resendVerification = (email: string, callbackURL: string) =>
    accountRequest('send-verification-email', { email, callbackURL });
