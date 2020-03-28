export const position = ({ pointer }, { currenDocument }) => {
  const { current } = pointer;
  const { scale } = currenDocument.camera;

  return {
    x: current.x / scale,
    y: current.y / scale
  };
};
