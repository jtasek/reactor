import React, { FC, Suspense, lazy, useEffect, useState } from 'react';
import { settleTerms } from 'src/app/termsCheck';

const LegalAgreementDialog = lazy(() =>
    import('./LegalAgreementDialog').then((module) => ({ default: module.LegalAgreementDialog }))
);

type Agreement = { version: string; agreed: string | null };

export const legalRequest = (method: string, body?: object) =>
    fetch('/api/legal', {
        method,
        credentials: 'same-origin',
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body: body && JSON.stringify(body)
    });

/**
 * Asks a signed-in account that has not agreed to the current Terms of use and
 * Privacy policy to agree, or to sign out. Accounts made before the terms, or
 * before they last changed, are asked once. The dialog loads only when needed.
 */
export const LegalAgreement: FC<{ owner: string }> = ({ owner }) => {
    const [agreement, setAgreement] = useState<Agreement>();

    useEffect(() => {
        void legalRequest('GET')
            .then((response) => (response.ok ? (response.json() as Promise<Agreement>) : undefined))
            .then((agreement) => {
                if (agreement && agreement.agreed !== agreement.version) {
                    setAgreement(agreement);
                } else {
                    settleTerms(owner);
                }
            })
            // Asked again on the next start.
            .catch(() => settleTerms(owner));
    }, [owner]);

    return agreement ? (
        <Suspense fallback={null}>
            <LegalAgreementDialog
                owner={owner}
                current={agreement.version}
                agreedBefore={agreement.agreed !== null}
            />
        </Suspense>
    ) : null;
};
