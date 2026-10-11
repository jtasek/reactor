import React, { FC } from 'react';
import { useAppState } from 'src/app/hooks';
import { ObjectTypeSymbol } from '../ObjectTypeSymbol';
import { selectionIdentity } from '../selectionIdentity';
import styles from './styles.css';

/** The selected object's name stays visible even when its action menu is hidden. */
export const SelectionBadge: FC = () => {
    const selection = useAppState((state) => {
        if (state.events.pointer.dragging) {
            return null;
        }

        const document = state.currentDocument;

        return { identity: selectionIdentity(document), camera: document.camera };
    });

    if (!selection?.identity) {
        return null;
    }

    const { identity, camera } = selection;
    const top = identity.extent ? identity.extent.topLeft.y * camera.scale + camera.position.y : 0;
    const bottom = identity.extent
        ? identity.extent.bottomRight.y * camera.scale + camera.position.y
        : 0;
    const left = identity.extent
        ? identity.extent.topLeft.x * camera.scale + camera.position.x
        : 12;
    let badgeTop = 12;

    if (identity.extent) {
        badgeTop = top >= 72 ? top - 72 : Math.min(bottom + 46, window.innerHeight - 30);
    }

    return (
        <div
            className={styles.selectionBadge}
            data-selection-badge
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
