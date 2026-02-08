import { MouseEvent } from 'react';

export function dist(a: PointerEvent, b: PointerEvent) {
    const dx = a.clientX - b.clientX;
    const dy = a.clientY - b.clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

export function midpoint(a: PointerEvent, b: PointerEvent) {
    return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
}

export const screenToCanvas = (event: MouseEvent | PointerEvent, svgElement: SVGSVGElement | null, scale: number, offset: { x: number; y: number; }) => {
    if (!svgElement) {
        return { x: 0, y: 0 };
    }

    const point = svgElement.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const transformedPoint = point.matrixTransform(svgElement.getScreenCTM()?.inverse());

    return {
        x: (transformedPoint.x - offset.x) / scale,
        y: (transformedPoint.y - offset.y) / scale
    };
};

