export const offset = ({ pointer }, { currenDocument }) => {
  const { initialPosition } = pointer;
  const { scale } = currenDocument.camera;

  return {
    x: (position.x - initialPosition.x) / scale,
    y: (position.y - initialPosition.y) / scale
  };
};
