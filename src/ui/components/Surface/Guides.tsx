import React, { FC, lazy, Suspense } from 'react';
import { useControls } from 'src/app/hooks';
import { Camera } from 'src/app/types';

const GuideLines = lazy(() =>
    import(/* webpackChunkName: "guides" */ '../Guide').then((module) => ({
        default: module.Guides
    }))
);

const LoadedGuideGrips = lazy(() =>
    import(/* webpackChunkName: "guides" */ '../Guide').then((module) => ({
        default: module.GuideGrips
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

/** What grabs the guides, under the shapes, loaded with them. */
export const GuideGrips: FC = () => {
    const { guides: control } = useControls();

    if (!control.visible) {
        return null;
    }

    return (
        <Suspense fallback={null}>
            <LoadedGuideGrips />
        </Suspense>
    );
};
