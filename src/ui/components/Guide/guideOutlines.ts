import type { GuideOutline } from 'src/app/guideIntersections';
import type { Point } from 'src/app/types';

const GEOMETRY = 'rect, circle, ellipse, line, polyline, polygon, text, image';

/** Only painted artwork is tagged; handles, frame hit areas and hidden measurement copies are excluded. */
export function readGuideOutlines(surface: SVGSVGElement): GuideOutline[] {
    const matrix = surface.getScreenCTM();
    if (!matrix) {
        return [];
    }
    const inverse = matrix.inverse();

    return [
        ...surface.querySelectorAll<SVGGraphicsElement>(`[data-guide-outline] :is(${GEOMETRY})`)
    ].flatMap((node) => {
        if (node.hasAttribute('data-view-instance-hit') || !isVisible(node, surface)) {
            return [];
        }
        const screen = node.getScreenCTM();
        if (!screen) {
            return [];
        }

        return outlineFor(node, inverse.multiply(screen));
    });
}

function isVisible(node: Element, surface: Element): boolean {
    for (
        let current: Element | null = node;
        current && current !== surface;
        current = current.parentElement
    ) {
        const style = getComputedStyle(current);
        if (
            style.display === 'none' ||
            style.visibility === 'hidden' ||
            Number(style.opacity) === 0
        ) {
            return false;
        }
    }

    return true;
}

function outlineFor(node: SVGGraphicsElement, matrix: DOMMatrix): GuideOutline[] {
    const number = (name: string) => Number(node.getAttribute(name) ?? 0);
    const point = (x: number, y: number): Point => ({
        x: matrix.a * x + matrix.c * y + matrix.e,
        y: matrix.b * x + matrix.d * y + matrix.f
    });
    const segment = (a: Point, b: Point): GuideOutline => ({
        kind: 'segment',
        start: point(a.x, a.y),
        end: point(b.x, b.y)
    });
    const arc = (
        x: number,
        y: number,
        rx: number,
        ry: number,
        from = 0,
        to = Math.PI * 2
    ): GuideOutline => ({
        kind: 'arc',
        center: point(x, y),
        u: { x: matrix.a * rx, y: matrix.b * rx },
        v: { x: matrix.c * ry, y: matrix.d * ry },
        from,
        to
    });
    if (node instanceof SVGCircleElement || node instanceof SVGEllipseElement) {
        return [
            arc(
                number('cx'),
                number('cy'),
                number(node instanceof SVGCircleElement ? 'r' : 'rx'),
                number(node instanceof SVGCircleElement ? 'r' : 'ry')
            )
        ];
    }
    if (node instanceof SVGLineElement) {
        return [
            segment({ x: number('x1'), y: number('y1') }, { x: number('x2'), y: number('y2') })
        ];
    }
    if (node instanceof SVGPolylineElement || node instanceof SVGPolygonElement) {
        const points = Array.from({ length: node.points.numberOfItems }, (_, index) =>
            node.points.getItem(index)
        );
        const segments = points.slice(1).map((p, index) => segment(points[index], p));
        if (node instanceof SVGPolygonElement && points.length > 1) {
            segments.push(segment(points[points.length - 1], points[0]));
        }

        return segments;
    }
    // Text uses its measured typographic box; images use their displayed rectangle.
    const box = node.getBBox();
    const x = box.x;
    const y = box.y;
    const right = x + box.width;
    const bottom = y + box.height;
    const rx =
        node instanceof SVGRectElement
            ? Math.min(
                  box.width / 2,
                  Math.max(0, Number(node.getAttribute('rx') ?? node.getAttribute('ry') ?? 0))
              )
            : 0;
    const ry =
        node instanceof SVGRectElement
            ? Math.min(
                  box.height / 2,
                  Math.max(0, Number(node.getAttribute('ry') ?? node.getAttribute('rx') ?? 0))
              )
            : 0;
    if (!rx || !ry) {
        const corners = [
            { x, y },
            { x: right, y },
            { x: right, y: bottom },
            { x, y: bottom }
        ];

        return corners.map((p, index) => segment(p, corners[(index + 1) % 4]));
    }

    return [
        segment({ x: x + rx, y }, { x: right - rx, y }),
        segment({ x: right, y: y + ry }, { x: right, y: bottom - ry }),
        segment({ x: right - rx, y: bottom }, { x: x + rx, y: bottom }),
        segment({ x, y: bottom - ry }, { x, y: y + ry }),
        arc(right - rx, bottom - ry, rx, ry, 0, Math.PI / 2),
        arc(x + rx, bottom - ry, rx, ry, Math.PI / 2, Math.PI),
        arc(x + rx, y + ry, rx, ry, Math.PI, Math.PI * 1.5),
        arc(right - rx, y + ry, rx, ry, Math.PI * 1.5, Math.PI * 2)
    ];
}
