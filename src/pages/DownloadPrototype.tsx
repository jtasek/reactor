import { Download } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { Icon } from 'src/ui/components/Icon';
import { useActions, useAppState, useEffects } from 'src/app/hooks';
import type { PreviewSession, PreviewInspection } from 'src/preview/project';
import {
    fetchPackageTemplate,
    packageContents,
    packageFileName,
    writeStandalonePackage
} from 'src/preview/standalonePackage';
import type { CheckContext } from 'src/app/accessibilityCheck';
import styles from './Prototype.css';

/** Saves the prototype as one web page that plays offline, as a shared link would. */
export function DownloadPrototype({
    session,
    inspection,
    contexts
}: {
    session: PreviewSession;
    inspection: PreviewInspection;
    /** Other modes and sizes the page can be viewed in. */
    contexts: readonly CheckContext[];
}) {
    const { document, busy, rules } = useAppState((state) => ({
        document: state.currentDocument,
        busy: state.events.pointer.gesture.kind !== 'idle' || state.guideDragActive,
        rules: state.config.accessibility
    }));
    const { assets } = useEffects();
    const { displayError } = useActions();
    const [pending, setPending] = useState(false);
    const operation = useRef<AbortController | null>(null);
    useEffect(() => () => operation.current?.abort(), []);

    async function download() {
        const controller = new AbortController();
        operation.current = controller;
        setPending(true);
        try {
            const [{ application, extras }, template] = await Promise.all([
                packageContents(
                    document,
                    session,
                    inspection,
                    contexts,
                    rules,
                    assets,
                    controller.signal
                ),
                fetchPackageTemplate(controller.signal)
            ]);
            const page = writeStandalonePackage(template, document.name, application, extras);
            const url = URL.createObjectURL(new Blob([page], { type: 'text/html' }));
            const link = window.document.createElement('a');
            link.href = url;
            link.download = packageFileName(document.name);
            link.click();
            // Give the browser time to consume the object URL before releasing it.
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (error) {
            if (!controller.signal.aborted) {
                // Stop the other half of the work, which may still be reading images.
                controller.abort();
                setPending(false);
                displayError(
                    error instanceof Error
                        ? error.message
                        : 'The prototype could not be downloaded.'
                );
            }
        } finally {
            if (!controller.signal.aborted) {
                setPending(false);
            }
        }
    }

    return (
        <button
            className={styles.roundButton}
            aria-label="Download prototype"
            title={pending ? 'Preparing…' : 'Download as a web page that plays offline'}
            aria-busy={pending}
            disabled={pending || busy || !session.screenId}
            onClick={() => void download()}
        >
            <Icon icon={{ component: Download, size: 18 }} />
        </button>
    );
}
