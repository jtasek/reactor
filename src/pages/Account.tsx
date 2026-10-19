import React, { FC, SubmitEvent, useEffect, useRef, useState } from 'react';
import { useAccount, useEffects, useReaction } from 'src/app/hooks';
import { accountLabel, type AccountResult } from 'src/app/services/accounts';
import { authenticationURLs, loginURL, resendVerification } from 'src/app/services/authentication';
import { signInWithProvider, type OAuthProvider } from 'src/app/services/oauth';
import { signOut, waitForSync } from 'src/app/services/signOut';
import { Avatars } from 'src/ui/components/Avatars';
import { SocialSignIn, returnedProblem } from './SocialSignIn';
import styles from './Account.css';
import { AccountFrame } from './AccountFrame';
import { ResetPassword } from './ResetPassword';
import { requestPasswordReset } from 'src/app/services/passwordRecovery';

type Mode = 'signIn' | 'signUp' | 'link' | 'forgot';
type Pending = Mode | OAuthProvider | 'resend';
type Sent = { mode: Exclude<Mode, 'signIn'>; email: string };

const RESEND_DELAY_SECONDS = 30;
const SECOND = 1000;
const MODES: Record<Mode, { title: string; submit: string; pending: string }> = {
    signIn: { title: 'Sign in', submit: 'Sign in', pending: 'Signing in…' },
    signUp: { title: 'Create an account', submit: 'Create account', pending: 'Creating account…' },
    link: { title: 'Sign in with a link', submit: 'Email me a link', pending: 'Sending link…' },
    forgot: {
        title: 'Reset your password',
        submit: 'Send reset link',
        pending: 'Sending reset link…'
    }
};

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
        if (busy) {
            return;
        }

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

            return;
        }

        setFailure(result.message);
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

