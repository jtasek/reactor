import React, { FC } from 'react';
import {
    FolderOpen,
    ListTree,
    LibraryBig,
    SlidersHorizontal,
    Ellipsis,
    Sparkles
} from 'lucide-react';

import { useAiAvailable } from 'src/app/aiHooks';
import { useActions, useControls } from 'src/app/hooks';
import { Icon } from '../Icon';
import { DOCK_GEOMETRY_STYLE } from '../PanelLayout/geometry';
import styles from './styles.css';

export const ApplicationBar: FC = () => {
    const { explorer, components, inspector, controlPanel } = useControls();
    const { ui, requestAiEdit } = useActions();
    const aiAvailable = useAiAvailable();

    return (
        <nav className={styles.applicationBar} aria-label="Application" style={DOCK_GEOMETRY_STYLE}>
            <a className={styles.button} href="/documents" aria-label="Documents" title="Documents">
                <Icon icon={{ component: FolderOpen, size: 20 }} />
            </a>
            <span className={styles.divider} aria-hidden="true" />
            <button
                className={styles.button}
                type="button"
                aria-label="Explorer"
                title="Explorer"
                aria-pressed={explorer.visible}
                onClick={() => ui.toggleApplicationSection('explorer')}
            >
                <Icon icon={{ component: ListTree, size: 20 }} />
            </button>
            <button
                className={styles.button}
                type="button"
                aria-label="Library"
                title="Library"
                aria-pressed={components.visible}
                onClick={() => ui.toggleApplicationSection('components')}
            >
                <Icon icon={{ component: LibraryBig, size: 20 }} />
            </button>
            <span className={styles.divider} aria-hidden="true" />
            <button
                className={styles.button}
                type="button"
                aria-label="Inspector"
                title="Inspector"
                aria-pressed={inspector.visible}
                onClick={() => ui.toggleControlVisibility('inspector')}
            >
                <Icon icon={{ component: SlidersHorizontal, size: 20 }} />
            </button>
            <button
                className={styles.button}
                type="button"
                aria-label="More panels"
                title="More panels"
                aria-pressed={controlPanel.visible}
                onClick={() => ui.toggleControlVisibility('controlPanel')}
            >
                <Icon icon={{ component: Ellipsis, size: 20 }} />
            </button>
            {aiAvailable && (
                <>
                    <span className={styles.divider} aria-hidden="true" />
                    <button
                        className={styles.button}
                        type="button"
                        aria-label="Edit with words"
                        title="Edit with words"
                        onClick={() => requestAiEdit()}
                    >
                        <Icon icon={{ component: Sparkles, size: 20 }} />
                    </button>
                </>
            )}
        </nav>
    );
};
