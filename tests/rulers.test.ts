import { guideLabelPlace, guidePlace, removesGuide, rulerMarks } from 'src/app/rulers';

const firstLabels = (scale: number) =>
    rulerMarks(0, scale, 400)
        .filter((mark) => mark.label !== null)
        .slice(0, 2)
        .map((mark) => mark.label);

describe('rulerMarks', () => {
    it('labels the smallest 1, 2 or 5 times a power of ten that is far enough apart', () => {
        expect(firstLabels(1)).toEqual(['0', '50']);
        expect(firstLabels(0.5)).toEqual(['0', '100']);
        expect(firstLabels(0.3)).toEqual(['0', '200']);
        expect(firstLabels(2)).toEqual(['0', '50']);
        expect(firstLabels(2.5)).toEqual(['0', '20']);
        expect(firstLabels(40)).toEqual(['0', '2']);
        expect(firstLabels(120)).toEqual(['0', '0.5']);
    });

    it('marks the canvas units in view, labeling every step', () => {
        const marks = rulerMarks(0, 1, 100);

        expect(marks.filter((mark) => mark.label !== null)).toEqual([
            { at: 0, label: '0' },
            { at: 50, label: '50' },
            { at: 100, label: '100' }
        ]);
        expect(marks.map((mark) => mark.at)).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    });

    it('follows the camera, from the canvas unit at the ruler start', () => {
        const marks = rulerMarks(-130, 2, 80);

        expect(marks.map((mark) => mark.at)).toEqual([10, 30, 50, 70]);
        expect(marks.filter((mark) => mark.label !== null)).toEqual([{ at: 70, label: '100' }]);
    });

    it('labels fractions without rounding errors', () => {
        const labels = rulerMarks(0, 120, 400)
            .filter((mark) => mark.label !== null)
            .map((mark) => mark.label);

        expect(labels).toEqual(['0', '0.5', '1', '1.5', '2', '2.5', '3']);
    });

    it('splits a step of 2 into quarters', () => {
        const marks = rulerMarks(0, 40, 80);

        expect(marks.map((mark) => mark.at)).toEqual([0, 20, 40, 60, 80]);
        expect(marks.filter((mark) => mark.label !== null).map((mark) => mark.label)).toEqual([
            '0',
            '2'
        ]);
    });
});

describe('guidePlace', () => {
    it('puts a dragged guide on the whole canvas unit nearest the pointer', () => {
        expect(guidePlace(300, 37, 1.25)).toEqual({ offset: 210, at: 299.5 });
        expect(guidePlace(-12, 0, 2)).toEqual({ offset: -6, at: -12 });
    });
});

describe('removesGuide', () => {
    it('removes a guide released on its ruler or beyond the canvas', () => {
        expect(removesGuide(19, 20, 700)).toBe(true);
        expect(removesGuide(20, 20, 700)).toBe(false);
        expect(removesGuide(700, 20, 700)).toBe(false);
        expect(removesGuide(701, 20, 700)).toBe(true);
        expect(removesGuide(-1, 0, 700)).toBe(true);
    });
});

describe('guideLabelPlace', () => {
    const bounds = { width: 1000, height: 700 };

    it('puts a vertical guide label right of its line, level with the pointer', () => {
        expect(guideLabelPlace('vertical', 600, 300, bounds, 20)).toEqual({
            x: 612,
            y: 300,
            anchor: 'start',
            baseline: 'middle'
        });
    });

    it('puts a horizontal guide label above its line, right of the pointer', () => {
        expect(guideLabelPlace('horizontal', 200, 300, bounds, 20)).toEqual({
            x: 312,
            y: 194,
            anchor: 'start',
            baseline: 'auto'
        });
    });

    it('keeps the label clear of the rulers and inside the canvas', () => {
        expect(guideLabelPlace('vertical', 600, 5, bounds, 20).y).toBe(30);
        expect(guideLabelPlace('vertical', 600, 699, bounds, 20).y).toBe(690);
        expect(guideLabelPlace('horizontal', 200, 5, bounds, 20).x).toBe(32);
        expect(guideLabelPlace('horizontal', 30, 300, bounds, 20)).toMatchObject({
            y: 36,
            baseline: 'hanging'
        });
    });

    it("flips to the pointer's left near the right edge", () => {
        expect(guideLabelPlace('vertical', 980, 300, bounds, 20)).toMatchObject({
            x: 968,
            anchor: 'end'
        });
        expect(guideLabelPlace('horizontal', 200, 980, bounds, 20)).toMatchObject({
            x: 968,
            anchor: 'end'
        });
    });
});
