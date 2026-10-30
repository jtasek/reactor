import React, { FC, useEffect, useState } from 'react';
import { useAccount, useEffects } from 'src/app/hooks';
import {
    invitations,
    invitationPath,
    pendingInvitationToken,
    forgetInvitationToken,
    type InvitationPreview
} from 'src/app/services/invitations';
import { SignInForm } from './Account';
import styles from './Sharing.css';

export const Invitation: FC = () => {
    const [token, setToken] = useState(pendingInvitationToken);
    useEffect(() => {
        const changed = () => setToken(pendingInvitationToken());
        window.addEventListener('hashchange', changed);
        window.addEventListener('popstate', changed);
        return () => {
            window.removeEventListener('hashchange', changed);
            window.removeEventListener('popstate', changed);
        };
    }, []);
    return <InvitationDetails key={token ?? 'missing'} token={token} />;
};

const InvitationDetails: FC<{ token?: string }> = ({ token }) => {
    const account = useAccount();
    const { reload } = useEffects();
    const [acceptController] = useState(() => new AbortController());
    useEffect(() => () => acceptController.abort(), [acceptController]);
    const [preview, setPreview] = useState<InvitationPreview>();
    const [problem, setProblem] = useState<string>();
    const [busy, setBusy] = useState(false);
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        if (!token || account.kind !== 'signedIn') return;
        const controller = new AbortController();
        setProblem(undefined);
        invitations
            .inspect(token, controller.signal)
            .then(setPreview)
            .catch((error: Error) => {
                if (!controller.signal.aborted) setProblem(error.message);
            });
        return () => controller.abort();
    }, [token, account.kind, attempt]);

    const accept = async () => {
        if (!token) return;
        setBusy(true);
        setProblem(undefined);
        try {
            await invitations.accept(token, acceptController.signal);
            if (acceptController.signal.aborted) return;
            forgetInvitationToken();
            window.history.replaceState(window.history.state, '', '/invite');
            // A fresh document list and permission snapshot load before any editor is shown.
            reload('/documents');
        } catch (error) {
            if (acceptController.signal.aborted) return;
            setProblem(
                error instanceof Error
                    ? error.message
                    : 'The server could not be reached. Please try again.'
            );
            setBusy(false);
        }
    };
    return (
        <main className={styles.page}>
            <div className={styles.content}>
                <nav aria-label="Invitation page">
                    <a href="/documents">Documents</a> · <a href="/account">Account</a>
                </nav>
                <section className={styles.card}>
                    <h1>Workspace invitation</h1>
                    {!token ? (
                        <p>This invitation link is incomplete. Ask the sender for a new link.</p>
                    ) : account.kind === 'unavailable' ? (
                        <p>Invitations require a server with accounts.</p>
                    ) : account.kind === 'signedOut' ? (
                        <>
                            <p>
                                Sign in with the invited email address to review and accept this
                                invitation.
                            </p>
                            <SignInForm returnTo={invitationPath(token)} />
                        </>
                    ) : account.kind === 'signedIn' ? (
                        <>
                            <p>
                                Signed in as {account.email}.{' '}
                                <a href="/account" target="_blank" rel="noopener noreferrer">
                                    Switch account
                                </a>
                            </p>
                            {preview ? (
                                <>
                                    <h2>Join {preview.workspaceName}</h2>
                                    <p>
                                        This invitation gives you <strong>{preview.role}</strong>{' '}
                                        access to every document in this workspace, including
                                        documents added later.
                                    </p>
                                    <p>
                                        {preview.role === 'viewer'
                                            ? 'You can view documents but cannot change them.'
                                            : 'You can edit documents. Only admins can delete documents or invite others.'}
                                    </p>
                                    <p className={styles.secondary}>
                                        If you already belong to this workspace, your existing
                                        access stays unchanged.
                                    </p>
                                    <button type="button" disabled={busy} onClick={accept}>
                                        {busy
                                            ? 'Joining…'
                                            : preview.accepted
                                              ? 'Open workspace documents'
                                              : 'Accept invitation'}
                                    </button>
                                </>
                            ) : (
                                !problem && <p role="status">Checking invitation…</p>
                            )}
                        </>
                    ) : (
                        <p role="status">Loading account…</p>
                    )}
                    {problem && (
                        <div role="alert">
                            <p>{problem}</p>
                            {!preview && (
                                <button type="button" onClick={() => setAttempt(attempt + 1)}>
                                    Try again
                                </button>
                            )}
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
};
