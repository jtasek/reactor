import { authenticationURLs, loginURL } from 'src/app/services/authentication';

afterEach(() => vi.unstubAllGlobals());

function location(search = '') {
    vi.stubGlobal('window', { location: { search } });
}

it('uses Documents for ordinary authentication and preserves known return destinations', () => {
    location();
    expect(authenticationURLs()).toEqual({
        destination: '/documents',
        callbackURL: '/documents',
        errorCallbackURL: '/login?oauth=failed'
    });
    location('?returnTo=%2Fsharing');
    expect(authenticationURLs()).toEqual({
        destination: '/sharing',
        callbackURL: '/sharing',
        errorCallbackURL: '/login?oauth=failed&returnTo=%2Fsharing'
    });
});

it.each(['https://evil.test', '//evil.test', '/login', '/signin', '/documents?redirect=elsewhere'])(
    'rejects an unsafe or looping return destination: %s',
    (destination) => {
        location(`?returnTo=${encodeURIComponent(destination)}`);
        expect(authenticationURLs().destination).toBe('/documents');
    }
);

it('keeps the invitation fragment local for every provider callback', () => {
    location('?returnTo=https://evil.test');
    const invitation = `/invite#${'a'.repeat(64)}`;
    expect(authenticationURLs(invitation)).toEqual({
        destination: invitation,
        callbackURL: '/invite',
        errorCallbackURL: '/invite?oauth=failed'
    });
});

it('retains provider errors and the intended page when redirecting old account links', () => {
    location('?oauth=failed&error=account_not_linked');
    expect(loginURL('/account')).toBe(
        '/login?oauth=failed&error=account_not_linked&returnTo=%2Faccount'
    );
    location('?returnTo=%2Fsharing');
    expect(loginURL('/account')).toBe('/login?returnTo=%2Fsharing');
});
