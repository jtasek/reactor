export const PROVIDERS = { google: 'Google', github: 'GitHub' };
export type OAuthProvider = keyof typeof PROVIDERS;

/** The account page loads this service; provider code is never part of editor startup. */
export async function readProviders(signal: AbortSignal): Promise<OAuthProvider[]> {
    const response = await fetch('/api/sign-in/providers', { signal });
    if (!response.ok) {
        throw new Error('Could not load social sign-in options. You can still sign in by email.');
    }
    const providers: unknown = await response.json();

    return Array.isArray(providers)
        ? providers.filter(
              (provider): provider is OAuthProvider =>
                  provider === 'google' || provider === 'github'
          )
        : [];
}

export async function signInWithProvider(
    provider: OAuthProvider,
    callbackURL = '/documents',
    errorCallbackURL = '/login?oauth=failed'
) {
    const response = await fetch('/api/auth/sign-in/social', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            provider,
            callbackURL,
            errorCallbackURL,
            disableRedirect: true
        })
    });
    if (!response.ok) {
        throw new Error('Could not start sign-in. Please try again.');
    }
    const result: { url?: string } = await response.json();
    if (!result.url) {
        throw new Error('Could not start sign-in. Please try again.');
    }
    window.location.assign(result.url);
}
