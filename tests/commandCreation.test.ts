import { creationOperation } from 'src/ui/components/CommandLine/creation';
import { createTestStore } from './support/store';

const center = { x: 100, y: 200 };

it('parses quoted text, signed coordinates and decimal dimensions', () => {
    expect(
        creationOperation('text value="Hello world" x=-12.5 fontSize=18', center)?.shape
    ).toMatchObject({
        type: 'text',
        value: 'Hello world',
        position: { x: -12.5, y: 200 },
        fontSize: 18
    });
    expect(creationOperation('rectangle width=40 height=20', center)?.shape).toMatchObject({
        position: { x: 80, y: 190 },
        size: { width: 40, height: 20 }
    });
});

it.each([
    'rectangle width=-1',
    'circle radius=Infinity',
    'text value="unfinished',
    'rectangle width=2 width=3',
    'circle width=20',
    'rectangle fill=red'
])('rejects invalid input %s', (input) => {
    expect(() => creationOperation(input, center)).toThrow();
});

it('creates shapes through the shared atomic operations without a pointer gesture', () => {
    const { store } = createTestStore();
    const operation = creationOperation('rectangle width=80 height=24', center)!;
    const result = store.actions.applyOperations({
        documentId: store.state.currentDocumentId,
        by: { kind: 'person' },
        operations: [operation]
    });
    expect(result.applied).toBe(true);
    expect(Object.values(store.state.currentDocument.shapes)[0]).toMatchObject({
        type: 'rectangle',
        size: { width: 80, height: 24 }
    });
});

it.each([
    ['rectangle w=80 h=24', 'rectangle width=80 height=24'],
    ['circle r=12.5', 'circle radius=12.5'],
    ['text text="Hello world" fs=18', 'text value="Hello world" fontSize=18'],
    ['text font-size=18', 'text fontSize=18'],
    ['rectangle W=80 H=24', 'rectangle width=80 height=24']
])('expands aliases in %s', (short, full) => {
    expect(creationOperation(short, center)).toEqual(creationOperation(full, center));
});

it.each([
    'rectangle w=80 width=80',
    'rectangle height=24 h=48',
    'circle radius=24 r=12',
    'text fs=18 font-size=24',
    'text text="First" value="Second"'
])('rejects duplicate canonical parameters in %s', (input) => {
    expect(() => creationOperation(input, center)).toThrow('is repeated');
});

it.each(['circle w=40', 'rectangle r=10', 'rectangle h=-4', 'text fs=0'])(
    'validates aliases for the selected shape: %s',
    (input) => {
        expect(() => creationOperation(input, center)).toThrow();
    }
);
