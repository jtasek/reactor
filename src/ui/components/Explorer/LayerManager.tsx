import React, { FC, useEffect, useRef } from 'react';
import { LayersPlus, Trash2 } from 'lucide-react';
import { useActions, useAppState } from 'src/app/hooks';
import { hideAction, lockAction } from '../ItemMenu';
import { Icon } from '../Icon';
import styles from './styles.css';

const LayerRow: FC<{ layerId: string }> = ({ layerId }) => {
    const layer = useAppState((state) => state.currentDocument.layers[layerId]);
    const documentLocked = useAppState((state) => state.currentDocument.locked);
    const { updateLayer, toggleLayerVisible, toggleLayerLocked, removeLayer } = useActions();

    if (!layer) {
        return null;
    }

    const actions = [
        hideAction(!layer.visible, () => toggleLayerVisible(layerId)),
        lockAction(layer.locked, () => toggleLayerLocked(layerId))
    ];

    return (
        <li className={styles.layerRow}>
            <input
                className={styles.layerName}
                aria-label={`Name of ${layer.name}`}
                defaultValue={layer.name}
                key={layer.name}
                disabled={documentLocked}
                onBlur={(event) => {
                    const name = event.target.value.trim();

                    if (name && name !== layer.name) {
                        updateLayer({ id: layerId, name });
                    } else {
                        event.target.value = layer.name;
                    }
                }}
                onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === 'Enter') {
                        event.currentTarget.blur();
                    }
                }}
            />
            {actions.map((action) => (
                <button
                    key={action.id}
                    type="button"
                    className={styles.layerButton}
                    title={`${action.label} ${layer.name}`}
                    aria-label={`${action.label} ${layer.name}`}
                    aria-pressed={action.pressed}
                    onClick={action.onRun}
                >
                    <Icon icon={{ ...action.icon, size: 14 }} />
                </button>
            ))}
            <button
                type="button"
                className={styles.layerButton}
                title={`Delete ${layer.name}`}
                aria-label={`Delete ${layer.name}`}
                disabled={layer.locked || documentLocked}
                onClick={(event) => {
                    // The focus moves to the next layer, or New layer, before this row goes.
                    const row = event.currentTarget.closest('li');
                    const next =
                        (row?.nextElementSibling ?? row?.previousElementSibling)?.querySelector(
                            'input'
                        ) ??
                        event.currentTarget
                            .closest('[role="dialog"]')
                            ?.querySelector<HTMLElement>('[data-new-layer]');

                    next?.focus();
                    removeLayer(layerId);
                }}
            >
                <Icon icon={{ component: Trash2, size: 14 }} />
            </button>
        </li>
    );
};

/**
 * Global layers, renamed, hidden, locked, added and deleted in one place; the outline
 * itself lists objects where they are, and only filters by layer.
 */
export const LayerManager: FC<{ onClose: () => void }> = ({ onClose }) => {
    const layersIds = useAppState((state) => state.currentDocument.layersIds);
    const documentLocked = useAppState((state) => state.currentDocument.locked);
    const { addLayer } = useActions();
    const sheet = useRef<HTMLDivElement>(null);

    useEffect(() => {
        sheet.current?.querySelector<HTMLElement>('input, button')?.focus();
    }, []);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && sheet.current?.contains(event.target as Node)) {
                event.preventDefault();
                event.stopPropagation();
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown, true);

        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [onClose]);

    return (
        <div ref={sheet} className={styles.layerManager} role="dialog" aria-label="Layers">
            <div className={styles.layerManagerTitle}>
                <span>Layers</span>
                <button type="button" className={styles.done} onClick={onClose}>
                    Done
                </button>
            </div>
            <p className={styles.layerHint}>Layers group objects across all screens.</p>
            {layersIds.length > 0 && (
                <ul>
                    {layersIds.map((id) => (
                        <LayerRow key={id} layerId={id} />
                    ))}
                </ul>
            )}
            <button
                type="button"
                className={styles.newLayer}
                data-new-layer
                disabled={documentLocked}
                onClick={() => addLayer({})}
            >
                <Icon icon={{ component: LayersPlus, size: 14 }} />
                New layer
            </button>
        </div>
    );
};
