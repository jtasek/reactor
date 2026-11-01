import type { Point } from 'src/app/types';

/** Device-local arrangement is separate from the shared document and screen coordinates. */
export function readFlowPositions(value: unknown): Record<string, Point> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }

    return Object.fromEntries(
        Object.entries(value).flatMap(([id, point]) => {
            if (
                !point ||
                typeof point !== 'object' ||
                !Number.isFinite(point.x) ||
                !Number.isFinite(point.y)
            ) {
                return [];
            }

            return [[id, { x: point.x, y: point.y }]];
        })
    );
}
