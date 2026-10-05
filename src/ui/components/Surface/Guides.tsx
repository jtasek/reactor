import React, { FC, lazy, Suspense } from 'react';
import { useControls } from 'src/app/hooks';
import { Camera } from 'src/app/types';

const GuideLines = lazy(() =>
    import(/* webpackChunkName: "guides" */ '../Guide').then((module) => ({
        default: module.Guides
    }))
);

interface Props {
    camera?: Camera;
}

/** The document's guides, loaded the first time the Guides control is turned on. */
export const Guides: FC<Props> = ({ camera }) => {
    const { guides: control } = useControls();

    if (!control.visible) {
        return null;
    }

    return (
        <Suspense fallback={null}>
            <GuideLines camera={camera} />
        </Suspense>
    );
};
