import React, { FC, useState } from 'react';
import { Button } from 'src/ui/components/Controls';
import { Dialog } from 'src/ui/components/Dialog';
import { SignOut } from './Account';
import styles from './Account.css';
import { legalRequest } from './LegalAgreement';

/**
 * Asks to agree to `current`, the Terms and Privacy policy version, or to sign out.
 * Only an account that agreed to an earlier version is told they were updated.
 */
export const LegalAgreementDialog: FC<{
    owner: string;
    current: string;
    agreedBefore: boolean;
}> = ({ owner, current, agreedBefore }) => {
    const [busy, setBusy] = useState(false);
    const [failure, setFailure] = useState<string>();

    const agree = async () => {
        setBusy(true);
        setFailure(undefined);

        try {
            const response = await legalRequest('POST', { version: current });

            if (response.ok) {
                // The server refused this account's other requests until now, so the page loads again.
                window.location.reload();

                return;
            }

            setFailure(
                response.status === 409
                    ? 'The terms changed since this page loaded. Reload the page to read them.'
                    : 'Your agreement could not be saved. Try again.'
            );
        } catch {
            setFailure('The server could not be reached. Try again.');
        }

        setBusy(false);
    };

    return (
        <Dialog
            title="Terms of use and Privacy policy"
            description={
                agreedBefore
                    ? `They were updated on ${current}. To keep using Reactor, read and agree to them.`
                    : 'To keep using Reactor, read and agree to them.'
            }
            visible
            actions={
                <>
                    <SignOut owner={owner} />
                    <Button kind="primary" disabled={busy} onClick={agree}>
                        {busy ? 'Saving…' : 'Agree'}
                    </Button>
                </>
            }
        >
            <p className={styles.agreement}>
                Read the{' '}
                <a href="/terms" target="_blank" rel="noopener">
                    Terms of use
                </a>{' '}
                and the{' '}
                <a href="/privacy" target="_blank" rel="noopener">
                    Privacy policy
                </a>
                .
            </p>
            {failure && <p role="alert">{failure}</p>}
        </Dialog>
    );
};
