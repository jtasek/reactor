export const centre = ({ pointer }, { currenDocument }) => {
  const { position, initialPosition } = pointer;
  const { scale } = currenDocument.camera;

  return {
    x: (initialPosition.x + (position.x - initialPosition.x) / 2) / scale,
    y: (initialPosition.y + (position.y - initialPosition.y) / 2) / scale
  };
};
