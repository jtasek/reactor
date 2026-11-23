import React, { FC, useState } from 'react';
import { Dialog } from 'src/ui/components/Dialog';
import { SignOut } from './Account';
import styles from './Account.css';
import { legalRequest } from './LegalAgreement';

/** Asks to agree to `current`, the Terms and Privacy policy version, or to sign out. */
export const LegalAgreementDialog: FC<{ owner: string; current: string }> = ({
    owner,
    current
}) => {
    const [version, setVersion] = useState<string | undefined>(current);
    const [busy, setBusy] = useState(false);
    const [failure, setFailure] = useState<string>();

    const agree = async () => {
        if (!version) {
            return;
        }

        setBusy(true);
        setFailure(undefined);

        try {
            const response = await legalRequest('POST', { version });

            if (response.ok) {
                setVersion(undefined);
            } else {
                setFailure(
                    response.status === 409
                        ? 'The terms changed since this page loaded. Reload the page to read them.'
                        : 'Your agreement could not be saved. Try again.'
                );
            }
        } catch {
            setFailure('The server could not be reached. Try again.');
        }

        setBusy(false);
    };

    return (
        <Dialog
            title="Terms of use and Privacy policy"
            description={`They were updated on ${version}. To keep using Reactor, read and agree to them.`}
            visible={version !== undefined}
            onClose={() => {}}
            actions={
                <>
                    <SignOut owner={owner} />
                    <button type="button" data-variant="primary" disabled={busy} onClick={agree}>
                        {busy ? 'Saving…' : 'Agree'}
                    </button>
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
