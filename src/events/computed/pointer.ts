import { derived } from 'overmind';
import { Application, Position, Size } from 'src/app/types';
import { Pointer } from '../types';

const DEFAULT_CAMERA_SCALE = 1;

export const center = derived<Pointer, Application, Position>((pointer) => {
  const { position, startPosition } = pointer;

  return {
    x: startPosition.x + (position.x - startPosition.x) / 2,
    y: startPosition.y + (position.y - startPosition.y) / 2
  };
});

export const scaledCenter = derived<Pointer, Application, Position>(
  (pointer, { currentDocument }) => {
    const { position, scale = DEFAULT_CAMERA_SCALE } = currentDocument.camera;

    return {
      x: (pointer.center.x - position.x) / scale,
      y: (pointer.center.y - position.y) / scale
    };
  }
);

export const scaledPosition = derived<Pointer, Application, Position>(
  (pointer, { currentDocument }) => {
    const { position, scale = DEFAULT_CAMERA_SCALE } = currentDocument.camera;

    return {
      x: (pointer.position.x - position.x) / scale,
      y: (pointer.position.y - position.y) / scale
    };
  }
);

export const offset = derived<Pointer, Application, Position>((pointer) => {
  const { position, startPosition } = pointer;

  return {
    x: position.x - startPosition.x,
    y: position.y - startPosition.y
  };
});

export const scaledOffset = derived<Pointer, Application, Position>(
  (pointer, { currentDocument }) => {
    const { position, scale = DEFAULT_CAMERA_SCALE } = currentDocument.camera;

    return {
      x: (pointer.offset.x - position.x) / scale,
      y: (pointer.offset.y - position.y) / scale
    };
  }
);

export const scaledPath = derived<Pointer, Application, Position[]>(
  (pointer, { currentDocument }) => {
    const { position, scale = DEFAULT_CAMERA_SCALE } = currentDocument.camera;

    return pointer.path.map((point: Position) => ({
      x: (point.x - position.x) / scale,
      y: (point.y - position.y) / scale
    }));
  }
);

export const radius = derived<Pointer, Application, number>((pointer) => {
  const { center, startPosition } = pointer;

  const a = center.x - startPosition.x;
  const b = center.y - startPosition.y;

  return Math.sqrt(a * a + b * b);
});

export const scaledRadius = derived<Pointer, Application, number>(
  (pointer, { currentDocument }) => {
    const { scaledCenter, scaledStartPosition } = pointer;
    const { position, scale = DEFAULT_CAMERA_SCALE } = currentDocument.camera;

    const x = scaledCenter.x - scaledStartPosition.x;
    const y = scaledCenter.y - scaledStartPosition.y;

    return Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2));
  }
);

export const size = derived<Pointer, Application, Size>((pointer) => {
  const { position, startPosition } = pointer;

  return {
    width: Math.abs(position.x - startPosition.x),
    height: Math.abs(position.y - startPosition.y)
  };
});

export const scaledSize = derived<Pointer, Application, Size>((pointer, { currentDocument }) => {
  const { position, scale = DEFAULT_CAMERA_SCALE } = currentDocument.camera;

  return {
    width: pointer.size.width / scale,
    height: pointer.size.height / scale
  };
});

export const bottomRightPosition = derived<Pointer, Application, Position>((pointer) => {
  const { position, startPosition } = pointer;

  return {
    x: startPosition.x > position.x ? startPosition.x : position.x,
    y: startPosition.y > position.y ? startPosition.y : position.y
  };
});

export const scaledBottomRightPosition = derived<Pointer, Application, Position>(
  (pointer, { currentDocument }) => {
    const { position, scale = DEFAULT_CAMERA_SCALE } = currentDocument.camera;

    return {
      x: (pointer.bottomRightPosition.x - position.x) / scale,
      y: (pointer.bottomRightPosition.y - position.y) / scale
    };
  }
);

export const topLeftPosition = derived<Pointer, Application, Position>((pointer) => {
  const { position, startPosition } = pointer;

  return {
    x: startPosition.x > position.x ? position.x : startPosition.x,
    y: startPosition.y > position.y ? position.y : startPosition.y
  };
});

export const scaledTopLeftPosition = derived<Pointer, Application, Position>(
  (pointer, { currentDocument }) => {
    const { position, scale = DEFAULT_CAMERA_SCALE } = currentDocument.camera;

    return {
      x: (pointer.topLeftPosition.x - position.x) / scale,
      y: (pointer.topLeftPosition.y - position.y) / scale
    };
  }
);

export const scaledStartPosition = derived<Pointer, Application, Position>(
  (pointer, { currentDocument }) => {
    const { position, scale = DEFAULT_CAMERA_SCALE } = currentDocument.camera;

    return {
      x: (pointer.startPosition.x - position.x) / scale,
      y: (pointer.startPosition.y - position.y) / scale
    };
  }
);
