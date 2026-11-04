import {
    clearRecentCommands,
    recentCommands,
    recentSuggestion,
    rememberCommand
} from 'src/ui/components/CommandLine/history';

it('keeps five invocations in recency order, deduplicating exact commands without changing text', () => {
    for (let i = 0; i < 10; i++) {
        rememberCommand('recent-order', `text value="Title ${i}"`);
    }
    expect(recentCommands('recent-order')).toHaveLength(5);
    expect(recentCommands('recent-order').at(-1)).toBe('text value="Title 5"');
    rememberCommand('recent-order', '  text value="Title 5"  ');
    expect(recentCommands('recent-order')[0]).toBe('text value="Title 5"');
    expect(
        recentCommands('recent-order').filter((value) => value === 'text value="Title 5"')
    ).toHaveLength(1);
});

it('leaves out undo and redo, and treats bare command names case-insensitively', () => {
    rememberCommand('recent-case', 'group');
    expect(rememberCommand('recent-case', 'Undo')).toEqual(['group']);
    rememberCommand('recent-case', 'redo');
    rememberCommand('recent-case', 'Rectangle tool');
    rememberCommand('recent-case', 'rectangle tool');
    expect(recentCommands('recent-case')).toEqual(['rectangle tool', 'group']);
    rememberCommand('recent-case', 'text value="Hi"');
    rememberCommand('recent-case', 'text value="hi"');
    expect(recentCommands('recent-case').slice(0, 2)).toEqual([
        'text value="hi"',
        'text value="Hi"'
    ]);
});

it('isolates documents and clears only the requested history', () => {
    rememberCommand('history-a', 'w=80');
    rememberCommand('history-b', 'w=120');
    clearRecentCommands('history-a');
    expect(recentCommands('history-a')).toEqual([]);
    expect(recentCommands('history-b')).toEqual(['w=120']);
});

it('bounds retained document histories', () => {
    rememberCommand('old-history', 'undo');
    for (let i = 0; i < 16; i++) {
        rememberCommand(`bounded-${i}`, 'undo');
    }
    expect(recentCommands('old-history')).toEqual([]);
});

it('uses current action availability and preserves the exact invocation for replay', () => {
    const input = 'rectangle w=80 h=40 name="Mixed Case"';
    const action = {
        id: 'create rectangle',
        name: 'Create rectangle',
        description: '',
        enabled: true
    };
    expect(recentSuggestion(input, [action])).toMatchObject({
        input,
        enabled: true,
        name: 'Create rectangle'
    });
    expect(
        recentSuggestion(input, [{ ...action, enabled: false, unavailable: 'Document is locked' }])
    ).toMatchObject({ enabled: false, unavailable: 'Document is locked' });
    expect(recentSuggestion('removed command', [])).toMatchObject({
        enabled: false,
        unavailable: 'This command is no longer available.'
    });
    // Radius is hidden while a frame is selected; it still exists.
    expect(recentSuggestion('r=12', [])).toMatchObject({
        enabled: false,
        unavailable: 'Not available for the current selection.'
    });
});

it('distinguishes drawing tools, creation and selection-edit parameters', () => {
    const actions = [
        'create rectangle',
        'Rectangle tool',
        'edit position',
        'edit stack',
        'edit radius',
        'edit size'
    ].map((id) => ({ id, name: id, description: '', enabled: true, shortcut: 'r' }));
    expect(recentSuggestion('Rectangle tool', actions).name).toBe('Rectangle tool');
    expect(recentSuggestion('rectangle', actions).name).toBe('create rectangle');
    expect(recentSuggestion('move x=10', actions).name).toBe('edit position');
    expect(recentSuggestion('gap=20 padding=10', actions).name).toBe('edit stack');
    expect(recentSuggestion('r=12', actions).name).toBe('edit radius');
    expect(recentSuggestion('w=100 h=20', actions).name).toBe('edit size');
    expect(recentSuggestion('rectangle w=100', actions).shortcut).toBeUndefined();
});
