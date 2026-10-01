/** The browser's asynchronous clipboard, which commands use outside a clipboard event. */
export type SystemClipboard = Pick<Clipboard, 'readText' | 'writeText'>;

/** The root actions that apply what the clipboard answers. */
interface ClipboardActions {
    pasteShapes: (text: string) => boolean;
    displayError: (message: string) => void;
}

/**
 * Copies and pastes for commands. Reading and writing the clipboard is
 * asynchronous, so a paste is applied through the root actions `connect` gives,
 * once startup has run.
 */
export function createClipboard(system: SystemClipboard | undefined) {
    let actions: ClipboardActions | undefined;
    // Pages served over plain HTTP, other than localhost, have no clipboard.
    const unavailable = () => Promise.reject(new Error('The clipboard is unavailable'));

    return {
        connect(root: ClipboardActions) {
            actions = root;
        },

        async copy(text: string) {
            try {
                await (system ? system.writeText(text) : unavailable());
            } catch {
                actions?.displayError('The clipboard could not be written. Press Ctrl/Cmd+C.');
            }
        },

        async paste() {
            let text: string;

            try {
                text = await (system ? system.readText() : unavailable());
            } catch {
                actions?.displayError(
                    'The clipboard could not be read. Allow this site to read it, or press Ctrl/Cmd+V.'
                );

                return;
            }

            if (actions && !actions.pasteShapes(text)) {
                actions.displayError('The clipboard holds no shapes to paste.');
            }
        }
    };
}

export const clipboard = createClipboard(globalThis.navigator?.clipboard);
