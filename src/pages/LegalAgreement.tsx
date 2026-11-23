import React, { FC, useEffect, useState } from 'react';
import { Dialog } from 'src/ui/components/Dialog';
import { SignOut } from './Account';
import styles from './Account.css';

type Agreement = { version: string; agreed: string | null };

const request = (method: string, body?: object) =>
    fetch('/api/legal', {
        method,
        credentials: 'same-origin',
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body: body && JSON.stringify(body)
    });

/**
 * Asks a signed-in account that has not agreed to the current Terms of use and
 * Privacy policy to agree, or to sign out. Accounts made before the terms, or
 * before they last changed, are asked once.
 */
export const LegalAgreement: FC<{ owner: string }> = ({ owner }) => {
    const [version, setVersion] = useState<string>();
    const [busy, setBusy] = useState(false);
    const [failure, setFailure] = useState<string>();

    useEffect(() => {
        void request('GET')
            .then((response) => (response.ok ? (response.json() as Promise<Agreement>) : undefined))
            .then((agreement) => {
                if (agreement && agreement.agreed !== agreement.version) {
                    setVersion(agreement.version);
                }
            })
            // Asked again on the next start.
            .catch(() => undefined);
    }, [owner]);

    const agree = async () => {
        if (!version) {
            return;
        }

        setBusy(true);
        setFailure(undefined);

        try {
            const response = await request('POST', { version });

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
