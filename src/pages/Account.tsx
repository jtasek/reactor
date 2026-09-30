import React, { FC, FormEvent, useEffect, useRef, useState } from 'react';

import { useAccount, useEffects } from 'src/app/hooks';
import type { AccountResult } from 'src/app/services/accounts';

import styles from './Account.css';

type Mode = 'signIn' | 'signUp' | 'link';

const MODES: Record<Mode, { title: string; submit: string }> = {
    signIn: { title: 'Sign in', submit: 'Sign in' },
    signUp: { title: 'Create an account', submit: 'Create account' },
    link: { title: 'Sign in with a link', submit: 'Email me a link' }
};

/** What to say once a form succeeds; signing in says nothing, it loads the editor. */
const DONE: Partial<Record<Mode, (email: string) => string>> = {
    signUp: (email) => `Check ${email} for a link to confirm your address, then sign in.`,
    link: (email) => `Check ${email} for a link that signs you in.`
};

/**
 * Account requests. Signing in or out loads the editor again, so everything it
 * shows, and later keeps in this browser, belongs to the new account.
 */
function useAccountRequests() {
    const { accounts, forgetOwner, reload } = useEffects();
    const reloadAfter = async (request: Promise<AccountResult>) => {
        const result = await request;

        if (result.ok) {
            forgetOwner();
            reload('/');
        }

        return result;
    };

    return {
        signIn: (email: string, password: string) => reloadAfter(accounts.signIn(email, password)),
        signUp: accounts.signUp,
        sendSignInLink: accounts.sendSignInLink,
        signOut: () => reloadAfter(accounts.signOut())
    };
}

const Back: FC = () => (
    <p>
        <a href="/">Back to the editor</a>
    </p>
);

/** Signs in with a password, creates an account, or emails a sign-in link. */
const SignInForm: FC = () => {
    const { signIn, signUp, sendSignInLink } = useAccountRequests();
    const [mode, setMode] = useState<Mode>('signIn');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState<{ text: string; failed: boolean }>();
    const first = useRef<HTMLInputElement>(null);

    useEffect(() => {
        first.current?.focus();
    }, [mode]);

    const choose = (next: Mode) => {
        setMode(next);
        setResult(undefined);
    };

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setBusy(true);

        const requests: Record<Mode, () => Promise<AccountResult>> = {
            signIn: () => signIn(email, password),
            signUp: () => signUp(name, email, password),
            link: () => sendSignInLink(email)
        };
        const outcome = await requests[mode]();

        setBusy(false);

        if (!outcome.ok) {
            setResult({ text: outcome.message, failed: true });

            return;
        }

        const done = DONE[mode];

        setResult(done && { text: done(email), failed: false });
    };

    return (
        <form className={styles.form} onSubmit={submit}>
            <h1>{MODES[mode].title}</h1>
            {mode === 'signUp' && (
                <label>
                    Name
                    <input
                        ref={first}
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        autoComplete="name"
                        required
                    />
                </label>
            )}
            <label>
                Email
                <input
                    ref={mode === 'signUp' ? undefined : first}
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    required
                />
            </label>
            {mode !== 'link' && (
                <label>
                    Password
                    <input
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        autoComplete={mode === 'signUp' ? 'new-password' : 'current-password'}
                        minLength={8}
                        required
                    />
                </label>
            )}
            <button type="submit" disabled={busy}>
                {MODES[mode].submit}
            </button>
            {result && <p role={result.failed ? 'alert' : 'status'}>{result.text}</p>}
            <p className={styles.modes}>
                {(Object.keys(MODES) as Mode[])
                    .filter((other) => other !== mode)
                    .map((other) => (
                        <button
                            key={other}
                            type="button"
                            className={styles.link}
                            onClick={() => choose(other)}
                        >
                            {MODES[other].title}
                        </button>
                    ))}
            </p>
        </form>
    );
};

/** Signing in and out. Without accounts on the server, it says so. */
export const Account: FC = () => {
    const account = useAccount();
    const { signOut } = useAccountRequests();
    const [failure, setFailure] = useState<string>();

    if (account.kind === 'loading') {
        return <main className={styles.account} aria-busy="true" />;
    }

    if (account.kind === 'unavailable') {
        return (
            <main className={styles.account}>
                <h1>Accounts</h1>
                <p>This server has no accounts. Your documents are kept only in this browser.</p>
                <Back />
            </main>
        );
    }

    if (account.kind === 'signedIn') {
        return (
            <main className={styles.account}>
                <h1>Account</h1>
                <p>
                    Signed in as{' '}
                    {account.name ? `${account.name} (${account.email})` : account.email}.
                </p>
                <button
                    type="button"
                    onClick={async () => {
                        const result = await signOut();

                        setFailure(result.ok ? undefined : result.message);
                    }}
                >
                    Sign out
                </button>
                {failure && <p role="alert">{failure}</p>}
                <Back />
            </main>
        );
    }

    return (
        <main className={styles.account}>
            <SignInForm />
            <Back />
        </main>
    );
};
