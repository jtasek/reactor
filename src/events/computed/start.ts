export const start = ({ pointer }, { currenDocument }) => {
  const { position, initialPosition } = pointer;
  const { scale } = currenDocument.camera;

  return {
    x:
      initialPosition.x > position.x
        ? position.x / scale
        : initialPosition.x / scale,
    y:
      initialPosition.y > position.y
        ? position.y / scale
        : initialPosition.y / scale
  };
};
