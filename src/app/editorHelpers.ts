import type * as Alignment from './alignment';
import type * as Clipboard from './clipboard';
import type * as Snapping from './snapping';

/**
 * Code only the editor's gestures and commands run: snapping, aligning and the
 * clipboard's format. The editor page provides it as it loads (`registerEditor`),
 * so startup and the other pages go without it; actions reach it through
 * `editorHelpers`, which only runs once the editor has loaded.
 */
export interface EditorHelpers {
    alignment: typeof Alignment;
    clipboard: typeof Clipboard;
    snapping: typeof Snapping;
}

let provided: EditorHelpers | undefined;

export const provideEditorHelpers = (helpers: EditorHelpers) => {
    provided = helpers;
};

export function editorHelpers(): EditorHelpers {
    if (!provided) {
        throw new Error('The editor has not loaded its helpers');
    }

    return provided;
}
