import { selectionExtent } from 'src/app/membership';
import { placeSelectionMenu } from 'src/app/selectionMenu';
import type { Box, ShapeInput } from 'src/app/types';
import { createTestStore } from './support/store';

const rectangle = (x: number, width = 200): ShapeInput => ({
    type: 'rectangle',
    position: { x, y: 100 },
    size: { width, height: 100 },
    selected: false
});

const box = (left: number, top: number, width: number, height: number): Box => ({
    topLeft: { x: left, y: top },
    bottomRight: { x: left + width, y: top + height },
    width,
    height
});

const camera = { position: { x: 0, y: 0 }, scale: 1 };
const away = { current: { x: 900, y: 900 }, inside: true };

describe('the box around the selection', () => {
    it('is none without a selection, and holds every selected shape as drawn', () => {
        const { store } = createTestStore();

        store.actions.addShape(rectangle(100));
        store.actions.addShape(rectangle(500));

        const [first, second] = store.state.currentDocument.shapesIds;
        const document = () => store.state.currentDocument;

        expect(selectionExtent(document())).toBeNull();

        store.actions.selectShape(first);
        expect(selectionExtent(document())).toMatchObject(box(100, 100, 200, 100));

        store.actions.selectShape(second);
        expect(selectionExtent(document())).toMatchObject(box(100, 100, 600, 100));

        // Turned a quarter, the first is drawn 100 wide and 200 high about (200, 150).
        store.actions.unselectShape(second);
        store.actions.rotateShape({ shapeId: first, position: { x: 300, y: 150 } });
        const turned = selectionExtent(document())!;

        expect(turned.topLeft.x).toBeCloseTo(150);
        expect(turned.topLeft.y).toBeCloseTo(50);
        expect(turned.width).toBeCloseTo(100);
        expect(turned.height).toBeCloseTo(200);
    });
});

describe('the selection’s menu', () => {
    it('sits above the box’s top left corner, where the camera draws it', () => {
        expect(placeSelectionMenu(box(100, 100, 200, 100), camera, away)).toMatchObject({
            left: 100,
            bottom: 90,
            below: false
        });
        expect(
            placeSelectionMenu(
                box(100, 100, 200, 100),
                { position: { x: 50, y: 20 }, scale: 2 },
                away
            )
        ).toMatchObject({ left: 250, bottom: 210 });
    });

    it('sits above the rotate handle of a box too narrow to leave it free', () => {
        expect(placeSelectionMenu(box(100, 100, 40, 40), camera, away)).toMatchObject({
            left: 100,
            bottom: 62
        });
    });

    it('sits under the box when there is no room above', () => {
        expect(placeSelectionMenu(box(100, 20, 200, 100), camera, away)).toMatchObject({
            left: 100,
            top: 130,
            below: true
        });
    });

    it('is shown with the pointer over the box or on its way to the menu, on the canvas', () => {
        const shown = (x: number, y: number, inside = true) =>
            placeSelectionMenu(box(100, 100, 200, 100), camera, { current: { x, y }, inside })
                .shown;

        expect(shown(200, 150)).toBe(true);
        expect(shown(120, 95)).toBe(true);
        expect(shown(120, 70)).toBe(true);
        expect(shown(120, 40)).toBe(false);
        expect(shown(400, 150)).toBe(false);
        expect(shown(200, 150, false)).toBe(false);
    });
});
