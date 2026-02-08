import { MouseEvent } from 'react';

type Point = { x: number; y: number };

export function dist(a: PointerEvent, b: PointerEvent) {
    const dx = a.clientX - b.clientX;
    const dy = a.clientY - b.clientY;
    return Math.hypot(dx, dy);
}

export function midpoint(a: PointerEvent, b: PointerEvent) {
    return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
}

export const screenToCanvas = (
    event: MouseEvent | PointerEvent,
    svgElement: SVGSVGElement | null,
    scale: number,
    offset: Point
) => {
    if (!svgElement) {
        return { x: 0, y: 0 };
    }

    const ctm = svgElement.getScreenCTM();
    const svgPoint = svgElement.createSVGPoint?.();
    if (!ctm || !svgPoint) {
        return {
            x: (event.clientX - offset.x) / scale,
            y: (event.clientY - offset.y) / scale
        };
    }

    svgPoint.x = event.clientX;
    svgPoint.y = event.clientY;
    const transformedPoint = svgPoint.matrixTransform(ctm.inverse());

    return {
        x: (transformedPoint.x - offset.x) / scale,
        y: (transformedPoint.y - offset.y) / scale
    };
};
