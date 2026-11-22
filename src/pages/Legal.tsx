import React, { FC } from 'react';
import { LEGAL_VERSION } from 'src/shared/legal';
import styles from './Account.css';
import { PRIVACY, TERMS } from './legalText';

const LEGAL_PAGES = { terms: TERMS, privacy: PRIVACY };

/** The Terms of use or the Privacy policy, readable signed in or out. */
export const Legal: FC<{ page: keyof typeof LEGAL_PAGES }> = ({ page }) => {
    const { title, sections } = LEGAL_PAGES[page];

    return (
        <main className={styles.page}>
            <div className={`${styles.content} ${styles.wide}`}>
                <a className={styles.brand} href="/documents" aria-label="Reactor documents">
                    Reactor
                </a>
                <article className={`${styles.card} ${styles.legal}`}>
                    <h1>{title}</h1>
                    <p className={styles.secondary}>
                        Last updated <time dateTime={LEGAL_VERSION}>{LEGAL_VERSION}</time>
                    </p>
                    {sections.map(({ heading, paragraphs }) => (
                        <section key={heading}>
                            <h2>{heading}</h2>
                            {paragraphs.map((paragraph) => (
                                <p key={paragraph}>{paragraph}</p>
                            ))}
                        </section>
                    ))}
                </article>
                <nav className={styles.modes} aria-label="Policies">
                    <a href={page === 'terms' ? '/privacy' : '/terms'}>
                        {page === 'terms' ? PRIVACY.title : TERMS.title}
                    </a>
                    <a href="/documents">Back to Documents</a>
                </nav>
            </div>
        </main>
    );
};
