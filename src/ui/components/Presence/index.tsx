import React, { FC, lazy, Suspense } from 'react';
import { useAppState } from 'src/app/hooks';

const LoadedPresence = lazy(() =>
    import(/* webpackChunkName: "presence" */ './Presence').then((module) => ({
        default: module.Presence
    }))
);

/** Other people's pointers and selections; only signed in, where documents are shared. */
export const Presence: FC = () =>
    useAppState((state) => state.account.kind === 'signedIn') ? (
        <Suspense fallback={null}>
            <LoadedPresence />
        </Suspense>
    ) : null;
