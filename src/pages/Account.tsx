import React, { FC, SubmitEvent, useEffect, useRef, useState } from 'react';

import { useAccount, useEffects, useReaction } from 'src/app/hooks';
import type { AccountResult } from 'src/app/services/accounts';
import { signOut, waitForSync } from 'src/app/services/signOut';

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
 * Account requests. Signing in loads the editor again, so everything it shows,
 * and later keeps in this browser, belongs to the new account.
 */
function useAccountRequests() {
    const { accounts, forgetOwner, reload } = useEffects();

    return {
        signIn: async (email: string, password: string) => {
            const result = await accounts.signIn(email, password);

            if (result.ok) {
                forgetOwner();
                reload('/');
            }

            return result;
        },
        signUp: accounts.signUp,
        sendSignInLink: accounts.sendSignInLink
    };
}

/**
 * Signs out, after telling the user what would be lost; the page loads again
 * signed out.
 */
const SignOut: FC<{ owner: string }> = ({ owner }) => {
    const effects = useEffects();
    const reaction = useReaction();
    const [busy, setBusy] = useState(false);
    const [failure, setFailure] = useState<string>();
    const [lost, setLost] = useState<string>();
    const leave = async (anyway: boolean) => {
        setBusy(true);
        setFailure(undefined);
        setLost(undefined);

        const result = await signOut(effects, owner, (wait) => waitForSync(reaction, wait), anyway);

        setBusy(false);

        if (result.ok) {
            return;
        }

        if ('unsynced' in result) {
            setLost(result.unsynced);
        } else {
            setFailure(result.message);
        }
    };

    if (lost) {
        return (
            <div role="alert">
                <p>
                    {lost} Signing out removes your documents from this browser, and changes the
                    server does not have yet are lost.
                </p>
                <button type="button" disabled={busy} onClick={() => leave(true)}>
                    Sign out anyway
                </button>{' '}
                <button type="button" disabled={busy} onClick={() => setLost(undefined)}>
                    Stay signed in
                </button>
            </div>
        );
    }

    return (
        <>
            <button type="button" disabled={busy} onClick={() => leave(false)}>
                {busy ? 'Signing out…' : 'Sign out'}
            </button>
            {failure && <p role="alert">{failure}</p>}
        </>
    );
};

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

    const submit = async (event: SubmitEvent) => {
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
                <SignOut owner={account.id} />
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