/** A single request state coordinates email, provider sign-in, and email resends. */
export const SignInForm: FC<{ returnTo?: string }> = ({ returnTo }) => {
    const { accounts, forgetOwner, reload, reloadPage } = useEffects();
    const urls = authenticationURLs(returnTo);
    const [mode, setMode] = useState<Mode>('signIn');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [pending, setPending] = useState<Pending>();
    const [problem, setProblem] = useState(returnedProblem);
    const [sent, setSent] = useState<Sent>();
    const [resendIn, setResendIn] = useState(0);
    const [resendAt, setResendAt] = useState(0);
    const inFlight = useRef(false);
    /** Set once a request succeeded and the browser is leaving, so the form stays busy. */
    const leaving = useRef(false);
    const first = useRef<HTMLInputElement>(null);
    const sentHeading = useRef<HTMLHeadingElement>(null);
    const Heading = returnTo ? 'h2' : 'h1';
    const busy = pending !== undefined;

    useEffect(() => {
        if (sent) {
            sentHeading.current?.focus();

            return;
        }

        first.current?.focus();
    }, [mode, sent]);

    useEffect(() => {
        if (resendAt === 0) {
            return;
        }

        const timer = setInterval(() => {
            const remaining = Math.max(0, Math.ceil((resendAt - Date.now()) / SECOND));
            setResendIn(remaining);

            if (remaining === 0) {
                clearInterval(timer);
            }
        }, SECOND);

        return () => clearInterval(timer);
    }, [resendAt]);

    const beginCooldown = () => {
        setResendIn(RESEND_DELAY_SECONDS);
        setResendAt(Date.now() + RESEND_DELAY_SECONDS * SECOND);
    };

    const perform = async (
        action: Pending,
        request: () => Promise<AccountResult>,
        onSuccess: () => void = () => {}
    ) => {
        if (inFlight.current) {
            return;
        }

        inFlight.current = true;
        setPending(action);
        setProblem(undefined);

        try {
            const result = await request();

            if (!result.ok) {
                setProblem(result.message);

                return;
            }

            onSuccess();
        } catch {
            setProblem(
                action === 'google' || action === 'github'
                    ? 'Could not start sign-in. Please try again.'
                    : 'The request could not be completed. Please try again.'
            );
        } finally {
            if (!leaving.current) {
                inFlight.current = false;
                setPending(undefined);
            }
        }
    };

    const choose = (next: Mode) => {
        if (inFlight.current) {
            return;
        }

        setMode(next);
        setProblem(undefined);
    };

    const submit = (event: SubmitEvent) => {
        event.preventDefault();

        if (mode === 'signIn') {
            void perform(
                mode,
                () => accounts.signIn(email, password),
                () => {
                    leaving.current = true;
                    forgetOwner();

                    if (returnTo) {
                        reloadPage();

                        return;
                    }

                    reload(urls.destination);
                }
            );

            return;
        }

        const request = () => {
            if (mode === 'signUp') {
                return accounts.signUp(name, email, password, urls.callbackURL);
            }

            if (mode === 'forgot') {
                return requestPasswordReset(email, urls.callbackURL);
            }

            return accounts.sendSignInLink(email, urls.callbackURL);
        };

        void perform(mode, request, () => {
            setSent({ email, mode });
            setPassword('');
            beginCooldown();
        });
    };

    const socialSignIn = (provider: OAuthProvider) => {
        void perform(provider, async () => {
            await signInWithProvider(provider, urls.callbackURL, urls.errorCallbackURL);
            leaving.current = true;

            return { ok: true };
        });
    };

    const resend = () => {
        if (!sent || resendIn > 0) {
            return;
        }

        const request = () => {
            if (sent.mode === 'signUp') {
                return resendVerification(sent.email, urls.callbackURL);
            }

            if (sent.mode === 'forgot') {
                return requestPasswordReset(sent.email, urls.callbackURL);
            }

            return accounts.sendSignInLink(sent.email, urls.callbackURL);
        };

        void perform('resend', request, beginCooldown);
    };

    if (sent) {
        return (
            <div className={styles.form} aria-busy={busy}>
                <Heading ref={sentHeading} tabIndex={-1}>
                    Check your email
                </Heading>
                {sent.mode === 'forgot' ? (
                    <p role="status">
                        If an account exists for <strong>{sent.email}</strong>, we sent a password
                        reset link.
                    </p>
                ) : (
                    <p role="status">
                        Check <strong>{sent.email}</strong> for a link to{' '}
                        {sent.mode === 'signUp' ? 'confirm your address and sign in.' : 'sign in.'}
                    </p>
                )}
                {returnTo && (
                    <p>
                        After signing in, return to this invitation tab or reopen the invitation
                        link.
                    </p>
                )}
                <p className={styles.secondary}>If it does not arrive, check your spam folder.</p>
                {problem && <p role="alert">{problem}</p>}
                <button type="button" disabled={busy || resendIn > 0} onClick={resend}>
                    {busy
                        ? 'Sending email…'
                        : resendIn > 0
                          ? `Resend email in ${resendIn}s`
                          : 'Resend email'}
                </button>
                <button
                    type="button"
                    className={styles.link}
                    disabled={busy}
                    onClick={() => {
                        setSent(undefined);
                        setProblem(undefined);
                    }}
                >
                    Use another email
                </button>
            </div>
        );
    }

    return (
        <form className={styles.form} onSubmit={submit} aria-busy={busy}>
            <Heading>{MODES[mode].title}</Heading>
            {problem && <p role="alert">{problem}</p>}
            <fieldset className={styles.fields} disabled={busy}>
                {mode !== 'forgot' && (
                    <SocialSignIn
                        pending={pending}
                        onSignIn={socialSignIn}
                        onProblem={setProblem}
                    />
                )}
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
                {(mode === 'signIn' || mode === 'signUp') && (
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
                {mode === 'signIn' && (
                    <button className={styles.link} type="button" onClick={() => choose('forgot')}>
                        Forgot password?
                    </button>
                )}
                <button className={styles.primary} type="submit">
                    {pending === mode ? MODES[mode].pending : MODES[mode].submit}
                </button>
                <div className={styles.modes}>
                    {(Object.keys(MODES) as Mode[])
                        .filter((other) => other !== mode && other !== 'forgot')
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
                </div>
            </fieldset>
        </form>
    );
};

/** Login is the only signed-out entry point; Account shows identity and sign-out. */
export const Account: FC<{ login?: boolean }> = ({ login = false }) => {
    const account = useAccount();
    const { redirect, reload } = useEffects();
    const resetting = window.location.pathname.replace(/\/+$/, '') === '/reset-password';

    useEffect(() => {
        if (resetting) {
            return;
        }

        if (!login && account.kind === 'signedOut') {
            redirect(loginURL('/account'));

            return;
        }

        if (login && account.kind === 'signedIn') {
            reload(authenticationURLs().destination);
        }
    }, [account.kind, login, redirect, reload, resetting]);

    if (resetting) {
        return <ResetPassword />;
    }

    if (account.kind === 'loading') {
        return (
            <AccountFrame>
                <p role="status">Loading account…</p>
            </AccountFrame>
        );
    }

    if (account.kind === 'unavailable') {
        return (
            <AccountFrame>
                <h1>Sign in</h1>
                <p>This server has no accounts. Your documents are kept only in this browser.</p>
            </AccountFrame>
        );
    }

    if (account.kind === 'signedOut' && !login) {
        return (
            <AccountFrame>
                <p role="status">Opening sign-in…</p>
            </AccountFrame>
        );
    }

    if (account.kind === 'signedOut') {
        return (
            <AccountFrame>
                <p className={styles.secondary}>
                    Sign in to sync your documents and work together.
                </p>
                <SignInForm />
            </AccountFrame>
        );
    }

    if (login) {
        return (
            <AccountFrame signedIn>
                <p role="status">Opening your documents…</p>
            </AccountFrame>
        );
    }

    return (
        <AccountFrame signedIn>
            <h1>Account</h1>
            <div className={styles.identity}>
                <Avatars
                    people={[{ name: accountLabel(account), image: account.image }]}
                    decorative
                />
                <div>
                    <strong>{accountLabel(account)}</strong>
                    {account.name && <p className={styles.secondary}>{account.email}</p>}
                </div>
            </div>
            <section className={styles.signOut} aria-labelledby="sign-out-heading">
                <h2 id="sign-out-heading">Sign out</h2>
                <p>
                    Your synced documents stay in your account. Signing out removes this account’s
                    copy from the browser.
                </p>
                <SignOut owner={account.id} />
            </section>
        </AccountFrame>
    );
};
