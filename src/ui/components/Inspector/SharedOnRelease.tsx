import React, { FC, ReactNode, useEffect, useRef } from 'react';
import { useActions } from 'src/app/hooks';

/**
 * Holds the changes made through the controls in it while one is pressed, and shares
 * them once it is released (its `change` event), loses focus or goes away, as one.
 */
export const SharedOnRelease: FC<{ children: ReactNode }> = ({ children }) => {
    const { holdSharing, releaseSharing } = useActions();
    const container = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        const element = container.current;
        const release = () => releaseSharing();

        element?.addEventListener('change', release);

        return () => {
            element?.removeEventListener('change', release);
            release();
        };
    }, [releaseSharing]);

    return (
        <span ref={container} onPointerDown={() => holdSharing()} onBlur={() => releaseSharing()}>
            {children}
        </span>
    );
};
