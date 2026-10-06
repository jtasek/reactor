import { getCommands, getTools } from 'src/app/actions/startup';
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
});
