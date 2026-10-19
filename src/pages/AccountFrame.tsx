import React, { type FC, type ReactNode, type MouseEventHandler } from 'react';
import styles from './Account.css';

export const AccountFrame: FC<{
    children: ReactNode;
    signedIn?: boolean;
    onBack?: MouseEventHandler<HTMLAnchorElement>;
}> = ({ children, signedIn, onBack }) => (
    <main className={styles.page}>
        <div className={styles.content}>
            <a
                className={styles.brand}
                href="/documents"
                onClick={onBack}
                aria-label="Reactor documents"
            >
                Reactor
            </a>
            <section className={styles.card}>{children}</section>
            <a className={styles.local} href="/documents" onClick={onBack}>
                {signedIn ? 'Back to Documents' : 'Continue without signing in'}
            </a>
        </div>
    </main>
);
