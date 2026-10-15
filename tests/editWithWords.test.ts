import { describeOperation } from 'src/ai/describe';
import { EditWithWordsCommand } from 'src/commands/ai';
import { takesEditorInput } from 'src/events/input';
import { createTestStore } from './support/store';

function storeWithAi(ai: 'available' | 'unavailable') {
    const { store } = createTestStore();

    store.actions.setAiAvailability(ai);

    return store;
}

describe('Edit with words', () => {
    it('opens for the current document where AI is available', () => {
        const store = storeWithAi('available');

        expect(store.actions.runCommand(EditWithWordsCommand)).toBe(true);
        expect(store.state.aiEditDocumentId).toBe(store.state.currentDocumentId);
    });

    it('does not open without AI or on a locked document', () => {
        const withoutAi = storeWithAi('unavailable');

        expect(withoutAi.actions.runCommand(EditWithWordsCommand)).toBe(false);
        withoutAi.actions.requestAiEdit();
        expect(withoutAi.state.aiEditDocumentId).toBeNull();

        const locked = storeWithAi('available');

        locked.actions.lockDocument(locked.state.currentDocumentId);
        expect(locked.actions.runCommand(EditWithWordsCommand)).toBe(false);
        expect(locked.state.aiEditDocumentId).toBeNull();
    });

    it('keeps shortcuts and the clipboard from the editor while open', () => {
        const store = storeWithAi('available');

        store.actions.requestAiEdit();
        expect(takesEditorInput(store.state)).toBe(false);

        store.actions.closeAiEdit();
        expect(store.state.aiEditDocumentId).toBeNull();
        expect(takesEditorInput(store.state)).toBe(true);
    });

    it('describes each proposed operation in a line', () => {
        expect(
            describeOperation({
                op: 'addVariable',
                key: 'brand',
                name: 'Brand',
                type: 'color',
                value: '#3366ff'
            })
        ).toBe('Add color variable “Brand”: #3366ff');
        expect(
            describeOperation({
                op: 'addShape',
                key: 'title',
                shape: { type: 'text', name: 'Title', position: { x: 0, y: 0 }, value: 'Hello' }
            } as Parameters<typeof describeOperation>[0])
        ).toBe('Add text “Title”: “Hello”');
        expect(
            describeOperation({
                op: 'addShape',
                key: 'box',
                shape: {
                    type: 'rectangle',
                    position: { x: 0, y: 0 },
                    size: { width: 10, height: 10 }
                }
            } as Parameters<typeof describeOperation>[0])
        ).toBe('Add rectangle');
        expect(
            describeOperation({ op: 'addGroup', name: 'Card', rotation: 0, shapes: ['a', 'b'] })
        ).toBe('Group 2 shapes as “Card”');
    });
});
