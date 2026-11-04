import { CREATION_PATTERN } from './creation';
import { editorForInput } from './parameters';
import type { Suggestion } from './search';

const RECENT_LIMIT = 8;
const DOCUMENT_LIMIT = 16;
// Palette UI state only: never saved into documents, storage, or collaboration.
const histories = new Map<string, string[]>();

export const recentCommands = (documentId: string): string[] => histories.get(documentId) ?? [];

export function rememberCommand(documentId: string, command: string): string[] {
    const input = command.trim();
    const next = [input, ...recentCommands(documentId).filter((item) => item !== input)].slice(
        0,
        RECENT_LIMIT
    );
    histories.delete(documentId);
    histories.set(documentId, next);
    if (histories.size > DOCUMENT_LIMIT) {
        histories.delete(histories.keys().next().value!);
    }

    return next;
}

export const clearRecentCommands = (documentId: string) => {
    histories.delete(documentId);
};

/** Resolve presentation and availability from today's catalogue, not recorded metadata. */
export function recentSuggestion(input: string, suggestions: Suggestion[]): Suggestion {
    const query = input.toLowerCase();
    const exact = suggestions.find(
        (item) => item.id.toLowerCase() === query || item.name.toLowerCase() === query
    );
    const creation = CREATION_PATTERN.exec(input);
    const editor = editorForInput(input);
    const actionId = recentAction();
    function recentAction() {
        if (creation) {
            return `create ${creation[1].toLowerCase()}`;
        }
        if (!editor) {
            return undefined;
        }
        if (editor.prefix === 'bind') {
            return 'bind variable';
        }
        if (editor.prefix === 'unbind') {
            return 'unbind variable';
        }
        if (editor.prefix === 'move') {
            return 'edit position';
        }
        if (['value', 'fontSize', 'fontColor'].some((key) => key in editor.values)) {
            return 'edit text';
        }
        if (['fill', 'stroke'].some((key) => key in editor.values)) {
            return 'edit colors';
        }
        if (['gap', 'padding'].some((key) => key in editor.values)) {
            return 'edit stack';
        }
        if ('radius' in editor.values && Object.keys(editor.values).length === 1) {
            return 'edit radius';
        }

        return 'edit size';
    }
    const action = exact ?? suggestions.find((item) => item.id === actionId);

    return {
        id: `recent:${input}`,
        name: action?.name ?? input,
        description: input,
        input,
        icon: action?.icon,
        enabled: action?.enabled ?? false,
        unavailable:
            action?.unavailable ?? (!action ? 'This command is no longer available.' : undefined)
    };
}
