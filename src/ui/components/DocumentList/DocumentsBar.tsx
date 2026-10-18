import React, { FC } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useAccount, useCurrentDocument } from 'src/app/hooks';
import { AccountInfo, SaveStatusInfo } from '../StatusBar';
import styles from './styles.css';

/** Leads back to the open document, and shows whether work is saved and who is signed in. */
export const DocumentsBar: FC = () => {
    const { name, deleted } = useCurrentDocument();
    const account = useAccount();

    return (
        <nav className={styles.bar} aria-label="Documents page">
            {!deleted && (
                <a className={styles.back} href="/" title={`Back to ${name}`}>
                    <ChevronLeft size={18} strokeWidth={1.5} aria-hidden="true" />
                    <span>{name}</span>
                </a>
            )}
            {account.kind === 'signedIn' && (
                <a className={styles.back} href="/sharing">
                    Sharing
                </a>
            )}
            <span className={styles.barStatus}>
                <SaveStatusInfo />
                <AccountInfo />
            </span>
        </nav>
    );
};
