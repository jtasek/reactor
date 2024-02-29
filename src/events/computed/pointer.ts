import { derived } from 'overmind';
import { Application, Position, Size } from 'src/app/types';
import { Pointer } from '../types';

const DEFAULT_CAMERA_SCALE = 1;

export const center = derived<Pointer, Application, Position>(({ current, start }) => {
    return {
        x: Math.round(start.x + (current.x - start.x) / 2),
        y: Math.round(start.y + (current.y - start.y) / 2)
    };
});

export const scaledCenter = derived<Pointer, Application, Position>(
    ({ center }, { currentDocument }) => {
        const { position, scale = DEFAULT_CAMERA_SCALE } = currentDocument.camera;

        return {
            x: Math.round((center.x - position.x) / scale),
            y: Math.round((center.y - position.y) / scale)
        };
    }
);

export const scaledCurrent = derived<Pointer, Application, Position>(
    (pointer, { currentDocument }) => {
        const { position, scale = DEFAULT_CAMERA_SCALE } = currentDocument.camera;

        return {
            x: Math.round((pointer.current.x - position.x) / scale),
            y: Math.round((pointer.current.y - position.y) / scale)
        };
    }
);

export const offset = derived<Pointer, Application, Position>(({ current, start }) => {
    return {
        x: current.x - start.x,
        y: current.y - start.y
    };
});

export const scaledOffset = derived<Pointer, Application, Position>(
    ({ offset }, { currentDocument }) => {
        const { position, scale = DEFAULT_CAMERA_SCALE } = currentDocument.camera;

        return {
            x: Math.round((offset.x - position.x) / scale),
            y: Math.round((offset.y - position.y) / scale)
        };
    }
);

export const scaledPath = derived<Pointer, Application, Position[]>(
    ({ path }, { currentDocument }) => {
        const { position, scale = DEFAULT_CAMERA_SCALE } = currentDocument.camera;

        return path.map((point: Position) => ({
            x: Math.round((point.x - position.x) / scale),
            y: Math.round((point.y - position.y) / scale)
        }));
    }
);

export const radius = derived<Pointer, Application, number>(({ center, start }) => {
    const x = center.x - start.x;
    const y = center.y - start.y;

    return Math.round(Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2)));
});

export const scaledRadius = derived<Pointer, Application, number>(
    ({ scaledCenter, scaledStart }) => {
        const x = scaledCenter.x - scaledStart.x;
        const y = scaledCenter.y - scaledStart.y;

        return Math.round(Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2)));
    }
);

export const size = derived<Pointer, Application, Size>(({ current, start }) => {
    return {
        width: Math.abs(current.x - start.x),
        height: Math.abs(current.y - start.y)
    };
});

export const scaledSize = derived<Pointer, Application, Size>(({ size }, { currentDocument }) => {
    const { scale = DEFAULT_CAMERA_SCALE } = currentDocument.camera;

    return {
        width: Math.round(size.width / scale),
        height: Math.round(size.height / scale)
    };
});

export const bottomRight = derived<Pointer, Application, Position>(({ current, start }) => {
    return {
        x: start.x > current.x ? start.x : current.x,
        y: start.y > current.y ? start.y : current.y
    };
});

export const scaledBottomRight = derived<Pointer, Application, Position>(
    ({ bottomRight }, { currentDocument }) => {
        const { position, scale = DEFAULT_CAMERA_SCALE } = currentDocument.camera;

        return {
            x: Math.round((bottomRight.x - position.x) / scale),
            y: Math.round((bottomRight.y - position.y) / scale)
        };
    }
);

export const topLeft = derived<Pointer, Application, Position>((pointer) => {
    const { current, start } = pointer;

    return {
        x: start.x > current.x ? current.x : start.x,
        y: start.y > current.y ? current.y : start.y
    };
});

export const scaledTopLeft = derived<Pointer, Application, Position>(
    ({ topLeft }, { currentDocument }) => {
        const { position, scale = DEFAULT_CAMERA_SCALE } = currentDocument.camera;

        return {
            x: Math.round((topLeft.x - position.x) / scale),
            y: Math.round((topLeft.y - position.y) / scale)
        };
    }
);

export const scaledStart = derived<Pointer, Application, Position>(
    ({ start }, { currentDocument }) => {
        const { position, scale = DEFAULT_CAMERA_SCALE } = currentDocument.camera;

        return {
            x: Math.round((start.x - position.x) / scale),
            y: Math.round((start.y - position.y) / scale)
        };
    }
);
