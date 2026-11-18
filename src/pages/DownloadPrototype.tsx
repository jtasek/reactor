import { Download } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { Icon } from 'src/ui/components/Icon';
import { useActions, useAppState, useEffects } from 'src/app/hooks';
import { projectPreview, type PreviewSession, type PreviewInspection } from 'src/preview/project';
import { createPreviewResources } from 'src/preview/resources';
import {
    fetchPackageTemplate,
    packageFileName,
    writeStandalonePackage
} from 'src/preview/standalonePackage';

/** Saves the prototype as one web page that plays offline, as a shared link would. */
export function DownloadPrototype({
    session,
    inspection
}: {
    session: PreviewSession;
    inspection: PreviewInspection;
}) {
    const { document, busy } = useAppState((state) => ({
        document: state.currentDocument,
        busy: state.events.pointer.gesture.kind !== 'idle' || state.guideDragActive
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
            const drawing = projectPreview(document, {}, [], session, inspection);
            if (!drawing.screens.length || drawing.screens[0].id !== session.screenId) {
                throw new Error('Choose an available start page before downloading.');
            }
            const [application, template] = await Promise.all([
                createPreviewResources(assets)(drawing, controller.signal),
                fetchPackageTemplate(controller.signal)
            ]);
            const page = writeStandalonePackage(template, document.name, application);
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
            aria-label="Download prototype"
            title="Download as a web page that plays offline"
            disabled={pending || busy || !session.screenId}
            onClick={() => void download()}
        >
            <Icon icon={{ component: Download, size: 18 }} />
            {pending ? 'Preparing…' : 'Download'}
        </button>
    );
}
