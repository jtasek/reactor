export const trySetPointerCapture = (svgEl: SVGSVGElement, pointerId: number) => {
    try {
        svgEl.setPointerCapture(pointerId);
    } catch {
        // ignore if capture is unavailable
    }
};

export const tryReleasePointerCapture = (
    svgEl: SVGSVGElement | null | undefined,
    pointerId: number
) => {
    try {
        svgEl?.releasePointerCapture(pointerId);
    } catch {
        // ignore if release is unavailable
    }
};
