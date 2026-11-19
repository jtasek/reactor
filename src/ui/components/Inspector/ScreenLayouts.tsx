import React, { useState } from 'react';
import { useActions, useAppState } from 'src/app/hooks';
import { screenLayouts, viewLayoutRoot } from 'src/app/screenLayouts';
import { isFrameLocked } from 'src/app/frameState';
import { ResponsiveLayouts } from './ResponsiveLayouts';
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
        <>
            <PropertyGroup name="Design">
                <tr>
                    <th scope="row">
                        <label htmlFor="screen-view-layout">Shows</label>
                    </th>
                    <td>
                        <select
                            id="screen-view-layout"
                            className={styles.layoutChoice}
                            aria-label="Design at this size"
                            value={view.layoutId ?? (view.layoutMode === 'auto' ? '__auto' : '')}
                            disabled={disabled || locked}
                            onChange={(event) =>
                                editFrame({
                                    kind: 'update',
                                    id: viewId,
                                    changes: {
                                        layoutId:
                                            event.target.value === '__auto'
                                                ? null
                                                : event.target.value || null,
                                        layoutMode: event.target.value === '__auto' ? 'auto' : null
                                    }
                                })
                            }
                        >
                            <option value="__auto">Auto · Width</option>
                            <option value="">Main design</option>
                            {unavailable && (
                                <option value={view.layoutId}>
                                    Missing design — showing the main design
                                </option>
                            )}
                            {layouts.map((layout) => (
                                <option key={layout.id} value={layout.id}>
                                    {layout.name}
                                </option>
                            ))}
                        </select>
                    </td>
                </tr>
                <tr className={styles.footnote}>
                    <td colSpan={2}>
                        <small className={styles.frameHint}>
                            {root?.screenLayout
                                ? `Edits belong to the separate design “${root.name}” and don’t reach other sizes.`
                                : 'Edits belong to the main design, shared by every size that shows it.'}{' '}
                            Every design is the same page for navigation.
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
                            Edit design settings
                        </button>
                    </td>
                </tr>
                <tr>
                    <th scope="row">
                        <label htmlFor="screen-layout-name">Separate design</label>
                    </th>
                    <td>
                        <input
                            id="screen-layout-name"
                            type="text"
                            aria-label="Separate design name"
                            value={name}
                            placeholder="e.g. Mobile"
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
                            Create separate design
                        </button>
                    </td>
                </tr>
            </PropertyGroup>
            <ResponsiveLayouts screenId={view.screenId!} disabled={disabled || locked} />
        </>
    );
}
