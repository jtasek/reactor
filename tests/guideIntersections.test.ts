import { guideIntersections, type GuideOutline } from 'src/app/guideIntersections';

it('finds line crossings and deduplicates corners and coincident edges', () => {
    const outlines: GuideOutline[] = [
        { kind: 'segment', start: { x: 0, y: 0 }, end: { x: 10, y: 10 } },
        { kind: 'segment', start: { x: 10, y: 10 }, end: { x: 10, y: 30 } }
    ];
    expect(guideIntersections(outlines, 'vertical', 5)).toEqual([{ x: 5, y: 5 }]);
    expect(guideIntersections(outlines, 'vertical', 10)).toEqual([
        { x: 10, y: 10 },
        { x: 10, y: 30 }
    ]);
    expect(guideIntersections(outlines, 'horizontal', 20)).toEqual([{ x: 10, y: 20 }]);
    expect(guideIntersections(outlines, 'vertical', 11)).toEqual([]);
});

it('intersects rotated ellipses exactly and returns one marker for tangency', () => {
    const arc: GuideOutline = {
        kind: 'arc',
        center: { x: 100, y: 100 },
        u: { x: 40, y: 40 },
        v: { x: -20, y: 20 },
        from: 0,
        to: Math.PI * 2
    };
    const points = guideIntersections([arc], 'vertical', 100);
    expect(points).toHaveLength(2);
    points.forEach((point) => {
        expect(point.x).toBeCloseTo(100);
        expect(Math.abs(point.y - 100)).toBeCloseTo(80 / Math.sqrt(5));
    });
    expect(guideIntersections([arc], 'vertical', 100 + Math.sqrt(2000))).toHaveLength(1);
    expect(guideIntersections([arc], 'vertical', 150)).toEqual([]);
});

it('keeps only the appropriate quarter of a rounded corner', () => {
    const arc: GuideOutline = {
        kind: 'arc',
        center: { x: 20, y: 20 },
        u: { x: 10, y: 0 },
        v: { x: 0, y: 10 },
        from: Math.PI,
        to: Math.PI * 1.5
    };
    const points = guideIntersections([arc], 'vertical', 15);
    expect(points).toHaveLength(1);
    expect(points[0].y).toBeCloseTo(20 - Math.sqrt(75));
});
