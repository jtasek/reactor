import type { SelectionOverlay } from 'src/app/selectionOverlays';
import React, { FC } from 'react';
import { useAppState } from 'src/app/hooks';
import { ObjectTypeSymbol } from '../ObjectTypeSymbol';
import { selectionIdentity } from '../selectionIdentity';
import styles from './styles.css';

const BADGE_OFFSET = 24;

/** The selected object's name stays visible even when its action menu is hidden. */
export const SelectionBadge: FC<{ overlay: SelectionOverlay | null }> = ({ overlay }) => {
    const selection = useAppState(() =>
        overlay
            ? { identity: selectionIdentity(overlay.document), camera: overlay.document.camera }
            : null
    );

    if (!selection?.identity) {
        return null;
    }

    const { identity, camera } = selection;

    if (identity.type !== 'component' && identity.type !== 'instance') {
        return null;
    }

    const top = identity.extent ? identity.extent.topLeft.y * camera.scale + camera.position.y : 0;
    const bottom = identity.extent
        ? identity.extent.bottomRight.y * camera.scale + camera.position.y
        : 0;
    const left = identity.extent
        ? identity.extent.topLeft.x * camera.scale + camera.position.x
        : 12;
    let badgeTop = 12;

    if (identity.extent) {
        badgeTop =
            top >= BADGE_OFFSET
                ? top - BADGE_OFFSET
                : Math.min(bottom + 6, window.innerHeight - BADGE_OFFSET);
    }

    return (
        <div
            className={styles.selectionBadge}
            data-selection-badge
            data-object-type={identity.type}
            style={{
                left: Math.max(4, Math.min(left, window.innerWidth - 180)),
                top: badgeTop
            }}
            title={identity.name}
        >
            <ObjectTypeSymbol type={identity.type} />
            <span>{identity.name}</span>
        </div>
    );
};
