import React, { FC, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { PROVIDERS, readProviders, type OAuthProvider } from 'src/app/services/oauth';
import styles from './Account.css';

/** Why sign-in with a provider failed on its return to the app. */
export function returnedProblem() {
    const search = new URLSearchParams(window.location.search);

    if (search.get('oauth') !== 'failed') {
        return undefined;
    }

    return search.get('error') === 'account_not_linked'
        ? 'This email address has an account that is not confirmed yet. Confirm it with the link we emailed you, then try again.'
        : 'Social sign-in was not completed. Please try again or sign in by email.';
}

export const SocialSignIn: FC<{
    pending?: string;
    onSignIn: (provider: OAuthProvider) => void;
    onProblem: Dispatch<SetStateAction<string | undefined>>;
}> = ({ pending, onSignIn, onProblem }) => {
    const [providers, setProviders] = useState<OAuthProvider[]>();

    useEffect(() => {
        const controller = new AbortController();
        readProviders(controller.signal)
            .then((available) => {
                if (controller.signal.aborted) {
                    return;
                }

                setProviders(available);
            })
            .catch(() => {
                if (controller.signal.aborted) {
                    return;
                }

                setProviders([]);
                onProblem(
                    (current) =>
                        current ??
                        'Could not load social sign-in options. You can still sign in by email.'
                );
            });

        return () => controller.abort();
    }, [onProblem]);

    if (!providers) {
        return <p role="status">Loading sign-in options…</p>;
    }

    if (providers.length === 0) {
        return null;
    }

    return (
        <div className={styles.social} role="group" aria-label="Social sign-in">
            {providers.map((provider) => (
                <button key={provider} type="button" onClick={() => onSignIn(provider)}>
                    {pending === provider ? 'Continuing with' : 'Continue with'}{' '}
                    {PROVIDERS[provider]}
                    {pending === provider && '…'}
                </button>
            ))}
            <span>Or use email</span>
        </div>
    );
};
