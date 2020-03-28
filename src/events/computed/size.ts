export const size = ({ pointer }, { currenDocument }) => {
  const { initialPosition } = pointer;
  const { scale } = currenDocument.camera;

  return {
    width: Math.abs(position.x - initialPosition.x) / scale,
    height: Math.abs(position.y - initialPosition.y) / scale
  };
};
