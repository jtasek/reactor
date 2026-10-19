import { recoveryDestination } from '../src/app/authenticationDestination';
import { passwordResetURL } from '../server/passwordReset';
import { recoverySignInURL } from '../src/app/services/passwordRecovery';

afterEach(() => vi.unstubAllGlobals());

it.each(['/sharing', '/account', '/documents', '/', '/invite'])(
    'preserves an allowed recovery destination: %s',
    (destination) => {
        expect(recoveryDestination(destination)).toBe(destination);
        const provider = new URL('http://localhost:4000/api/auth/reset-password/secret');
        provider.searchParams.set(
            'callbackURL',
            `/reset-password?returnTo=${encodeURIComponent(destination)}`
        );
        const link = new URL(passwordResetURL('http://localhost:4000', 'secret', provider.href));
        expect(link.pathname).toBe('/reset-password');
        expect(link.searchParams.get('returnTo')).toBe(destination);
        expect(link.hash).toBe('#secret');
        expect(link.search).not.toContain('secret');
    }
);

it.each(['https://evil.test', '//evil.test', '/login', '/invite#private', null])(
    'rejects unsafe recovery destinations: %s',
    (destination) => {
        expect(recoveryDestination(destination)).toBe('/documents');
    }
);

it('returns invitation recovery to the invitation without copying its secret', () => {
    vi.stubGlobal('window', { location: { search: '?returnTo=%2Finvite' } });
    expect(recoverySignInURL()).toBe('/invite');
});
