import React, { useState } from 'react';
import { useActions, useAppState } from 'src/app/hooks';
import { screenLayouts, viewLayoutRoot } from 'src/app/screenLayouts';
import { isFrameLocked } from 'src/app/frameState';
import { PropertyGroup } from './PropertyGroup';
import styles from './styles.css';

export function ScreenLayouts({ viewId, disabled }: { viewId: string; disabled: boolean }) {
    const { view, root, layouts, locked } = useAppState((state) => {
        const document = state.currentDocument;
        const view = document.frames[viewId];

        return {
            view,
            root: viewLayoutRoot(document, view),
            layouts: screenLayouts(document, view?.screenId ?? ''),
            locked: isFrameLocked(document, view?.screenId ?? '')
        };
    });
    const { editFrame } = useActions();
    const [name, setName] = useState('');

    if (!view) {
        return null;
    }

    const unavailable = Boolean(
        view.layoutId && !layouts.some((layout) => layout.id === view.layoutId)
    );

    return (
        <PropertyGroup name="Layout">
            <tr>
                <th scope="row">
                    <label htmlFor="screen-view-layout">Artwork</label>
                </th>
                <td>
                    <select
                        id="screen-view-layout"
                        aria-label="Screen view layout"
                        value={view.layoutId ?? ''}
                        disabled={disabled || locked}
                        onChange={(event) =>
                            editFrame({
                                kind: 'update',
                                id: viewId,
                                changes: { layoutId: event.target.value || null }
                            })
                        }
                    >
                        <option value="">Default layout</option>
                        {unavailable && (
                            <option value={view.layoutId}>Missing layout — showing default</option>
                        )}
                        {layouts.map((layout) => (
                            <option key={layout.id} value={layout.id}>
                                {layout.name}
                            </option>
                        ))}
                    </select>
                </td>
            </tr>
            <tr>
                <td colSpan={2}>
                    <small className={styles.frameHint}>
                        {root?.screenLayout
                            ? `Edits belong to “${root.name}”. Other layouts stay unchanged.`
                            : 'Edits belong to the default layout.'}{' '}
                        All layouts share this screen’s navigation destination.
                    </small>
                </td>
            </tr>
            <tr>
                <td colSpan={2}>
                    <button
                        type="button"
                        disabled={!root}
                        onClick={() => root && editFrame({ kind: 'select', id: root.id })}
                    >
                        Edit layout settings
                    </button>
                </td>
            </tr>
            <tr>
                <th scope="row">
                    <label htmlFor="screen-layout-name">New layout</label>
                </th>
                <td>
                    <input
                        id="screen-layout-name"
                        aria-label="New layout name"
                        value={name}
                        placeholder="e.g. Compact"
                        disabled={disabled || locked}
                        onChange={(event) => setName(event.target.value)}
                    />
                </td>
            </tr>
            <tr>
                <td colSpan={2}>
                    <button
                        type="button"
                        disabled={
                            disabled ||
                            locked ||
                            !name.trim() ||
                            layouts.some((layout) => layout.name === name.trim())
                        }
                        onClick={() => {
                            const id = editFrame({ kind: 'addLayout', viewId, name });
                            if (id) {
                                setName('');
                            }
                        }}
                    >
                        Create empty layout
                    </button>
                </td>
            </tr>
        </PropertyGroup>
    );
}
