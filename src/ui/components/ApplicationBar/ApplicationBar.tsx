import React, { type CSSProperties, FC } from 'react';
import {
    FolderOpen,
    ListTree,
    LibraryBig,
    SlidersHorizontal,
    Ellipsis,
    Sparkles,
    Play,
    Share2,
    Braces
} from 'lucide-react';

import { usePreviewOpen } from 'src/app/previewHooks';
import { useAiAvailable } from 'src/app/aiHooks';
import { useAccount, useActions, useControls } from 'src/app/hooks';
import { RULER_SIZE_PX } from 'src/app/rulers';
import { Icon } from '../Icon';
import { DOCK_GEOMETRY_STYLE } from '../PanelLayout/geometry';
import styles from './styles.css';

export const ApplicationBar: FC = () => {
    const { explorer, components, inspector, controlPanel, rulers } = useControls();
    const previewOpen = usePreviewOpen();
    const { ui, requestAiEdit, togglePreview } = useActions();
    const aiAvailable = useAiAvailable();
    const account = useAccount();

    return (
        <nav
            className={styles.applicationBar}
            aria-label="Application"
            style={
                {
                    ...DOCK_GEOMETRY_STYLE,
                    '--ruler-size': rulers.visible ? `${RULER_SIZE_PX}px` : undefined
                } as CSSProperties
            }
        >
            <a className={styles.button} href="/documents" aria-label="Documents" title="Documents">
                <Icon icon={{ component: FolderOpen, size: 20 }} />
            </a>
            {account.kind === 'signedIn' && (
                <a className={styles.button} href="/sharing" aria-label="Sharing" title="Sharing">
                    <Icon icon={{ component: Share2, size: 20 }} />
                </a>
            )}
            <span className={styles.divider} aria-hidden="true" />
            <a className={styles.button} href="/variables" aria-label="Variables" title="Variables">
                <Icon icon={{ component: Braces, size: 20 }} />
            </a>
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
            <button
                className={styles.button}
                type="button"
                aria-label="Preview"
                title="Preview"
                aria-pressed={previewOpen}
                onClick={() => togglePreview()}
            >
                <Icon icon={{ component: Play, size: 20 }} />
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
