import { derived } from 'overmind';
import { Application, Position, Size } from 'src/app/types';
import { Events } from '../types';

export const centre = derived<Events, Application, Position>(({ pointer }) => {
  const { position, startPosition } = pointer;

  return {
    x: startPosition.x + (position.x - startPosition.x) / 2,
    y: startPosition.y + (position.y - startPosition.y) / 2
  };
});

export const scaledCentre = derived<Events, Application, Position>(
  ({ pointer }, { currentDocument }) => {
    const { centre } = pointer;
    const scale = currentDocument.camera.scale ?? 1;

    return {
      x: centre.x / scale,
      y: centre.y / scale
    };
  }
);

export const scaledCurrentPosition = derived<Events, Application, Position>(
  ({ pointer }, { currentDocument }) => {
    const { position } = pointer;
    const scale = currentDocument.camera.scale ?? 1;

    return {
      x: position.x / scale,
      y: position.y / scale
    };
  }
);

export const offset = derived<Events, Application, Position>(({ pointer }) => {
  const { position: position, startPosition } = pointer;

  return {
    x: position.x - startPosition.x,
    y: position.y - startPosition.y
  };
});

export const scaledOffset = derived<Events, Application, Position>(
  ({ pointer }, { currentDocument }) => {
    const { offset } = pointer;
    const scale = currentDocument.camera.scale ?? 1;

    return {
      x: offset.x / scale,
      y: offset.y / scale
    };
  }
);

export const scaledPath = derived<Events, Application, Position[]>(
  ({ pointer }, { currentDocument }) => {
    const { path } = pointer;
    const scale = currentDocument.camera.scale ?? 1;

    return path.map((point: Position) => ({ x: point.x / scale, y: point.y / scale }));
  }
);

export const radius = derived<Events, Application, number>(({ pointer }) => {
  const { centre, startPosition } = pointer;

  const a = centre.x - startPosition.x;
  const b = centre.y - startPosition.y;

  return Math.sqrt(a * a + b * b);
});

export const scaledRadius = derived<Events, Application, number>(
  ({ pointer }, { currentDocument }) => {
    const { radius } = pointer;
    const scale = currentDocument.camera.scale ?? 1;

    return radius / scale;
  }
);

export const size = derived<Events, Application, Size>(({ pointer }) => {
  const { position: position, startPosition } = pointer;

  return {
    width: Math.abs(position.x - startPosition.x),
    height: Math.abs(position.y - startPosition.y)
  };
});

export const scaledSize = derived<Events, Application, Size>(({ pointer }, { currentDocument }) => {
  const { size } = pointer;
  const scale = currentDocument.camera.scale ?? 1;

  return {
    width: size.width / scale,
    height: size.height / scale
  };
});

export const bottomRightPosition = derived<Events, Application, Position>(({ pointer }) => {
  const { position: position, startPosition } = pointer;

  return {
    x: startPosition.x > position.x ? startPosition.x : position.x,
    y: startPosition.y > position.y ? startPosition.y : position.y
  };
});

export const topLeftPosition = derived<Events, Application, Position>(({ pointer }) => {
  const { position: position, startPosition } = pointer;

  return {
    x: startPosition.x > position.x ? position.x : startPosition.x,
    y: startPosition.y > position.y ? position.y : startPosition.y
  };
});

export const scaledTopLeftPosition = derived<Events, Application, Position>(
  ({ pointer }, { currentDocument }) => {
    const { topLeftPosition } = pointer;
    const scale = currentDocument.camera.scale ?? 1;

    return {
      x: topLeftPosition.x / scale,
      y: topLeftPosition.y / scale
    };
  }
);

export const scaledStartPosition = derived<Events, Application, Position>(
  ({ pointer }, { currentDocument }) => {
    const { startPosition } = pointer;
    const scale = currentDocument.camera.scale ?? 1;

    return {
      x: startPosition.x / scale,
      y: startPosition.y / scale
    };
  }
);
