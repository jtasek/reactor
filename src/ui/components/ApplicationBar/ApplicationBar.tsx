import React, { FC } from 'react';

import { useActions, useControls } from 'src/app/hooks';
import { Icon } from '../Icon';
import { DOCK_GEOMETRY_STYLE } from '../PanelLayout/geometry';
import styles from './styles.css';

export const ApplicationBar: FC = () => {
    const { explorer, components, inspector, controlPanel } = useControls();
    const { ui } = useActions();

    return (
        <nav className={styles.applicationBar} aria-label="Application" style={DOCK_GEOMETRY_STYLE}>
            <a className={styles.button} href="/documents" aria-label="Documents" title="Documents">
                <Icon icon={{ group: 'file', name: 'folder_open', size: 20 }} />
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
                <Icon icon={{ group: 'action', name: 'view_list', size: 20 }} />
            </button>
            <button
                className={styles.button}
                type="button"
                aria-label="Library"
                title="Library"
                aria-pressed={components.visible}
                onClick={() => ui.toggleApplicationSection('components')}
            >
                <Icon icon={{ group: 'image', name: 'collections_bookmark', size: 20 }} />
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
                <Icon icon={{ group: 'image', name: 'tune', size: 20 }} />
            </button>
            <button
                className={styles.button}
                type="button"
                aria-label="More panels"
                title="More panels"
                aria-pressed={controlPanel.visible}
                onClick={() => ui.toggleControlVisibility('controlPanel')}
            >
                <Icon icon={{ group: 'navigation', name: 'more_horiz', size: 20 }} />
            </button>
        </nav>
    );
};
