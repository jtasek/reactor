import { recoveryDestination } from '../authenticationDestination';
import { accountRequest } from './accounts';

export function requestPasswordReset(email: string, destination: string) {
    const query = new URLSearchParams({ returnTo: recoveryDestination(destination) });

    return accountRequest('request-password-reset', {
        email,
        redirectTo: `/reset-password?${query}`
    });
}

export const resetPassword = (token: string, newPassword: string) =>
    accountRequest('reset-password', { token, newPassword });

export function recoverySignInURL() {
    const requested = new URLSearchParams(window.location.search).get('returnTo');
    const destination = recoveryDestination(requested);

    if (destination === '/invite') {
        return '/invite';
    }

    const query = new URLSearchParams({ returnTo: destination });

    return `/login?${query}`;
}
