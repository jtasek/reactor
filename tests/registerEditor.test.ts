import { getCommand, getCommands, getTools, registerCommand } from 'src/app/actions/startup';
import * as snapping from 'src/app/snapping';
import { editorHelpers, editorLoaded } from 'src/app/editorHelpers';
import { takesEditorInput } from 'src/events/input';
import { registerEditor } from 'src/pages/registerEditor';
import { createTestStore } from './support/store';

describe('the editor’s commands and tools', () => {
    it('are not registered at startup, but by the editor page, once', async () => {
        const { store } = createTestStore();

        await store.onInitialize();

        expect(getCommands()).toEqual([]);
        expect(getTools()).toEqual([]);

        registerEditor();
        const commands = getCommands().map((command) => command.id);
        const tools = getTools().map((tool) => tool.id);

        registerEditor();

        expect(commands).toContain('delete');
        expect(tools).toContain('select');
        expect(getCommands().map((command) => command.id)).toEqual(commands);
        expect(getTools().map((tool) => tool.id)).toEqual(tools);
    });

    it('takes a changed command registered again, in its place, as a hot update does', () => {
        registerEditor();
        const order = getCommands().map((command) => command.id);
        const changed = { ...getCommand('delete'), name: 'Remove' };

        registerCommand(changed);

        expect(getCommand('delete')).toBe(changed);
        expect(getCommands().map((command) => command.id)).toEqual(order);
    });

    it('provides the helpers the editor’s actions run, which it takes no input without', async () => {
        const { store } = createTestStore({}, { editorLoaded: false });

        await store.onInitialize();

        expect(store.state.currentPage).toBe('designer');
        expect(editorLoaded()).toBe(false);
        // Its code still loading, the editor takes no shortcut nor copy or paste.
        expect(takesEditorInput(store.state)).toBe(false);
        expect(() => editorHelpers()).toThrow();

        registerEditor();

        expect(editorHelpers().snapping).toBe(snapping);
        expect(takesEditorInput(store.state)).toBe(true);
    });
});
