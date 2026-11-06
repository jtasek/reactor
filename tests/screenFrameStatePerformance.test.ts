import { performance } from 'node:perf_hooks';
import { createDocument, createShape } from 'src/app/factories';
import { projectScreen } from 'src/app/screenProjection';
import type { Frame } from 'src/app/types';

function fixture(count: number) {
    const screen: Frame = {
        id: 'screen',
        name: 'Screen',
        kind: 'screen',
        position: { x: 0, y: 0 },
        size: { width: 800, height: 600 },
        visible: true,
        locked: false
    };
    const frames = Object.fromEntries(
        Array.from({ length: count }, (_, index) => {
            const id = `frame-${index}`;

            return [id, { ...screen, id, kind: 'frame' as const, parentFrameId: screen.id }];
        })
    );
    const shapes = Object.fromEntries(
        Object.keys(frames).map((parentFrameId) => {
            const id = `shape-${parentFrameId}`;

            return [
                id,
                {
                    ...createShape({
                        type: 'rectangle',
                        parentFrameId,
                        name: id,
                        order: id,
                        position: { x: 10, y: 10 },
                        size: { width: 20, height: 20 }
                    }),
                    id
                }
            ];
        })
    );
    const document = createDocument({
        id: 'frame-state-performance',
        frames: { screen, ...frames },
        shapes,
        shapesIds: Object.keys(shapes)
    });
    const viewport = { position: { x: 0, y: 0 }, size: screen.size };

    return { document, viewport };
}

it('projects a screen with many child frames', () => {
    const { document, viewport } = fixture(400);
    projectScreen(document, 'screen', viewport);
    const durations = Array.from({ length: 20 }, () => {
        const start = performance.now();
        const projected = projectScreen(document, 'screen', viewport)!;
        const duration = performance.now() - start;
        expect(projected.frames).toHaveLength(400);
        expect(projected.shapes).toHaveLength(400);

        return duration;
    });
    if (process.env.PROFILE_FRAME_VISIBILITY) {
        process.stdout.write(`${JSON.stringify({ screenFrameMs: durations })}\n`);
    }
});

it('shares one frame-state lookup and refreshes inherited visibility on the next projection', () => {
    const { document, viewport } = fixture(100);
    document.frames['frame-1'].parentFrameId = 'frame-0';
    const states = vi.fn(() => undefined);
    Object.defineProperty(document, 'frameStates', { get: states });
    const first = projectScreen(document, 'screen', viewport)!;
    // One visibility lookup plus the shallow layout-document copy.
    expect(states).toHaveBeenCalledTimes(2);
    expect(first.frames).toHaveLength(100);
    expect(first.shapes).toHaveLength(100);

    document.frames['frame-0'].visible = false;
    const hidden = projectScreen(document, 'screen', viewport)!;
    expect(states).toHaveBeenCalledTimes(4);
    expect(hidden.frames).toHaveLength(98);
    expect(hidden.shapes).toHaveLength(98);
    expect(hidden.shapes.some((shape) => shape.parentFrameId === 'frame-1')).toBe(false);
    expect(first.frames).toHaveLength(100);

    document.frames['frame-0'].visible = true;
    document.frames['frame-0'].locked = true;
    const restored = projectScreen(document, 'screen', viewport)!;
    expect(states).toHaveBeenCalledTimes(6);
    expect(restored.frames).toHaveLength(100);
    expect(restored.shapes).toHaveLength(100);
});
