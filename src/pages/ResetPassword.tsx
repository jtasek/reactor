import React, {
    type FC,
    type SubmitEvent,
    useEffect,
    useRef,
    useState,
    type MouseEvent
} from 'react';
import { useEffects } from 'src/app/hooks';
import { recoverySignInURL, resetPassword } from 'src/app/services/passwordRecovery';
import { AccountFrame } from './AccountFrame';
import styles from './Account.css';

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

export const ResetPassword: FC = () => {
    const { reload } = useEffects();
    const [token] = useState(() => window.location.hash.slice(1));
    const [password, setPassword] = useState('');
    const [confirmation, setConfirmation] = useState('');
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(false);
    const [problem, setProblem] = useState<string>();
    const inFlight = useRef(false);
    const first = useRef<HTMLInputElement>(null);
    const heading = useRef<HTMLHeadingElement>(null);
    const signInURL = recoverySignInURL();

    useEffect(() => {
        if (done) {
            heading.current?.focus();

            return;
        }

        first.current?.focus();
    }, [done]);

    const back = (event: MouseEvent<HTMLAnchorElement>) => {
        event.preventDefault();
        reload('/documents');
    };

    const submit = async (event: SubmitEvent) => {
        event.preventDefault();

        if (inFlight.current) {
            return;
        }

        if (password !== confirmation) {
            setProblem('The passwords do not match.');

            return;
        }

        inFlight.current = true;
        setBusy(true);
        setProblem(undefined);

        const result = await resetPassword(token, password);

        inFlight.current = false;
        setBusy(false);

        if (!result.ok) {
            setProblem(result.message);

            return;
        }

        window.history.replaceState({}, '', window.location.pathname + window.location.search);
        setPassword('');
        setConfirmation('');
        setDone(true);
    };

    if (!token) {
        return (
            <AccountFrame onBack={back}>
                <div className={styles.form}>
                    <h1>Reset your password</h1>
                    <p role="alert">
                        This reset link is incomplete. Request a new one from sign-in.
                    </p>
                    <button type="button" onClick={() => reload(signInURL)}>
                        Back to sign in
                    </button>
                </div>
            </AccountFrame>
        );
    }

    if (done) {
        return (
            <AccountFrame onBack={back}>
                <div className={styles.form}>
                    <h1 ref={heading} tabIndex={-1}>
                        Password updated
                    </h1>
                    <p role="status">
                        Sign in with your new password. Existing sessions for this account have been
                        signed out.
                    </p>
                    {signInURL === '/invite' && (
                        <p>
                            Return to your original invitation tab or reopen the invitation link to
                            continue.
                        </p>
                    )}
                    <button
                        type="button"
                        className={styles.primary}
                        onClick={() => reload(signInURL)}
                    >
                        Back to sign in
                    </button>
                </div>
            </AccountFrame>
        );
    }

    return (
        <AccountFrame onBack={back}>
            <form className={styles.form} onSubmit={submit} aria-busy={busy}>
                <h1>Choose a new password</h1>
                <p>Reset links expire after one hour and can be used once.</p>
                {problem && <p role="alert">{problem}</p>}
                <fieldset className={styles.fields} disabled={busy}>
                    <label>
                        New password
                        <input
                            ref={first}
                            type="password"
                            autoComplete="new-password"
                            required
                            minLength={MIN_PASSWORD_LENGTH}
                            maxLength={MAX_PASSWORD_LENGTH}
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                        />
                    </label>
                    <label>
                        Confirm new password
                        <input
                            type="password"
                            autoComplete="new-password"
                            required
                            minLength={MIN_PASSWORD_LENGTH}
                            maxLength={MAX_PASSWORD_LENGTH}
                            value={confirmation}
                            onChange={(event) => setConfirmation(event.target.value)}
                        />
                    </label>
                    <button type="submit" className={styles.primary}>
                        {busy ? 'Updating password…' : 'Update password'}
                    </button>
                    <button type="button" className={styles.link} onClick={() => reload(signInURL)}>
                        Back to sign in
                    </button>
                </fieldset>
            </form>
        </AccountFrame>
    );
};
