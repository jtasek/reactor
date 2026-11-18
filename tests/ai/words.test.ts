import { readWords } from 'src/ui/components/EditWithWords/Words';

it('reads titles, topics with their lines, and loose text', () => {
    expect(
        readWords(
            [
                '# Title',
                'Intro.',
                '**Add** shapes',
                '- `add a circle`',
                'also lines',
                '',
                '**Ask**',
                '- `props`',
                '',
                'After the list.'
            ].join('\n')
        )
    ).toEqual([
        { kind: 'title', text: 'Title' },
        { kind: 'text', text: 'Intro.' },
        {
            kind: 'topic',
            name: 'Add',
            note: 'shapes',
            lines: [
                { kind: 'item', text: '`add a circle`' },
                { kind: 'text', text: 'also lines' }
            ]
        },
        { kind: 'topic', name: 'Ask', note: '', lines: [{ kind: 'item', text: '`props`' }] },
        { kind: 'text', text: 'After the list.' }
    ]);
});

it('leaves a plain answer as it is', () => {
    expect(readWords('I will add a sign-in button.')).toEqual([
        { kind: 'text', text: 'I will add a sign-in button.' }
    ]);
});
