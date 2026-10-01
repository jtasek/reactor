import { useEffect } from 'react';
import { useActions } from '../../app/hooks';
import { isTextEntry } from './helpers';

/**
 * Leaves the browser's own copy, cut and paste to text fields and to text
 * selected on the page.
 */
const isNativeClipboard = (event: ClipboardEvent) =>
    isTextEntry(event.target) || window.getSelection()?.isCollapsed === false;

/** Copies, cuts and pastes shapes through the browser's clipboard events. */
export const useClipboardDriver = () => {
    const { copySelection, cutSelection, pasteShapes } = useActions();

    useEffect(() => {
        const write = (take: () => string | null) => (event: ClipboardEvent) => {
            if (!event.clipboardData || isNativeClipboard(event)) {
                return;
            }

            const text = take();

            if (text !== null) {
                event.clipboardData.setData('text/plain', text);
                event.preventDefault();
            }
        };
        const handleCopy = write(copySelection);
        const handleCut = write(cutSelection);
        const handlePaste = (event: ClipboardEvent) => {
            if (!event.clipboardData || isTextEntry(event.target)) {
                return;
            }

            if (pasteShapes(event.clipboardData.getData('text/plain'))) {
                event.preventDefault();
            }
        };

        document.addEventListener('copy', handleCopy);
        document.addEventListener('cut', handleCut);
        document.addEventListener('paste', handlePaste);

        return () => {
            document.removeEventListener('copy', handleCopy);
            document.removeEventListener('cut', handleCut);
            document.removeEventListener('paste', handlePaste);
        };
    }, [copySelection, cutSelection, pasteShapes]);
};
