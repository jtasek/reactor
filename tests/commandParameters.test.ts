import {
    editorForAction,
    editorForInput,
    editorInput
} from 'src/ui/components/CommandLine/parameters';
import { creationOperation } from 'src/ui/components/CommandLine/creation';

it('guided creation produces the same operation as typed aliases', () => {
    const editor = editorForAction('create rectangle')!;
    editor.values.width = '240';
    const center = { x: 0, y: 0 };
    expect(creationOperation(editorInput(editor), center)).toEqual(
        creationOperation('rectangle w=240 h=48', center)
    );
});

it('editing a typed parameter preserves the remaining arguments and quoted text', () => {
    const editor = editorForInput('text text="Welcome home" fs=20 name="Heading" fill=#3366ff')!;
    editor.values.fontSize = '24';
    expect(creationOperation(editorInput(editor), { x: 0, y: 0 })).toMatchObject({
        shape: { value: 'Welcome home', fontSize: 24, name: 'Heading', fontColor: '#3366ff' }
    });
});

it('blank selection inputs stay absent instead of becoming zero', () => {
    const editor = editorForAction('edit size')!;
    editor.values.width = '240';
    expect(editorInput(editor)).toBe('width=240');
    expect(editorInput(editorForAction('edit position')!)).toBe('move');
});

it('keeps malformed or conflicting input outside the guided editor for canonical validation', () => {
    expect(editorForInput('rectangle w=10 width=20')).toBeUndefined();
    expect(editorForInput('radius=')).toBeUndefined();
    expect(editorForAction('create unknown')).toBeUndefined();
});
