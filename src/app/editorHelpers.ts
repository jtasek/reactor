import type * as Aliases from './variableAliases';
import type * as Alignment from './alignment';
import type * as Clipboard from './clipboard';
import type * as OperationBatches from './operationBatches';
import type * as Snapping from './snapping';

/**
 * Code only the editor's gestures and commands run: snapping, aligning, the
 * clipboard's format, alias edits and applying operations. The editor page provides it as it loads (`registerEditor`),
 * so startup and the other pages go without it; actions reach it through
 * `editorHelpers`, which only runs once the editor has loaded.
 */
export interface EditorHelpers {
    aliases: typeof Aliases;
    alignment: typeof Alignment;
    clipboard: typeof Clipboard;
    operations: typeof OperationBatches;
    snapping: typeof Snapping;
}

let provided: EditorHelpers | undefined;
const listeners = new Set<() => void>();

/** Provides the helpers, or, with none, takes them away again, as before the editor loads. */
export const provideEditorHelpers = (helpers: EditorHelpers | undefined) => {
    provided = helpers;
    listeners.forEach((listener) => listener());
};

/** Calls `listener` whenever the helpers are provided or taken away; returns how to stop. */
export const subscribeToEditorHelpers = (listener: () => void) => {
    listeners.add(listener);

    return () => {
        listeners.delete(listener);
    };
};

/** Whether the editor has loaded and provided its helpers, so its actions can run. */
export const editorLoaded = () => provided !== undefined;

export function editorHelpers(): EditorHelpers {
    if (!provided) {
        throw new Error('The editor has not loaded its helpers');
    }

    return provided;
}
