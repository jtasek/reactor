import React, { FC } from 'react';
import { LayerPanelItem } from './LayerPanelItem';
import styles from './styles.css';
import { useActions, useShownLayerId } from 'src/app/hooks';

export interface Props {
    layersIds: string[];
    detached: boolean;
    onPlacementChange: () => void;
    onHighlight?: () => void;
}

export const LayerPanel: FC<Props> = ({ layersIds, detached, onPlacementChange, onHighlight }) => {
    const shownLayerId = useShownLayerId();
    const { showAllLayers } = useActions();

    return (
        <section className={styles.layerPanel} aria-label="Layers">
            <button type="button" onClick={onPlacementChange}>
                {detached ? 'Return to document menu' : 'Detach panel'}
            </button>
            <button
                type="button"
                data-layer-highlight
                aria-pressed={!shownLayerId}
                onClick={() => {
                    showAllLayers();
                    onHighlight?.();
                }}
            >
                Show all layers
            </button>
            <ul>
                {layersIds.length === 0 && <li>No layers available</li>}
                {layersIds.map((layerId) => (
                    <LayerPanelItem key={layerId} layerId={layerId} onHighlight={onHighlight} />
                ))}
            </ul>
        </section>
    );
};
