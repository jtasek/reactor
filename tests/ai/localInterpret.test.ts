import { distance, mentions, similarity, suggestions } from 'src/ai/local/fuzzy';
import { HELP, SELECT_FIRST, interpret, type Context } from 'src/ai/local/interpret';

const shapes = {
    card: {
        type: 'rectangle',
        name: 'Card',
        position: { x: 10, y: 10 },
        size: { width: 100, height: 40 },
        fill: '#3366ff'
    },
    dot: { type: 'circle', name: 'Dot', position: { x: 300, y: 100 }, radius: 20, fill: '#e5484d' },
    title: {
        type: 'text',
        name: 'Title',
        position: { x: 150, y: 200 },
        value: 'Hello',
        fontSize: 24
    },
    plain: {
        type: 'rectangle',
        name: 'rectangle-1',
        position: { x: 500, y: 50 },
        size: { width: 50, height: 50 }
    }
};

const read = (prompt: string, selection: string[] = [], groups: Context['groups'] = {}) =>
    interpret(prompt, { selection, shapes, groups });

/** The changes a request proposes, by the shape they change. */
const changes = (prompt: string, selection: string[] = []) =>
    Object.fromEntries(
        read(prompt, selection).operations.map((operation) => [operation.shape, operation.changes])
    );

describe('loose matching', () => {
    it('counts swapped neighbours as one edit', () => {
        expect(distance('widht', 'width')).toBe(1);
        expect(distance('rectngle', 'rectangle')).toBe(1);
    });

    it('takes typos, abbreviations and plurals, but not other short words', () => {
        expect(similarity('widht', 'width')).toBeGreaterThan(0.74);
        expect(similarity('rect', 'rectangle')).toBeGreaterThan(0.74);
        expect(similarity('circels', 'circle')).toBeGreaterThan(0.74);
        expect(similarity('bleu', 'blue')).toBeGreaterThan(0.74);
        expect(similarity('more', 'move')).toBe(0);
        expect(similarity('light', 'right')).toBe(0);
        expect(similarity('rad', 'red')).toBe(0);
    });

    it('prefers the longer phrase and keeps terms that share a word', () => {
        const vocabulary = [
            { id: 'fontSize', phrases: ['font size', 'size'] },
            { id: 'fill', phrases: ['color'] },
            { id: 'fontColor', phrases: ['color'] }
        ];

        expect(mentions(['font', 'size'], vocabulary).map(({ id }) => id)).toEqual(['fontSize']);
        expect(mentions(['color'], vocabulary).map(({ id }) => id)).toEqual(['fill', 'fontColor']);
    });

    it('offers near misses', () => {
        expect(suggestions('opasity', [{ id: 'opacity', phrases: ['opacity'] }])).toEqual([
            'opacity'
        ]);
        expect(suggestions('website', [{ id: 'white', phrases: ['white'] }])).toEqual([]);
    });
});

describe('properties of the selection', () => {
    it('sets properties by name, typos included, several at once', () => {
        expect(changes('set the corner radius to 12 and fill to grene', ['card'])).toEqual({
            card: { cornerRadius: 12, fill: '#30a46c' }
        });
        expect(changes('widht 200 hieght 60', ['card'])).toEqual({
            card: { size: { width: 200, height: 60 } }
        });
        expect(changes('w=240 h=48', ['card'])).toEqual({
            card: { size: { width: 240, height: 48 } }
        });
        expect(changes('stroke #123', ['card'])).toEqual({ card: { stroke: '#112233' } });
    });

    it('reads a property as each shape has it', () => {
        expect(changes('radius 50', ['card', 'dot'])).toEqual({
            card: { cornerRadius: 50 },
            dot: { radius: 50 }
        });
        expect(changes('make them purple', ['card', 'title'])).toEqual({
            card: { fill: '#8e4ec6' },
            title: { fontColor: '#8e4ec6' }
        });
        expect(changes('width 80', ['dot'])).toEqual({ dot: { radius: 40 } });
        // X and Y are the box's corner, as in the Inspector.
        expect(changes('x 100 y 200', ['dot'])).toEqual({ dot: { position: { x: 120, y: 220 } } });
    });

    it('takes percent for opacity and words for weights', () => {
        expect(changes('opacity 50%', ['card'])).toEqual({ card: { opacity: 0.5 } });
        expect(changes('decrease opacity by 20', ['card'])).toEqual({ card: { opacity: 0.8 } });
        expect(changes('bold', ['title'])).toEqual({ title: { fontWeight: 700 } });
    });

    it('changes by an amount or a step', () => {
        expect(changes('wider by 40', ['card'])).toEqual({
            card: { size: { width: 140, height: 40 } }
        });
        expect(changes('make it bigger', ['card', 'dot', 'title'])).toEqual({
            card: { size: { width: 125, height: 50 } },
            dot: { radius: 25 },
            title: { fontSize: 30 }
        });
        expect(changes('increase font size by 4', ['title'])).toEqual({ title: { fontSize: 28 } });
        expect(changes('rotate 45', ['card'])).toEqual({ card: { rotation: 45 } });
        expect(changes('rotate to 30 degrees', ['card'])).toEqual({ card: { rotation: 30 } });
    });

    it('reads text with or without quotes', () => {
        expect(changes('change text to Ahoj svete', ['title'])).toEqual({
            title: { value: 'Ahoj svete' }
        });
        expect(changes('rename to Big card', ['card'])).toEqual({ card: { name: 'Big card' } });
        expect(changes('make the text red', ['title'])).toEqual({
            title: { fontColor: '#e5484d' }
        });
    });

    it('says which property a shape lacks, and asks for a missing value', () => {
        expect(read('corner radius 8', ['dot'])).toEqual({
            operations: [],
            text: 'Dot has no corner radius to change.'
        });
        expect(read('frobnicate the wdith', ['card']).text).toContain('What should the width be?');
    });

    it('lists what the selection has', () => {
        const { text, operations } = read('props', ['card']);

        expect(operations).toEqual([]);
        expect(text).toContain('**Card** rectangle');
        expect(text).toContain('- fill: #3366ff');
        expect(text).toContain('- width: 100');
        expect(text).not.toContain('font size');
        expect(read('what is the fill?', ['card']).text).not.toContain('width: 100');
        expect(read('props').text).toContain('4 shapes: 2 rectangles, 1 circle, 1 text');
    });
});

