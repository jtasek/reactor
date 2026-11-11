import React, { FC, ReactNode, createContext, useContext } from 'react';
import { useAppState } from 'src/app/hooks';
import { LABEL_OFFSET } from '../Label';
import labelStyles from '../Label/styles.css';
import type { SelectionOverlay } from 'src/app/selectionOverlays';
import styles from './styles.css';

/**
 * From this many selected shapes on, each shape shows only its outline, and the
 * selection shows one box and one size label around them all. Drawing handles and
 * a size label for every shape of a marquee over hundreds took most of its time,
 * and the handles of shapes that close together cannot be told apart anyway.
 */
export const LARGE_SELECTION = 20;

const Large = createContext(false);

/** Whether so many shapes are selected that they show one box: see `LARGE_SELECTION`. */
export const useLargeSelection = () => useContext(Large);

/**
 * Tells the shapes under it whether the selection is large. Only what reads it
 * renders again when that changes; the shapes passed in as children do not.
 */
export const LargeSelectionProvider: FC<{ children: ReactNode }> = ({ children }) => {
    const large = useAppState(
        (state) => state.currentDocument.selectedShapesIds.length >= LARGE_SELECTION
    );

    return <Large.Provider value={large}>{children}</Large.Provider>;
};

/**
 * The one box and size label around a large selection, where the selection is
 * drawn (on the Canvas or in a Screen view); nothing for a smaller one, or while
 * a drag hides the selection's overlays.
 */
export const LargeSelectionBox: FC<{ overlay: SelectionOverlay | null }> = ({ overlay }) => {
    const large = useLargeSelection();

    if (!large || !overlay) {
        return null;
    }
    const { topLeft, bottomRight, width, height } = overlay.extent;

    return (
        <g data-large-selection="">
            <rect
                className={styles.extent}
                x={topLeft.x}
                y={topLeft.y}
                width={width}
                height={height}
            />
            <text
                data-size-label
                className={labelStyles.label}
                x={topLeft.x + width / 2}
                y={bottomRight.y + LABEL_OFFSET}
                textAnchor="middle"
            >
                {`${Math.round(width)} x ${Math.round(height)}`}
            </text>
        </g>
    );
};
