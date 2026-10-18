import React, { FC, ReactNode, useEffect, useRef } from 'react';
import { useActions } from 'src/app/hooks';

/**
 * Holds the changes made through the controls in it while one is pressed, and shares
 * them once it is released (its `change` event), loses focus or goes away, as one.
 * A color field also holds when clicked, since a label or a key can open its picker
 * without a press on the field itself.
 */
export const SharedOnRelease: FC<{ children: ReactNode }> = ({ children }) => {
    const { holdSharing, releaseSharing } = useActions();
    const container = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        const element = container.current;
        const release = () => releaseSharing();
        const holdPicker = (event: MouseEvent) => {
            if (event.target instanceof HTMLInputElement && event.target.type === 'color') {
                holdSharing();
            }
        };

        element?.addEventListener('change', release);
        element?.addEventListener('click', holdPicker);

        return () => {
            element?.removeEventListener('change', release);
            element?.removeEventListener('click', holdPicker);
            release();
        };
    }, [holdSharing, releaseSharing]);

    return (
        <span ref={container} onPointerDown={() => holdSharing()} onBlur={() => releaseSharing()}>
            {children}
        </span>
    );
};
