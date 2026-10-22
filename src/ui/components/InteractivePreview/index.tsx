import React, { lazy, Suspense } from 'react';

const Preview = lazy(() => import(/* webpackChunkName: "preview" */ './InteractivePreview'));
export const InteractivePreview = () => (
    <Suspense fallback={<p>Loading preview…</p>}>
        <Preview />
    </Suspense>
);