describe('what a request is about', () => {
    it('finds shapes by name, or all of a kind, without a selection', () => {
        expect(changes('make Card green')).toEqual({ card: { fill: '#30a46c' } });
        expect(changes('make rectangle-1 green')).toEqual({ plain: { fill: '#30a46c' } });
        expect(read('delete all circles').operations).toEqual([
            { op: 'deleteShapes', shapes: ['dot'] }
        ]);
        expect(Object.keys(changes('opacity 50% everything'))).toHaveLength(4);
    });

    it('asks for a selection when a change names nothing', () => {
        expect(read('opacity 50%').text).toBe(SELECT_FIRST);
        expect(read('align left').text).toBe(SELECT_FIRST);
    });
});

describe('arranging', () => {
    it('aligns to an edge of the selection', () => {
        expect(changes('align top', ['card', 'dot'])).toEqual({
            dot: { position: { x: 300, y: 30 } }
        });
        expect(changes('algin left', ['card', 'dot'])).toEqual({
            dot: { position: { x: 30, y: 100 } }
        });
        expect(read('align', ['card', 'dot']).text).toContain('Say which edge');
        expect(read('align top', ['card']).text).toContain('two or more');
    });

    it('spaces three or more shapes equally', () => {
        // Card ends at 110 and rectangle-1 starts at 500: the dot, 40 wide, goes in the middle.
        expect(changes('distribute horizontally', ['card', 'dot', 'plain'])).toEqual({
            dot: { position: { x: 305, y: 100 } }
        });
    });

    it('moves by directions or to a place', () => {
        expect(changes('move right 40 and down 10', ['card'])).toEqual({
            card: { position: { x: 50, y: 20 } }
        });
        expect(changes('move to 100, 200', ['card'])).toEqual({
            card: { position: { x: 100, y: 200 } }
        });
    });

    it('duplicates, groups and ungroups', () => {
        expect(read('duplicate', ['card']).operations).toMatchObject([
            {
                op: 'addShape',
                shape: { type: 'rectangle', name: 'Card copy', position: { x: 30, y: 30 } }
            }
        ]);
        expect(read('group as "Header"', ['card', 'dot']).operations).toEqual([
            { op: 'addGroup', name: 'Header', shapes: ['card', 'dot'] }
        ]);
        expect(
            read('ungroup', ['card'], { header: { name: 'Header', shapes: ['card', 'dot'] } })
                .operations
        ).toEqual([{ op: 'deleteGroup', group: 'header' }]);
    });
});

describe('adding', () => {
    it('adds each kind with the properties it is given', () => {
        expect(read('add 3 circels radius 20 opacity 50%').operations).toMatchObject(
            Array(3).fill({ op: 'addShape', shape: { type: 'circle', radius: 20, opacity: 0.5 } })
        );
        expect(read('add text "Hello" font size 32 bold').operations).toMatchObject([
            { shape: { type: 'text', value: 'Hello', fontSize: 32, fontWeight: 700 } }
        ]);
        expect(read('a red oval').operations).toMatchObject([
            { shape: { type: 'ellipse', fill: '#e5484d' } }
        ]);
        expect(read('add a line').operations).toMatchObject([{ shape: { type: 'line' } }]);
    });

    it('adds a shape even with something selected, but "add a stroke" changes the selection', () => {
        expect(read('add a circle', ['card']).operations).toMatchObject([{ op: 'addShape' }]);
        expect(changes('add a red stroke', ['card'])).toEqual({ card: { stroke: '#e5484d' } });
    });
});

describe('answers without a proposal', () => {
    it('points to the app for its own commands', () => {
        expect(read('zoom in').text).toContain('“Zoom in” is a command of the app');
        expect(read('undo').text).toContain('“Undo” is a command of the app');
    });

    it('keeps an unknown request short, with what the selection can change', () => {
        const { text } = read('make it sparkle', ['card']);

        expect(text).toContain("I didn't understand “sparkle”");
        expect(text).toContain('`corner radius`');
        expect(text.length).toBeLessThan(HELP.length / 2);
    });

    it('gives the help when asked', () => {
        expect(read('help').text).toBe(HELP);
        expect(read('what can you do').text).toBe(HELP);
        expect(read('?').text).toBe(HELP);
    });
});
