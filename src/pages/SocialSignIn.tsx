import React, { FC, useEffect, useState } from 'react';
import {
    PROVIDERS,
    readProviders,
    signInWithProvider,
    type OAuthProvider
} from 'src/app/services/oauth';
import styles from './Account.css';

/** Why sign-in with a provider failed, when the page is where it returned after failing. */
function returnedProblem() {
    const search = new URLSearchParams(window.location.search);

    if (search.get('oauth') !== 'failed') {
        return undefined;
    }

    // Better Auth links a provider to an account of the same email only once it is confirmed.
    return search.get('error') === 'account_not_linked'
        ? 'This email address has an account that is not confirmed yet. Confirm it with the link we emailed you, then try again.'
        : 'Social sign-in was not completed. Please try again or sign in by email.';
}

export const SocialSignIn: FC<{ returnTo?: string }> = ({ returnTo }) => {
    const [providers, setProviders] = useState<OAuthProvider[]>([]);
    const [busy, setBusy] = useState(false);
    const [problem, setProblem] = useState(returnedProblem);

    useEffect(() => {
        const controller = new AbortController();
        readProviders(controller.signal)
            .then(setProviders)
            .catch((error: Error) => {
                if (!controller.signal.aborted) {
                    setProblem(error.message);
                }
            });
        return () => controller.abort();
    }, []);

    const signIn = async (provider: OAuthProvider) => {
        setBusy(true);
        setProblem(undefined);
        try {
            await signInWithProvider(provider, returnTo);
        } catch {
            setProblem('Could not start sign-in. Please try again.');
            setBusy(false);
        }
    };

    return (
        <>
            {providers.length > 0 && (
                <div className={styles.social} role="group" aria-label="Social sign-in">
                    {providers.map((provider) => (
                        <button
                            key={provider}
                            type="button"
                            disabled={busy}
                            onClick={() => signIn(provider)}
                        >
                            Continue with {PROVIDERS[provider]}
                        </button>
                    ))}
                    <span>Or use email</span>
                </div>
            )}
            {problem && <p role="alert">{problem}</p>}
        </>
    );
};
