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
import { Button, Field, Problem } from 'src/ui/components/Controls';
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

        window.history.replaceState(
            window.history.state,
            '',
            window.location.pathname + window.location.search
        );
        setPassword('');
        setConfirmation('');
        setDone(true);
    };

    if (!token) {
        return (
            <AccountFrame onBack={back}>
                <div className={styles.form}>
                    <h1>Reset your password</h1>
                    <Problem>
                        This reset link is incomplete. Request a new one from sign-in.
                    </Problem>
                    <Button onClick={() => reload(signInURL)}>Back to sign in</Button>
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
                    <Button kind="primary" onClick={() => reload(signInURL)}>
                        Back to sign in
                    </Button>
                </div>
            </AccountFrame>
        );
    }

    return (
        <AccountFrame onBack={back}>
            <form className={styles.form} onSubmit={submit} aria-busy={busy}>
                <h1>Choose a new password</h1>
                <p>Reset links expire after one hour and can be used once.</p>
                <fieldset className={styles.fields} disabled={busy}>
                    <Field
                        label="New password"
                        ref={first}
                        type="password"
                        autoComplete="new-password"
                        required
                        minLength={MIN_PASSWORD_LENGTH}
                        maxLength={MAX_PASSWORD_LENGTH}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                    />
                    <Field
                        label="Confirm new password"
                        type="password"
                        autoComplete="new-password"
                        required
                        minLength={MIN_PASSWORD_LENGTH}
                        maxLength={MAX_PASSWORD_LENGTH}
                        value={confirmation}
                        onChange={(event) => setConfirmation(event.target.value)}
                    />
                    {problem && <Problem>{problem}</Problem>}
                    <Button kind="primary" type="submit">
                        {busy ? 'Updating password…' : 'Update password'}
                    </Button>
                    <Button kind="quiet" onClick={() => reload(signInURL)}>
                        Back to sign in
                    </Button>
                </fieldset>
            </form>
        </AccountFrame>
    );
};
