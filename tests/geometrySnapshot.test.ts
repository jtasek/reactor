import { artwork, geometryKey, snapshot } from 'src/app/geometrySnapshot';

it('reuses unchanged branches without changing an earlier snapshot', () => {
    const source = { size: { width: 40, height: 30 }, points: [{ x: 1, y: 2 }] };
    const before = snapshot(source);
    expect(snapshot(source)).toBe(before);
    source.size.width = 80;
    const after = snapshot(source);
    expect(after).not.toBe(before);
    expect(after.points).toBe(before.points);
    expect(before.size.width).toBe(40);
    expect(after.size.width).toBe(80);
    expect(geometryKey(after)).not.toBe(geometryKey(before));
});

it('preserves equivalent content keys across replacement and selection changes', () => {
    const before = artwork({ width: 40, height: 30, selected: false });
    const after = artwork({ selected: true, height: 30, width: 40 });
    expect(geometryKey(after)).toBe(geometryKey(before));
});

it('detects added and removed fields, array edits and dates', () => {
    const source: { values: number[]; optional?: number; date: Date } = {
        values: [1, 2],
        date: new Date(0)
    };
    const before = snapshot(source);
    source.optional = 3;
    expect(snapshot(source).optional).toBe(3);
    delete source.optional;
    expect(snapshot(source)).not.toHaveProperty('optional');
    source.values.pop();
    source.date.setTime(1000);
    const after = snapshot(source);
    expect(after.values).toEqual([1]);
    expect(after.date.getTime()).toBe(1000);
    expect(before.values).toEqual([1, 2]);
    expect(before.date.getTime()).toBe(0);
});

it('keeps plain and artwork snapshots separate for the same source', () => {
    const source = { selected: true, position: { x: 1, y: 2 }, size: { width: 3 } };
    expect(snapshot(source)).toHaveProperty('selected', true);
    expect(artwork(source)).not.toHaveProperty('selected');
    expect(artwork(source, ['position'])).not.toHaveProperty('position');
    expect(artwork(source)).toHaveProperty('position', { x: 1, y: 2 });
});
