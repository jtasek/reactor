import { clientToSurface, screenDeltaToSurface, screenToCanvas } from './helpers';

describe('SVG coordinate conversion', () => {
    const surface = {
        getScreenCTM: () => ({ a: 2, b: 0, c: 0, d: 3, e: 100, f: 50 })
    };
    const event = { clientX: 180, clientY: 140 };

    it('accounts for surface offset, CSS/viewBox scale, and camera transform', () => {
        expect(clientToSurface(event, surface)).toEqual({ x: 40, y: 30 });
        expect(screenToCanvas(event, surface, { scale: 2, position: { x: 10, y: -10 } })).toEqual({
            x: 15,
            y: 20
        });
    });

    it('converts pan vectors without applying the surface translation', () => {
        expect(screenDeltaToSurface({ x: 20, y: -30 }, surface)).toEqual({ x: 10, y: -10 });
    });

    it('handles rotated and skewed SVG transforms', () => {
        const transformed = {
            getScreenCTM: () => ({ a: 0, b: 2, c: -3, d: 1, e: 100, f: 50 })
        };

        expect(clientToSurface({ clientX: 10, clientY: 120 }, transformed)).toEqual({
            x: 20,
            y: 30
        });
    });

    it('returns unavailable instead of fabricating coordinates', () => {
        const camera = { scale: 1, position: { x: 0, y: 0 } };

        expect(screenToCanvas(event, null, camera)).toBeNull();
        expect(screenToCanvas(event, { getScreenCTM: () => null }, camera)).toBeNull();
        expect(screenToCanvas(event, surface, { ...camera, scale: 0 })).toBeNull();
        expect(clientToSurface({ clientX: NaN, clientY: 0 }, surface)).toBeNull();
    });

    it.each([0, NaN, Infinity])('rejects singular or invalid matrix scale %s', (a) => {
        const invalid = {
            getScreenCTM: () => ({ a, b: 0, c: 0, d: 1, e: 0, f: 0 })
        };

        expect(clientToSurface(event, invalid)).toBeNull();
    });

    it('treats unavailable browser transforms as an ignored input', () => {
        const unavailable = {
            getScreenCTM: () => {
                throw new Error('Detached SVG');
            }
        };

        expect(clientToSurface(event, unavailable)).toBeNull();
    });
});
