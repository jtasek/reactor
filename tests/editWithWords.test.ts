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

    it('keeps canvas shortcuts and the clipboard available while chat is open', () => {
        const store = storeWithAi('available');

        store.actions.requestAiEdit();
        expect(takesEditorInput(store.state)).toBe(true);

        store.actions.closeAiEdit();
        expect(store.state.aiEditDocumentId).toBeNull();
        expect(takesEditorInput(store.state)).toBe(true);
    });

    it('describes each proposed operation in a line', () => {
        const document = storeWithAi('available').state.currentDocument;
        const describe = (operation: Parameters<typeof describeOperation>[0]) =>
            describeOperation(operation, document);

        expect(
            describe({
                op: 'addVariable',
                key: 'brand',
                name: 'Brand',
                type: 'color',
                value: '#3366ff'
            })
        ).toBe('Add color variable “Brand”: #3366ff');
        expect(
            describe({
                op: 'addShape',
                key: 'title',
                shape: { type: 'text', name: 'Title', position: { x: 0, y: 0 }, value: 'Hello' }
            } as Parameters<typeof describeOperation>[0])
        ).toBe('Add text “Title”: “Hello”');
        expect(
            describe({
                op: 'addShape',
                key: 'box',
                shape: {
                    type: 'rectangle',
                    position: { x: 0, y: 0 },
                    size: { width: 10, height: 10 }
                }
            } as Parameters<typeof describeOperation>[0])
        ).toBe('Add rectangle');
        expect(describe({ op: 'addGroup', name: 'Card', rotation: 0, shapes: ['a', 'b'] })).toBe(
            'Group 2 shapes as “Card”'
        );
    });

    it('names the records a proposed change or deletion acts on', () => {
        const store = storeWithAi('available');
        const brand = store.actions.createVariable({
            name: 'Brand',
            type: 'color',
            value: '#3366ff'
        })!;

        store.actions.addShape({
            type: 'rectangle',
            name: 'Footer',
            position: { x: 0, y: 0 },
            size: { width: 10, height: 10 }
        });
        store.actions.addShape({
            type: 'text',
            name: 'Title',
            position: { x: 0, y: 0 },
            value: 'Hi'
        });
        store.actions.addGroup({ id: 'card', name: 'Card' });

        const document = store.state.currentDocument;
        const [footer, title] = document.shapesIds;
        const describe = (operation: Parameters<typeof describeOperation>[0]) =>
            describeOperation(operation, document);

        expect(
            describe({ op: 'updateShape', shape: footer, changes: { fill: '#ff0000', opacity: 1 } })
        ).toBe('Change rectangle “Footer”: fill, opacity');
        expect(describe({ op: 'updateShape', shape: title, changes: { value: 'Welcome' } })).toBe(
            'Change text “Title”: text “Welcome”'
        );
        store.actions.bindProperty({ shapeIds: [footer], key: 'fill', variableId: brand });
        expect(describe({ op: 'updateShape', shape: footer, changes: { fill: '#3366ff' } })).toBe(
            'Change rectangle “Footer”: fill; stops following color variable “Brand”'
        );
        expect(
            describe({
                op: 'updateShape',
                shape: footer,
                changes: { fill: '#3366ff', bindings: { fill: brand } }
            })
        ).toBe('Change rectangle “Footer”: fill, bindings');
        expect(describe({ op: 'deleteShapes', shapes: [footer] })).toBe(
            'Delete rectangle “Footer”'
        );
        expect(describe({ op: 'deleteShapes', shapes: [footer, 'missing'] })).toBe(
            'Delete 2 shapes: rectangle “Footer”, “missing”'
        );
        expect(describe({ op: 'deleteGroup', group: 'card' })).toBe('Ungroup “Card”');
        expect(describe({ op: 'updateVariable', variable: brand, value: '#ff6600' })).toBe(
            'Change color variable “Brand”: #ff6600'
        );
        expect(describe({ op: 'updateVariable', variable: brand, name: 'Accent' })).toBe(
            'Change color variable “Brand” to “Accent”'
        );
        expect(describe({ op: 'deleteVariable', variable: brand })).toBe(
            'Delete color variable “Brand”'
        );
    });
});
