import React, { FC, useEffect, useState } from 'react';
import {
    PROVIDERS,
    readProviders,
    signInWithProvider,
    type OAuthProvider
} from 'src/app/services/oauth';
import styles from './Account.css';

export const SocialSignIn: FC = () => {
    const [providers, setProviders] = useState<OAuthProvider[]>([]);
    const [busy, setBusy] = useState(false);
    const [problem, setProblem] = useState<string | undefined>(() =>
        new URLSearchParams(window.location.search).get('oauth') === 'failed'
            ? 'Social sign-in was not completed. Please try again or sign in by email.'
            : undefined
    );

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
            await signInWithProvider(provider);
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
